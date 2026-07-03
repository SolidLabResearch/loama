import { Access, AccessModes, getSolidDataset, getThingAll } from "@inrupt/solid-client";
import { SubjectPermissions, BaseSubject, IndexItem, Permission, ResourcePermissions } from "../../../types";
import { SubjectKey, TargetSubjects } from "../../../types/modules";
import { ODRL } from "../../utils/PolicyParser";
import { PolicyInterpreter } from "../../utils/PolicyInterpreter";
import { ODRLPolicyService } from "../../utils/OdrlPolicyService";
import { Store } from 'n3';
import { getAuthenticatedWebId } from "../../utils/auth";

const ACCESS_MODES_TO_PERMISSION_MAPPING: Record<keyof (AccessModes & Access), Permission> = {
    read: Permission.Read,
    write: Permission.Write,
    append: Permission.Append,
    control: Permission.Control,
    controlRead: Permission.Control,
    controlWrite: Permission.Control,
}

export abstract class ODRLPermissionManager<T extends Record<keyof T, BaseSubject<keyof T & string>>> {

    protected readonly authorizationServerURL: string;

    constructor(authorizationServerURL: string) {
        this.authorizationServerURL = authorizationServerURL;
    }

    protected AccessModesToPermissions(accessModes: AccessModes | Access): Permission[] {
        const permissions = new Set<Permission>();
        Object.entries(accessModes).forEach(([mode, isActive]) => {
            if (isActive) {
                permissions.add(ACCESS_MODES_TO_PERMISSION_MAPPING[mode as keyof (AccessModes & Access)])
            }
        })
        return [...permissions];
    }

    protected permissionsToAccessModes(addedPermissions: Iterable<Permission>, removedPermissions: Iterable<Permission>): Partial<AccessModes> {
        const accessModes: Partial<AccessModes> = {};
        const addToAccessModes = (permission: Permission, hasAccess: boolean) => {
            switch (permission) {
                case Permission.Append:
                    accessModes.append = hasAccess;
                    break;
                case Permission.Control:
                    accessModes.controlRead = hasAccess;
                    accessModes.controlWrite = hasAccess;
                    break;
                case Permission.Read:
                    accessModes.read = hasAccess;
                    break;
                case Permission.Write:
                    // Setting Write also enables Append, so we make append inherintly true
                    // This will also disable append when write is taken away
                    accessModes.write = hasAccess;
                    accessModes.append = hasAccess;
                    break;
            }
        }

        // First the removed ones so we can e.g. remove write and add append
        for (const permission of removedPermissions) {
            addToAccessModes(permission, false);
        }
        for (const permission of addedPermissions) {
            addToAccessModes(permission, true);
        }

        return accessModes;
    }


    protected editPermissionsToAccessModes(item: IndexItem, permissions: Permission[]) {
        const oldPermissionsSet = [...new Set(item.permissions)];
        const newPermissionsSet = [...new Set(permissions)];
        const addedPermissions = newPermissionsSet.filter(p => !oldPermissionsSet.includes(p));
        const removedPermissions = oldPermissionsSet.filter(p => !newPermissionsSet.includes(p));

        const accessModes = this.permissionsToAccessModes(addedPermissions, removedPermissions);
        return accessModes;
    }

    /**
     * Function to specifically get the permission list for an assignee on a certain target
     * 
     * TODO: split in subject
     */
    public async getTargetPermissionsForUser(assignerId: string, assigneeId: string, targetId: string): Promise<Permission[]> {
        const store: Store = await new ODRLPolicyService(this.authorizationServerURL).fetchPolicies(assignerId);
        const target: TargetSubjects = new PolicyInterpreter().permissionsForOneResource(targetId, store);

        if (!target) return [];

        // If there are no private permissions, or no private permissions for the assignee, return the public ones (or nothing if they don't exist)
        if (!target.private || !target.private.get(assigneeId)) return Array.from(target.public?.permissions! ?? [])

        return Array.from(target.private.get(assigneeId)?.permissions!) ?? []
    }


    public async getRemotePermissions<K extends SubjectKey<T>>(resourceUrl: string): Promise<SubjectPermissions<T[K]>[]> {
        // Extract our webID
        const webId = getAuthenticatedWebId();

        // Retrieve our policies
        const store = await new ODRLPolicyService(this.authorizationServerURL).fetchPolicies(webId);

        // Get detailed info about the target
        const interpreter = new PolicyInterpreter();
        const target: TargetSubjects = interpreter.permissionsForOneResource(resourceUrl, store);


        if (target) {
            const subjectPermissionsByKey = new Map<string, SubjectPermissions<T[K]>>();
            const addSubjectPermissions = (entry: SubjectPermissions<T[K]>) => {
                const key = entry.subject.type === 'webId'
                    ? `${entry.subject.type}:${entry.subject.selector?.url ?? ''}`
                    : entry.subject.type;
                const existingEntry = subjectPermissionsByKey.get(key);

                if (!existingEntry) {
                    subjectPermissionsByKey.set(key, {
                        ...entry,
                        permissions: [...new Set(entry.permissions)],
                    });
                    return;
                }

                existingEntry.permissions = [...new Set([...existingEntry.permissions, ...entry.permissions])];
                existingEntry.isEnabled = existingEntry.isEnabled || entry.isEnabled;
                existingEntry.targetId = existingEntry.targetId ?? entry.targetId;
            };

            // Add the public information
            if (target.public && target.public.permissions.size > 0) addSubjectPermissions({
                subject: {
                    type: "public",
                } as unknown as T[K],
                permissions: Array.from(target.public.permissions),
                isEnabled: true, // Not yet implemented, there is no odrl equivalent?
                targetId: target.targetUrl
            })

            // Add the private subjects
            if (target.private) target.private.forEach(subject => {
                if (subject.permissions.size > 0) addSubjectPermissions({
                    subject: {
                        type: "webId",
                        selector: { url: subject.subject }
                    } as unknown as T[K],
                    permissions: Array.from(subject.permissions),
                    isEnabled: true, // Not yet implemented, there is no odrl equivalent?
                    targetId: target.targetUrl
                })
            })
            return [...subjectPermissionsByKey.values()];
        }

        return [];
    }


    async getContainerPermissionList(containerUrl: string, resourceToSkip: string[] = []): Promise<ResourcePermissions<T[keyof T]>[]> {
        // Extract our webID
        const webId = getAuthenticatedWebId();

        const store = await new ODRLPolicyService(this.authorizationServerURL).fetchPolicies(webId);

        // Collect target urls
        const targetUrls = Array.from(new Set(store.getQuads(null, ODRL('target'), null, null).map(q => q.object.id)));
        const resourcePermissions: ResourcePermissions<T[keyof T]>[] = []
        for (const targetUrl of targetUrls) {
            const perms = await this.getRemotePermissions(targetUrl);
            resourcePermissions.push({
                resourceUrl: targetUrl,
                canRequestAccess: true, // TODO: based on proper access logic
                permissionsPerSubject: perms
            })
        }

        return resourcePermissions;
    }

    shouldDeleteOnAllRevoked() { return true }
}
