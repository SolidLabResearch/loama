import { BaseSubject, Index, IndexItem, Permission, ResourceOwnerAsset, ResourcePermissions, Resources } from "../types";
import { IAccessRequest, IController, IInboxConstructor, IPolicy, IStore, IStoreConstructor, ManageableAssetEvent, ManageableAssetOptions, SubjectConfig, SubjectConfigs, SubjectKey, SubjectType } from "../types/modules";
import { type AccessRequest as AccessRequestObject } from "../types/modules";
import { AccessRequest } from "./accessRequests/AccessRequest";
import { ODRLAccessRequest } from "./accessRequests/OdrlAccessRequest";
import { Mutex } from "./utils/Mutex";
import { ODRLAccessRequestService } from "./utils/OdrlAccessRequestService";
import { ODRLPolicyService } from "./utils/OdrlPolicyService";
import { ODRL } from "./utils/PolicyParser";
import { getAuthenticatedWebId, getBearerAuthorizationHeader } from "./utils/auth";

type ResourceOwnerAssetsResponse = {
    assets: ResourceOwnerAsset[];
}

type ParsedSseEvent = {
    type: string;
    data: string;
}

/**
 * Controller which makes it calls to the backend AS through ODRL requests.
 * Makes use of the Inrupt SDK to authenticate users.
 */
export class ODRLController<T extends Record<keyof T, BaseSubject<keyof T & string>>> extends Mutex implements IController<T> {
    private index: IStore<Index<T[keyof T & string]>>;
    private resources: IStore<Resources>;
    private accessRequest: AccessRequest;
    private subjectConfigs: SubjectConfigs<T>;
    private authorizationServerURL: string;

    // TODO : Find a better way of constructing the controller with all the different modules
    constructor(storeConstructor: IStoreConstructor, inboxConstructor: IInboxConstructor, subjects: SubjectConfigs<T>, authorizationServerURL: string) {
        super();
        // There is currently no "easy" solution to get around the as IStore...
        this.index = new storeConstructor("index.json", () => ({ id: "", items: [] })) as IStore<Index<T[keyof T & string]>>;
        this.resources = new storeConstructor("resources.json", () => ({ id: "", items: [] })) as IStore<Resources>;;
        this.accessRequest = new ODRLAccessRequest(this as unknown as ODRLController<{}>, inboxConstructor, this.resources);
        this.subjectConfigs = subjects;
        this.authorizationServerURL = authorizationServerURL;
    }

    private getSubjectConfig<K extends SubjectKey<T>>(subject: T[K]): SubjectConfig<T, T[K]> {
        const subjectConfig = this.subjectConfigs[subject.type];
        if (!subjectConfig) {
            throw new Error(`No config found for subject type ${subject.type}`);
        }
        return subjectConfig as SubjectConfig<T, T[K]>
    }

