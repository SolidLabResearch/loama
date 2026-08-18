import { BaseSubject, Index, Permission, Resources } from "../types";
import { IController, IInboxConstructor, IStore, IStoreConstructor, SubjectConfig, SubjectConfigs, SubjectKey, SubjectType } from "../types/modules";
import { type AccessRequest as AccessRequestObject, Policy, Rule, RuleUpdate } from "../types/modules";
import { Mutex } from "./utils/Mutex";
import { ODRLAccessRequestService } from "./utils/OdrlAccessRequestService";
import { ODRLPolicyService } from "./utils/OdrlPolicyService";
import { PolicyInterpreter } from "./utils/PolicyInterpreter";
import { v4 as uuidv4 } from 'uuid';

/**
 * Controller which makes it calls to the backend AS through ODRL requests.
 * Makes use of the Inrupt SDK to authenticate users.
 */
export class ODRLController<T extends Record<keyof T, BaseSubject<keyof T & string>>> extends Mutex implements IController<T> {
    private index: IStore<Index<T[keyof T & string]>>;
    private resources: IStore<Resources>;
    private subjectConfigs: SubjectConfigs<T>;
    private authorizationServerURL: string;

    // TODO : Find a better way of constructing the controller with all the different modules
    constructor(storeConstructor: IStoreConstructor, inboxConstructor: IInboxConstructor, subjects: SubjectConfigs<T>, authorizationServerURL: string) {
        super();
        // There is currently no "easy" solution to get around the as IStore...
        this.index = new storeConstructor("index.json", () => ({ id: "", items: [] })) as IStore<Index<T[keyof T & string]>>;
        this.resources = new storeConstructor("resources.json", () => ({ id: "", items: [] })) as IStore<Resources>;;
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
     * Updates existing policies according to present rule changes
     * @param updates All requested changes
     * @returns
     */
    async updatePolicy(updates: RuleUpdate[]): Promise<void> {

        if (updates.length === 0) return;

        const service = new ODRLPolicyService(this.authorizationServerURL);

        const store = await service.fetchPolicies();
        const interpreter = new PolicyInterpreter();
        const allPolicies = interpreter.storeToPolicies(store);

        const policiesMap = new Map<string, Policy>(allPolicies.map(p => [p.id, p]));
        const modifiedPolicyIds = new Set<string>();

        for (const update of updates) {
            if (!update.policyId){
                if(update.updateType == 'add'){
                    //create policy
                    const policy: Policy = {
                        id: `http://example.org/${uuidv4()}`,
                        rules: [update.rule],
                        type: 'Set'
                    };

                    policiesMap.set(policy.id, policy);
                    modifiedPolicyIds.add(policy.id);
                }
                continue;

            }
            const policy = policiesMap.get(update.policyId);
            if (!policy) continue;
            const ruleIndex = policy.rules.findIndex(r => r.id === update.rule.id);

            if(update.rule.id == ""){
                update.rule.id = `http://example.org/${update.policyId}-Rule-${uuidv4()}`;
            }


            if (update.updateType === 'remove' && ruleIndex !== -1) {
                policy.rules.splice(ruleIndex, 1);
                modifiedPolicyIds.add(policy.id);
            } else if (update.updateType === 'edit' && ruleIndex !== -1) {
                policy.rules[ruleIndex] = update.rule;
                modifiedPolicyIds.add(policy.id);
            } else if (update.updateType === 'add') {
                if (ruleIndex === -1) policy.rules.push(update.rule);
                else policy.rules[ruleIndex] = update.rule;
                modifiedPolicyIds.add(policy.id);
            }
        }

        const savePromises = Array.from(modifiedPolicyIds).map(async (policyId) => {
            const policy = policiesMap.get(policyId)!;
            if(policy.rules.length == 0){
                await service.deletePolicy(policyId);
            }
            else{
                // Convert JS Policy object back to Turtle format
                const turtleText = interpreter.policyToTurtle(policy);
                await service.putPolicy(policyId, turtleText);
            }
        });

        await Promise.all(savePromises);
    }

    /**
     * Get all policies the logged in user has control over
     * @param resourceUrl Not Implemented - Can be used to filter down in multi-pod scenarios
     * @returns Policy object
     */
    async getResourcePolicies(resourceUrl: string): Promise<Policy[]> {
        const store = await new ODRLPolicyService(this.authorizationServerURL).fetchPolicies();
        return new PolicyInterpreter().storeToPolicies(store, resourceUrl);
    }


    async enablePermissions<K extends SubjectKey<T>>(resource: string, subject: SubjectType<T, K>) {
        // won't fix
    }

    async disablePermissions<K extends SubjectKey<T>>(resourceUrl: string, subject: SubjectType<T, K>) {
        // won't fix
    }

    isSubjectSupported<K extends string, B extends BaseSubject<K>>(subject: BaseSubject<K>): IController<Record<K, B>> {
        if (!this.subjectConfigs[subject.type as unknown as keyof T]) {

            throw new Error(`Subject type ${subject.type} is not supported`);
        }
        return this as unknown as IController<Record<K, B>>
    }

    // ! added for access requests
    async requestAccess(permission: { accessRequest: AccessRequestObject}): Promise<void> {
        return new ODRLAccessRequestService(this.authorizationServerURL).requestAccess(permission.accessRequest);
    }

    async handleAccessRequest(requestId: string, status: 'accepted' | 'denied'): Promise<void> {
        return new ODRLAccessRequestService(this.authorizationServerURL).acceptOrDenyAccess(requestId, status);
    }

    async getAccessRequests(): Promise<{
        asRequestingParty: AccessRequestObject[];
        asResourceOwner: AccessRequestObject[];
    }> {
        return new ODRLAccessRequestService(this.authorizationServerURL).retrieveAccessRequests();
    }
}
