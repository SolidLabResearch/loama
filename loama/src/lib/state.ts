import { type IController, type Policy, type PublicSubject, type RuleUpdate, type WebIdSubject } from "loama-controller";
import { defineStore } from "pinia";

type PodStore = {
    policies: Policy[];
    selectedEntry: Policy | null;
    resources: string[];
}

export const usePodStore = defineStore("pod", {
    state: (): PodStore => ({
        selectedEntry: null,
        policies: [],
        resources: [],
    }),
   actions: {
        async loadResources(controller: IController<{webId: WebIdSubject; public: PublicSubject;}>) {
            this.resources = await controller.getResources();
        },
        async loadPolicies(url: string, controller: IController<{webId: WebIdSubject; public: PublicSubject;}>) {
            this.policies = await controller.getResourcePolicies(url);
        },
        async updatePolicy(ruleUpdates: RuleUpdate[], controller: IController<{webId: WebIdSubject; public: PublicSubject;}>) {
            await controller.updatePolicy(ruleUpdates);

            this.policies = await controller.getResourcePolicies("");
        },
    }
})
