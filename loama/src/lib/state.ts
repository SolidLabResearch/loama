import { type IController, type Policy, type PublicSubject, type RuleUpdate, type WebIdSubject } from "loama-controller";
import { defineStore } from "pinia";

type PodStore = {
    policies: Policy[];
    selectedEntry: Policy | null;
}

export const usePodStore = defineStore("pod", {
    state: (): PodStore => ({
        selectedEntry: null,
        policies: [],
    }),
   actions: {
        async loadResources(url: string, controller: IController<{webId: WebIdSubject; public: PublicSubject;}>) {
            this.policies = await controller.getResourcePolicies(url);
        },
        async updatePolicy(ruleUpdates: RuleUpdate[], controller: IController<{webId: WebIdSubject; public: PublicSubject;}>) {
            await controller.updatePolicy(ruleUpdates);
            
            this.policies = await controller.getResourcePolicies("");
        },
    }
})