    private async updateItem<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>, permissions: Permission[], alwaysKeepItem = false) {
    }

    AccessRequest(): IAccessRequest {
        return this.accessRequest;
    }

    async setPodUrl(podUrl: string) {
    }

    unsetPodUrl() {
    }

    async getOrCreateIndex() {
        return { id: "", items: [] }
    }

    getLabelForSubject<K extends SubjectKey<T>>(subject: T[K]): string {
        const { resolver } = this.getSubjectConfig(subject);
        return resolver.toLabel(subject);
    }

    /**
     * Assemble the information for a subject in a resource
     * @returns 
     */
    async getItem<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>): Promise<IndexItem<T[K]> | undefined> {
        const subjectConfig = this.getSubjectConfig(subject)
        const subjects = await subjectConfig.manager.getRemotePermissions<K>(resourceUrl);
        const subjectPermission = subjects.find(entry => subjectConfig.resolver.checkMatch(entry.subject, subject))
        if (!subjectPermission) return undefined
        return {
            id: "string",
            requestId: "string",
            isEnabled: subjectPermission.isEnabled,
            permissions: [...subjectPermission.permissions ?? []],
            resource: resourceUrl,
            subject: subject,
        } as IndexItem<T[K]>
    }

    async addPermission<K extends SubjectKey<T>>(resourceUrl: string, addedPermission: Permission, subject: SubjectType<T, K>) {
        const release = await this.acquire();
        try {

            // 1. Create a new permission for the subject
            await this.getSubjectConfig(subject).manager.createPermissions(resourceUrl, subject, [addedPermission])

            // 2. Let the manager add the permission, return the updated version
            const webId = getAuthenticatedWebId();
            const permissions = await this.getSubjectConfig(subject).manager.getTargetPermissionsForUser(webId, subject.selector?.url ?? "", resourceUrl);

            return permissions;
        } catch (e) {
            throw e;
        } finally {
            release();
        }
    }

    async removeSubject<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>) {
        const subjectConfig = this.getSubjectConfig(subject);
        const item = await this.getItem(resourceUrl, subject);

        await subjectConfig.manager.deletePermissions(resourceUrl, subject, item?.permissions ?? []);
    }

    async removePermission<K extends SubjectKey<T>>(resourceUrl: string, removedPermission: Permission, subject: SubjectType<T, K>) {
        const release = await this.acquire()
        try {

            // 1. Delete a permission for the subject
            await this.getSubjectConfig(subject).manager.deletePermissions(resourceUrl, subject, [removedPermission]);

            // 2. Let the manager delete the permission, return the updated version
            const webId = getAuthenticatedWebId();
            const permissions = await this.getSubjectConfig(subject).manager.getTargetPermissionsForUser(webId, subject.selector!.url, resourceUrl);

            return permissions

        } finally {
            release();
        }
    }

    async enablePermissions<K extends SubjectKey<T>>(resource: string, subject: SubjectType<T, K>) {
        // won't fix
    }

    async disablePermissions<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>) {
        // won't fix
    }

    async getContainerPermissionList(containerUrl: string): Promise<ResourcePermissions<T[keyof T]>[]> {
        return this.getSubjectConfig({ type: "public" } as T[SubjectKey<T>]).manager.getContainerPermissionList(containerUrl);
    }

    // NOTE: Do we want to force this to only use the index stored in the store?
    async getResourcePermissionList(resourceUrl: string): Promise<ResourcePermissions<T[keyof T]>> {
        const result = await this.getSubjectConfig({ type: "public" } as T[SubjectKey<T>]).manager.getRemotePermissions(resourceUrl);

        return {
            resourceUrl,
            canRequestAccess: true, // TODO
            permissionsPerSubject: result
        };
    }

    isSubjectSupported<K extends string, B extends BaseSubject<K>>(subject: BaseSubject<K>): IController<Record<K, B>> {
        if (!this.subjectConfigs[subject.type as unknown as keyof T]) {

            throw new Error(`Subject type ${subject.type} is not supported`);
        }
        return this as unknown as IController<Record<K, B>>
    }

    // ! added for access requests
    async requestAccess(permission: { action: string; resource: string; }): Promise<void> {
        const webid = getAuthenticatedWebId();
        await new ODRLAccessRequestService(this.authorizationServerURL).requestAccess(permission.resource, webid, permission.action);
    }

    async handleAccessRequest(requestId: string, status: 'accepted' | 'denied'): Promise<void> {
        const webid = getAuthenticatedWebId();
        await new ODRLAccessRequestService(this.authorizationServerURL).acceptOrDenyAccess(requestId, webid, status);
    }

    async getAccessRequests(): Promise<{
        asRequestingParty: AccessRequestObject[];
        asResourceOwner: AccessRequestObject[];
    }> {
        return new ODRLAccessRequestService(this.authorizationServerURL).retrieveAccessRequests(getAuthenticatedWebId());
    }

    async getPolicies(): Promise<IPolicy[]> {
        const webId = getAuthenticatedWebId();

        const store = await new ODRLPolicyService(this.authorizationServerURL).fetchPolicies(webId);
        return store.getQuads(null, null, ODRL('Agreement'), null)
            .map((policyQuad) => {
                const policyId = policyQuad.subject.id;
                const permissionRules = store.getQuads(policyId, ODRL('permission'), null, null)
                    .map((permissionQuad) => {
                        const ruleId = permissionQuad.object.id;
                        return {
                            ruleType: 'permission' as const,
                            assigner: store.getQuads(ruleId, ODRL('assigner'), null, null)[0]?.object.id ?? '',
                            assignees: store.getQuads(ruleId, ODRL('assignee'), null, null).map((quad) => quad.object.id),
                            permissions: store.getQuads(ruleId, ODRL('action'), null, null).map((quad) => quad.object.id.split('/').at(-1) ?? quad.object.id),
                            targets: store.getQuads(ruleId, ODRL('target'), null, null).map((quad) => quad.object.id),
                            id: ruleId,
                        };
                    });

                return {
                    id: policyId,
                    rules: permissionRules,
                };
            });
    }

    private resourceOwnerAssetsUrl(options?: ManageableAssetOptions, watch = false): string {
        const url = new URL(`${this.authorizationServerURL.replace(/\/$/u, '')}/resource-owner/assets`);
        const include = new Set(options?.include ?? ['policy_uri']);

        if (include.has('policy_uri')) {
            include.add('policies');
        }

        if (include.size > 0) {
            url.searchParams.set('include', [...include].join(','));
        }

        if (watch) {
            url.searchParams.set('watch', 'true');
        }

        return url.toString();
    }

    private async fetchResourceOwnerAssets(options?: ManageableAssetOptions): Promise<ResourceOwnerAsset[]> {
        const response = await fetch(this.resourceOwnerAssetsUrl(options), {
            headers: {
                authorization: await getBearerAuthorizationHeader(),
                accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch manageable assets: ${response.status}`);
        }

        const data = await response.json() as ResourceOwnerAssetsResponse;
        return data.assets;
    }

    async getManageableAssets(options?: ManageableAssetOptions): Promise<ResourceOwnerAsset[]> {
        return this.fetchResourceOwnerAssets(options);
    }

    watchManageableAssets(callback: (event: ManageableAssetEvent) => void, options?: ManageableAssetOptions): () => void {
        const abortController = new AbortController();

        void this.watchResourceOwnerAssets(callback, options, abortController.signal)
            .catch((error) => {
                if (!abortController.signal.aborted) {
                    console.error('Failed to watch manageable assets', error);
                }
            });

        return () => abortController.abort();
    }

    private async watchResourceOwnerAssets(
        callback: (event: ManageableAssetEvent) => void,
        options: ManageableAssetOptions | undefined,
        signal: AbortSignal
    ) {
        const response = await fetch(this.resourceOwnerAssetsUrl(options, true), {
            headers: {
                authorization: await getBearerAuthorizationHeader(),
                accept: 'text/event-stream',
            },
            signal,
        });

        if (!response.ok) {
            throw new Error(`Failed to watch manageable assets: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('Manageable assets SSE response did not include a body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\r?\n\r?\n/u);
            buffer = events.pop() ?? '';

            for (const rawEvent of events) {
                const event = this.parseSseEvent(rawEvent);
                if (event) {
                    this.handleAssetEvent(event, callback);
                }
            }
        }
    }

    private parseSseEvent(rawEvent: string): ParsedSseEvent | null {
        let type = 'message';
        const dataLines: string[] = [];

        for (const line of rawEvent.split(/\r?\n/u)) {
            if (!line || line.startsWith(':')) continue;

            if (line.startsWith('event:')) {
                type = line.slice('event:'.length).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice('data:'.length).trimStart());
            }
        }

        if (dataLines.length === 0) return null;

        return {
            type,
            data: dataLines.join('\n'),
        };
    }

    private handleAssetEvent(event: ParsedSseEvent, callback: (event: ManageableAssetEvent) => void) {
        const data = JSON.parse(event.data) as ResourceOwnerAssetsResponse | ResourceOwnerAsset;

        if (event.type === 'snapshot') {
            callback({
                type: 'snapshot',
                assets: 'assets' in data ? data.assets : [data],
            });
            return;
        }

        if (event.type === 'asset-created' || event.type === 'asset-updated' || event.type === 'asset-deleted') {
            callback({
                type: event.type,
                asset: data as ResourceOwnerAsset,
            });
        }
    }
}
