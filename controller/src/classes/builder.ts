import { BaseSubject } from "../types";
import { AccessManagement } from "./AccessManagement";
import { IAccessManagementBuilder, IPermissionManager, IStore, ISubjectResolver } from "../types/modules";

export class AccessManagementBuilder<T extends Record<keyof T, S>, S extends BaseSubject<keyof T & string> = T[keyof T]> implements IAccessManagementBuilder<T> {
    private store: IStore | null = null;
    // @ts-expect-error we cannot fill this record at this point
    private subjectResolvers: Record<keyof T, ISubjectResolver<keyof T & string>> = {};
    private permissionManager: IPermissionManager<S> | null = null;

    setStore(store: IStore) {
        this.store = store;
        return this;
    }

    addSubjectResolver<SubjectType extends (keyof T & string)>(subjectType: SubjectType, subjectResolver: ISubjectResolver<SubjectType, BaseSubject<SubjectType>>): IAccessManagementBuilder<T & { [key in SubjectType]: BaseSubject<SubjectType>; }> {
        this.subjectResolvers[subjectType as keyof T] = subjectResolver
        return this;
    }

    setPermissionManager(permissionManager: IPermissionManager<S>) {
        this.permissionManager = permissionManager;
        return this;
    }

    build() {
        if (!this.store) throw new Error("Store is not set")
        if (!this.permissionManager) throw new Error("PermissionManager is not set")
        if (Object.keys(this.subjectResolvers).length == 0) throw new Error("SubjectResolvers are not set")

        return new AccessManagement(this.store, this.permissionManager, this.subjectResolvers)
    }
}
