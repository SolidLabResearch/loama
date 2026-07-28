import { Access, AccessModes, getGroupAccessAll, getResourceInfoWithAcl } from "@inrupt/solid-client";
import { BaseSubject, IndexItem, Permission } from "../../../types";
import { IPermissionManager, SubjectKey } from "../../../types/modules";
import { ODRLPermissionManager } from "./OdrlPermissionManager";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { setAgentAccess } from "@inrupt/solid-client/universal";
import { cacheBustedSessionFetch } from "../../../util";

export class GroupManager<T extends Record<keyof T, BaseSubject<keyof T & string>>> extends ODRLPermissionManager<T> implements IPermissionManager<T> {
    // This is a replacement for https://github.com/inrupt/solid-client-js/blob/eb8e86f61458ec76fa2244f7b38b7d7983bbd810/src/access/wac.ts#L262 because it is not exposed in the inrupt library
    private async getGroupAccessAll(resource: string): Promise<Record<string, Access> | null> {
        const session = getDefaultSession();
        const resourceInfo = await getResourceInfoWithAcl(resource, {
            fetch: cacheBustedSessionFetch(session),
        });
        return getGroupAccessAll(resourceInfo)
    }

    private async updateACL<K extends SubjectKey<T>>(resource: string, subject: T[K], accessModes: Partial<AccessModes>) {
        const session = getDefaultSession();
        if (!subject.selector?.url) {
            throw new Error("Missing url selector on group subject")
        }
        await setAgentAccess(resource, subject.selector.url, accessModes, {
            fetch: session.fetch
        })
    }

    //. NOTE: Currently, it doesn't do any recursive permission setting on containers
    async createPermissions<K extends SubjectKey<T>>(resource: string, subject: T[K], permissions: Permission[]): Promise<void> {
        const accessModes = this.permissionsToAccessModes(permissions, []);
        await this.updateACL(resource, subject, accessModes)
    }

    async deletePermissions<K extends SubjectKey<T>>(resource: string, subject: T[K]) {
        await this.updateACL(resource, subject, {});
    }

    async editPermissions<K extends SubjectKey<T>>(resource: string, item: IndexItem, subject: T[K], permissions: Permission[]) {
        const accessModes = this.editPermissionsToAccessModes(item, permissions);
        await this.updateACL(resource, subject, accessModes)
    }

    type = 'groupManager'
}
