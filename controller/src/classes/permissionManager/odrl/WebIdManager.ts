import { BaseSubject, IndexItem, Permission } from "../../../types";
import { IPermissionManager, SubjectKey } from "../../../types/modules";
import { ODRLPermissionManager } from "./OdrlPermissionManager";
import { ODRLPolicyService } from "../../utils/OdrlPolicyService";

export class WebIdManager<T extends Record<keyof T, BaseSubject<keyof T & string>>> extends ODRLPermissionManager<T> implements IPermissionManager<T> {

    // Create an action for this resource and this subject with the given permissions
    async createPermissions<K extends SubjectKey<T>>(resource: string, subject: T[K], permissions: Permission[], owner: string): Promise<void> {
        await new ODRLPolicyService(this.authorizationServerURL).insertActionRule(resource, permissions, subject.selector!.url, owner);
    }

    async deletePermissions<K extends SubjectKey<T>>(resource: string, subject: T[K], permissions: Permission[]) {
        await new ODRLPolicyService(this.authorizationServerURL).deleteActionRule(resource, permissions, subject.selector!.url)
    }

    async editPermissions<K extends SubjectKey<T>>(resource: string, item: IndexItem, subject: T[K], permissions: Permission[]) {
        // not needed
    }

    type = "webId"
}
