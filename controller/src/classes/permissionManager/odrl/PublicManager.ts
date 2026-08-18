import { ODRLPolicyService } from "../../utils/OdrlPolicyService";
import { BaseSubject, IndexItem, Permission } from "../../../types";
import { IPermissionManager, SubjectKey } from "../../../types/modules";
import { ODRLPermissionManager } from "./OdrlPermissionManager";

export class PublicManager<T extends Record<keyof T, BaseSubject<keyof T & string>>> extends ODRLPermissionManager<T> implements IPermissionManager<T> {

    //. NOTE: Currently, it doesn't do any recursive permission setting on containers
    async createPermissions<K extends SubjectKey<T>>(resource: string, subject: T[K], permissions: Permission[], owner: string): Promise<void> {
        await new ODRLPolicyService(this.authorizationServerURL).insertActionRule(resource, permissions, owner)
    }

    async deletePermissions<K extends SubjectKey<T>>(resource: string, subject: T[K], permissions: Permission[]) {
        await new ODRLPolicyService(this.authorizationServerURL).deleteActionRule(resource, permissions)

    }

    async editPermissions<K extends SubjectKey<T>>(resource: string, item: IndexItem, subject: T[K], permissions: Permission[]) {
        // not needed
    }

    type = 'public'


}
