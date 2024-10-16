import { BaseSubject, IndexItem, Permission, ResourcePermissions, SubjectPermissions } from "../types";
import { IController, IStore, SubjectConfig, SubjectConfigs, SubjectKey, SubjectType } from "../types/modules";
import { Mutex } from "./utils/Mutex";

export class Controller<T extends Record<keyof T, BaseSubject<keyof T & string>>> extends Mutex implements IController<T> {
    private store: IStore<T>
    private subjectConfigs: SubjectConfigs<T>

    constructor(store: IStore<T>, subjects: SubjectConfigs<T>) {
        super();
        this.store = store;
        this.subjectConfigs = subjects;
    }

    private getSubjectConfig<K extends SubjectKey<T>>(subject: T[K]): SubjectConfig<T, T[K]> {
        const subjectConfig = this.subjectConfigs[subject.type];
        if (!subjectConfig) {
            throw new Error(`No config found for subject type ${subject.type}`);
        }
        return subjectConfig as SubjectConfig<T, T[K]>
    }

    private async getExistingRemotePermissions<K extends SubjectKey<T>>(resourceUrl: string, subject: T[K]): Promise<Permission[]> {
        const subjectConfig = this.getSubjectConfig(subject)
        const subjects = await subjectConfig.manager.getRemotePermissions<K>(resourceUrl);
        const subjectPermission = subjects.find(entry => subjectConfig.resolver.checkMatch(entry.subject, subject))

        return [...subjectPermission?.permissions ?? []]
    }


    private async getExistingPermissions<K extends SubjectKey<T>>(resourceUrl: string, subject: T[K]): Promise<Permission[]> {
        const item = await this.getItem(resourceUrl, subject);
        if (item) {
            // Makeing sure the array is not a reference to the one stored in the index
            return [...item.permissions]
        }
        return this.getExistingRemotePermissions(resourceUrl, subject);
    }

