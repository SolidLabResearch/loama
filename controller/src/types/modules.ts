import { SolidDataset, WithResourceInfo } from "@inrupt/solid-client";
import { AccessRequestMessage, BaseSubject, Index, IndexItem, Permission, RequestResponseMessage, ResourceAccessRequestNode, ResourcePermissions, SubjectPermissions } from "../types";

export type SubjectKey<T> = keyof T & string;
export type SubjectType<T, K extends SubjectKey<T>> = T[K];
export type EnforceKeyMatchResolver<T extends Record<string, BaseSubject<string>>> = {
    [K in keyof T]: T[K] extends BaseSubject<K & string> ? ISubjectResolver<T[K]> : never;
}
export type SubjectConfig<T extends Record<keyof T, BaseSubject<keyof T & string>>, B extends T[keyof T] = T[keyof T]> = { resolver: ISubjectResolver<B>, manager: IPermissionManager<T> };
export type SubjectConfigs<T extends Record<keyof T, BaseSubject<keyof T & string>>> = Record<keyof T, SubjectConfig<T, T[keyof T]>>;

export interface IController<T extends Record<keyof T, BaseSubject<keyof T & string>>> {
    setPodUrl(podUrl: string): Promise<void>;
    unsetPodUrl(podUrl: string): void;
    getLabelForSubject<K extends SubjectKey<T>>(subject: T[K]): string;
    getOrCreateIndex(): Promise<Index>;
    
    updatePolicy(updates: RuleUpdate[]): Promise<void>;
    getResourcePolicies(resourceUrl: string): Promise<Policy[]>;
    
    /**
    * Enables a the permissions for an existing subject
    * @throws Error if the item does not exist for the given subject
    */
    enablePermissions<K extends SubjectKey<T>>(resource: string, subject: SubjectType<T, K>): Promise<void>
    disablePermissions<K extends SubjectKey<T>>(resource: string, subject: SubjectType<T, K>): Promise<void>

    isSubjectSupported<T extends string>(subject: BaseSubject<T>): IController<Record<T, BaseSubject<T>>>

    // ! added for access requests
    requestAccess(permission: { accessRequest: AccessRequest}): Promise<void>;
    handleAccessRequest(requestId: string, status: string): Promise<void>;
    getAccessRequests(): Promise<{ asRequestingParty: AccessRequest[]; asResourceOwner: AccessRequest[]; }>;
}

export interface IInboxConstructor<T = unknown> {
    new(filePath: string): IInbox<T>
}

export interface IStoreConstructor<T = unknown> {
    new(filePath: string, templateGenerator: () => T): IStore<T>
}

export interface IStore<T> {
    /**
    * Implemented by BaseStore
    * Will set the protected pod url property
    */
    setPodUrl(url: string): void;
    /**
    * Removes the pod url property value
    */
    unsetPodUrl(): void;
    getPodUrl(): string | undefined;

    getDataUrl(): string;

    /**
    * Returns the currently stored data or calls getOrCreate if the data is not set
    */
    getCurrent(): Promise<T>;

    /**
    * Tries to retrieve the stored file from the pod. If it doesn't exist, it creates an empty one.
    */
    getOrCreate(): Promise<T>;
    /**
    * Saves the data to the pod
    */
    saveToRemote(): Promise<void>;
}

export interface IInbox<T = unknown> extends IStore<T[]> {
    getMessages(): Promise<Record<string, SolidDataset & WithResourceInfo>>;
}

export interface ISubjectResolver<T extends BaseSubject<string>> {
    /**
    *  @returns a human-readable label for the subject
    */
    toLabel(subject: T): string;
    checkMatch(subjectA: T, subjectB: T): boolean;
    /**
    * @returns a reference to index item for the given resource and subject
    */
    getItem(index: Index<T>, resourceUrl: string, subjectSelector?: unknown): IndexItem<T> | undefined
}

export interface IPermissionManager<T = Record<string, BaseSubject<string>>> {
    // Does not update the index file
    createPermissions<K extends SubjectKey<T>>(resource: string, subject: T[K], permissions: Permission[]): Promise<void>
    // Does not update the index file
    editPermissions<K extends SubjectKey<T>>(resource: string, item: IndexItem, subject: T[K], permissions: Permission[]): Promise<void>
    deletePermissions<K extends SubjectKey<T>>(resource: string, subject: T[K], permissions: Permission[]): Promise<void>
    shouldDeleteOnAllRevoked(): boolean
    type: string;
}

// Temporal (?) interface to represent a policy
export interface IPolicy {
    rules: IRule[];
    id: string;
}

export type RuleType = 'Permission' | 'Prohibition';

// Temporal (?) interface to represent a rule within a policy
export interface IRule {
    // What kind of rule is this
    ruleType: RuleType;

    // Every rule has one assigner represented by its webID
    assigner: string;

    // Multiple assignees possible
    assignees: string[];

    // What actions does this rule definine?
    permissions: string[];

    // target objects of the rule
    targets: string[];

    // ID
    id: string;
}

export interface Constraint {
	leftOperand: string;
	operator: string;
	rightOperand: string[];
}


// interface to represent access requests
export interface AccessRequest {
    uid: string;
    target: string;
    actions: string[];
    constraint: Constraint[];
    requestingParty: string;
    status: string;
}

// The interface to display the permissions for one subject on one target
export interface ISpecificTargetInfo {

    // Indicate whether its public
    public: boolean;

    // The uri of the target
    uri: string;

    // The client that has permission over this target
    subject: string;

    // the actions set to the target
    permissions: Set<Permission>;
}

// A target can have multiple private subjects and a public subject
export interface TargetSubjects {
    targetUrl: string;

    // The map of subject names and their permissions on this target
    private?: Map<string, ISpecificTargetInfo>;

    // The public permission settings for this target
    public?: ISpecificTargetInfo;

    // WebID of the target owner
    assigner: string;

    // The policies referring to this target
    policies: Set<string>;

    // The rules referring to this target
    rules: Set<string>;
}

export type RuleUpdateType = 'add' | 'edit' | 'remove';

export interface RuleUpdate {
    updateType: RuleUpdateType;
    rule: Rule;
    policyId: string | null
}


export interface Rule {
    id: string;
    type: RuleType;
    subjectId: string;
    action: string[];
    resourceIdentifier: string;
    constraint: Constraint[]
}

export interface Policy {
    id: string;
    rules: Rule[];
    type: PolicyType;
}

export type PolicyType = 'Agreement' | 'EvaluationRequest';
