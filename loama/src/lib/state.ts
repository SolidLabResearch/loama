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
        async refreshEntryPermissions(controller: IController<{ webId: WebIdSubject; public: PublicSubject }>) {
            if (!this.selectedEntry) {
                throw new Error('No selected entry to update permissions for');
            }
            const newResourceInfo = await controller.getResourcePermissionList(this.selectedEntry.id);
        },
        async refreshRequestAccessAllowance(controller: IController<{ webId: WebIdSubject; public: PublicSubject }>) {
            if (!this.selectedEntry) {
                throw new Error('No selected entry to update permissions for');
            }
        },
        async updatePolicy(ruleUpdates: RuleUpdate[], controller: IController<{webId: WebIdSubject; public: PublicSubject;}>) {
            await controller.updatePolicy(ruleUpdates);
            
            this.policies = await controller.getResourcePolicies("");
        },
    }
})