    private async updateItem<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>, permissions: Permission[], alwaysKeepItem = false) {
        let item = await this.getItem(resourceUrl, subject);
        const { manager } = this.getSubjectConfig(subject)

        if (item) {
            await manager.editPermissions(resourceUrl, item, subject, permissions);
        } else {
            await manager.createPermissions(resourceUrl, subject, permissions);

            item = {
                id: crypto.randomUUID(),
                requestId: crypto.randomUUID(),
                isEnabled: true,
                permissions: permissions,
                resource: resourceUrl,
                subject: subject,
            }

            const index = await this.store.getCurrentIndex();
            index.items.push(item);
        }

        if (!alwaysKeepItem && permissions.length === 0 && manager.shouldDeleteOnAllRevoked()) {
            const index = await this.store.getCurrentIndex();
            const idx = index.items.findIndex(i => i.id === item.id);
            index.items.splice(idx, 1);
        } else {
            item.permissions = permissions;

            // The SOLID server OR the SDK does not directly push the update to the acl files for some reason
            // Here we give it some time to save/push the changes
            await new Promise(res => setTimeout(res, 500));
            // extra check what the ACL currently has stored as info. Will decrease the chance of the index going out of sync with the ACL file
            const remotePermissions = await this.getExistingRemotePermissions(resourceUrl, subject);
            if (remotePermissions !== permissions) {
                console.debug("Permissions in index are out of sync with remote, updating index...", subject);
                item.permissions = remotePermissions;
            }
        }

        await this.store.saveToRemoteIndex();
    }

    setPodUrl(podUrl: string) {
        this.store.setPodUrl(podUrl);
    }

    unsetPodUrl() {
        this.store.unsetPodUrl();
    }

    async getOrCreateIndex() {
        return this.store.getOrCreateIndex();
    }

    getLabelForSubject<K extends SubjectKey<T>>(subject: T[K]): string {
        const { resolver } = this.getSubjectConfig(subject);
        return resolver.toLabel(subject);
    }

    async getItem<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>): Promise<IndexItem<T[K]> | undefined> {
        const { resolver } = this.getSubjectConfig<K>(subject);

        const index = await this.store.getCurrentIndex<K>();
        return resolver.getItem(index, resourceUrl, subject.selector)
    }

    async addPermission<K extends SubjectKey<T>>(resourceUrl: string, addedPermission: Permission, subject: SubjectType<T, K>) {
        const release = await this.acquire();
        try {
            let permissions = await this.getExistingPermissions(resourceUrl, subject);

            if (permissions.indexOf(addedPermission) !== -1) {
                console.error("Permission already granted")
                return permissions;
            }

            permissions.push(addedPermission)

            await this.updateItem(resourceUrl, subject, permissions)
            return permissions;
        } catch (e) {
            throw e;
        } finally {
            release();
        }
    }

    async removeSubject<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>) {
        await this.updateItem(resourceUrl, subject, []);

        const subjectConfig = this.getSubjectConfig(subject);
        const index = await this.store.getCurrentIndex<K>();

        const item = subjectConfig.resolver.getItem(index, resourceUrl, subject.selector);
        if (!item) return;

        await subjectConfig.manager.deletePermissions(resourceUrl, subject);

        const idx = index.items.findIndex(i => subjectConfig.resolver.checkMatch(i.subject, subject));
        index.items.splice(idx, 1);

        await this.store.saveToRemoteIndex();
    }

    async removePermission<K extends SubjectKey<T>>(resourceUrl: string, removedPermission: Permission, subject: SubjectType<T, K>) {
        const release = await this.acquire();
        try {
            let oldPermissions = await this.getExistingPermissions(resourceUrl, subject);
            let newPermissions = oldPermissions.filter((p) => p !== removedPermission);

            if (newPermissions.length === oldPermissions.length) {
                console.error("Permission not found")
                return oldPermissions;
            }

            await this.updateItem(resourceUrl, subject, newPermissions)
            return newPermissions;
        } catch (e) {
            throw e;
        } finally {
            release();
        }
    }

    async enablePermissions<K extends SubjectKey<T>>(resource: string, subject: SubjectType<T, K>) {
        let item = await this.getItem(resource, subject);
        if (!item) {
            // This point should never be reached
            throw new Error("Item not found to enable permissions from")
        }

        const { manager } = this.getSubjectConfig(subject)
        await manager.createPermissions(resource, subject, item.permissions);

        item.isEnabled = true;
        await this.store.saveToRemoteIndex()
    }

    async disablePermissions<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>) {
        let item = await this.getItem(resourceUrl, subject);
        if (!item) {
            throw new Error("Item not found to disable permissions from")
        }

        const { manager } = this.getSubjectConfig(subject)
        await manager.editPermissions(resourceUrl, item, subject, []);

        item.isEnabled = false;

        await this.store.saveToRemoteIndex()
    }

    async getContainerPermissionList(containerUrl: string): Promise<ResourcePermissions<T[keyof T]>[]> {
        const configs: SubjectConfig<T>[] = Object.values(this.subjectConfigs);

        const index = await this.store.getCurrentIndex();
        const resourcesToSkip = index.items.filter(i => i.resource.includes(containerUrl));

        const results = await Promise.allSettled(configs.map(c => c.manager.getContainerPermissionList(containerUrl, resourcesToSkip.map(i => i.resource))))

        if (results.length !== 0) {
            index.items.push(...results.reduce<IndexItem<T[SubjectKey<T>]>[]>((arr, v) => {
                if (v.status === "fulfilled") {
                    // Check if the resourceUrl is already present before pushing it into the array
                    v.value.forEach((r) => {
                        // @ts-expect-error
                        arr.push(...r.permissionsPerSubject.map(p => ({
                            id: crypto.randomUUID(),
                            requestId: crypto.randomUUID(),
                            isEnabled: true,
                            permissions: p.permissions,
                            resource: r.resourceUrl,
                            subject: p.subject
                        })))
                    })
                }
                return arr;
            }, []));

            await this.store.saveToRemoteIndex();
        }


        return index.items.reduce<ResourcePermissions<T[keyof T]>[]>((arr, v) => {
            const resourcePath = v.resource.replace(containerUrl, "");
            const amountOfSlashes = resourcePath.replace(/[^\/]/g, "").length;
            if ((amountOfSlashes == 1 && !resourcePath.endsWith("/")) || resourcePath.startsWith("/") || amountOfSlashes > 1) {
                return arr;
            }
            let existingInfo = arr.find((info) => info.resourceUrl === v.resource);
            if (existingInfo) {
                existingInfo.permissionsPerSubject.push({
                    permissions: v.permissions,
                    subject: v.subject,
                    isEnabled: v.isEnabled,
                })
            } else {
                arr.push({
                    resourceUrl: v.resource,
                    permissionsPerSubject: [{
                        permissions: v.permissions,
                        subject: v.subject,
                        isEnabled: v.isEnabled,
                    }]
                })
            }
            return arr;
        }, []);
    }

    // NOTE: Do we want to force this to only use the index stored in the store?
    async getResourcePermissionList(resourceUrl: string) {
        // Need to put it in a variable because the type declaration vanishes
        const configs: SubjectConfig<T>[] = Object.values(this.subjectConfigs);
        const index = await this.store.getCurrentIndex<keyof T & string>();
        const results = await Promise.allSettled(configs.map(c => c.manager.getRemotePermissions<keyof T & string>(resourceUrl)))

        let permissionsPerSubject = index.items.filter(i => i.resource === resourceUrl)

        return {
            resourceUrl,
            permissionsPerSubject: results.reduce<SubjectPermissions<T[keyof T & string]>[]>((arr, v) => {
                if (v.status === "fulfilled") {
                    v.value.forEach(remotePps => {
                        const { resolver } = this.getSubjectConfig(remotePps.subject);
                        const indexItem = arr.find(pps => resolver.checkMatch(remotePps.subject, pps.subject));

                        if (indexItem) {
                            if (indexItem.isEnabled) {
                                indexItem.permissions = remotePps.permissions;
                            }
                        } else {
                            arr.push(remotePps)
                        }
                    })
                }
                return arr;
            }, permissionsPerSubject)
        }
    }
}
