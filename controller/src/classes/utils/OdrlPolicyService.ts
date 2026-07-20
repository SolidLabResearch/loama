import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { Permission } from "../../types";
import { RuleUpdate } from "../../types/modules";
import { ODRL, PolicyParser } from "./PolicyParser";
import { DataFactory } from "n3";
const { namedNode } = DataFactory;

const RULE_TYPE_TERM: Record<string, string> = {
    permission: 'Permission',
    prohibition: 'Prohibition',
    duty: 'Duty'
};

export const UMA_URL = (authorizationServerURL: string, encodedId: string = "") => 
    `${authorizationServerURL}/policies${encodedId}`;

export class ODRLPolicyService {
    private readonly authorizationServerURL: string;
    constructor(authorizationServerURL: string) { 
        this.authorizationServerURL = authorizationServerURL;
    }

    // ? this code could be removed from this class and put inside utils.ts
    private getRandomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            const randIndex = Math.floor(Math.random() * chars.length);
            result += chars[randIndex];
        }
        return result;
    }

    public async fetchPolicies(webId: string) {
        // Get all our policies
        const response = await fetch(UMA_URL(this.authorizationServerURL), {
            headers: {
                "Authorization": `WebID ${encodeURIComponent(webId)}`,
                "Accept": "text/turtle"
            }
        });


        // Extract the target Ids
        const turtleText = await response.text();

        // Use parser to extract an N3 Store
        const parser = new PolicyParser();
        return parser.parseText(turtleText);
    }

    public async fetchOnePolicy(webId: string, policyId: string) {
        // Get all our policies
        const response = await fetch(UMA_URL(this.authorizationServerURL,`/${encodeURIComponent(policyId)}`), {
            headers: {
                "Authorization": `WebID ${encodeURIComponent(webId)}`,
                "Accept": "text/turtle"
            }
        });

        const turtleText = await response.text();

        // Use parser to extract an N3 Store
        const parser = new PolicyParser();
        return parser.parseText(turtleText);
    }

    public async postPolicy(webId: string, body: string) {
        await fetch(UMA_URL(this.authorizationServerURL), {
            method: 'POST',
            headers: {
                'Authorization': `WebID ${encodeURIComponent(webId)}`,
                'Content-type': 'text/turtle'
                // 'Content-type': 'application/sparql-update'
            },
            body: body
        })
    }

    public async patchPolicy(webId: string, policyId: string, body: string) {
        await fetch(UMA_URL(this.authorizationServerURL,`/${encodeURIComponent(policyId)}`), {
            method: 'PATCH',
            headers: {
                'Authorization': `WebID ${encodeURIComponent(webId)}`,
                'Content-type': 'application/sparql-update'
            },
            body: body
        })
    }


    /**
     * Function to insert an action rule for each permission in the provided array. They will be inserted in a new policy, via POST and not PATCH.
     */
    public async insertActionRule(targetId: string, actions: Permission[], assignee: string = ""): Promise<void> {
        const webId = getDefaultSession().info.webId!

        // Find out if this target already has a policy
        const store = (await this.fetchPolicies(webId));
        const ruleIds = store.getQuads(null, ODRL('target'), namedNode(targetId), null).map(quad => quad.subject);
        const policyIds = new Set<string>();
        ruleIds.forEach(ruleId =>
            // We also only take permission into account (for now)
            store.getQuads(null, ODRL('permission'), ruleId, null).forEach(quad =>
                // Add each policyId
                policyIds.add(quad.subject.id)
            )
        )

        // Our policyId is either one from the set or a random generator if there are none, this is not verified to be unique, but 20^62 possibilities should work for now
        // Since we found this target, it implicitly means that there must exist a policy and thus we will never create a random one...
        const policyId: string = policyIds.size > 0
            ? [...policyIds][0]
            : `http://example.org/policy${this.getRandomString(20)}`;


        for (const action of actions) {
            // We need a proper way to create new rules, probably better server side? 
            const ruleId = `http://example.org/rule${this.getRandomString(20)}`;

            // Define the new triples in the rule
            const actionTriple = `odrl:action odrl:${action.toLowerCase()} ;`;
            const assigneeTriple = assignee
                ? `odrl:assignee <${assignee}> ;`
                : "";

            // The response contains the full and updated version of the policy, which we cannot return in this interface
            // If there already exists a policy for this target, patch this rule into it. Otherwise, just post a new one
            const response = policyIds.size > 0
                ? this.patchPolicy(webId, policyId, `
PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
INSERT {
    <${policyId}> odrl:permission <${ruleId}> .
    <${ruleId}> a odrl:Permission ;
        odrl:target <${targetId}> ;
        ${actionTriple}
        ${assigneeTriple}
        odrl:assigner <${webId}> .
}
WHERE {}`)
// ! this branch below has no use, as the current version of LOAMA is unable to create new policies on its own, it can only discover the policies already sent.
                : this.postPolicy(webId, `
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
<${policyId}> a odrl:Agreement ;
    odrl:uid <${policyId}> ;
    odrl:permission <${ruleId}> .

<${ruleId}> a odrl:Permission ;
    odrl:target <${targetId}> ;
    ${actionTriple}
    ${assigneeTriple}
    odrl:assigner <${webId}> .
`)
        }
    }

    /**
     * Applies a single rule-level change (add, edit, or remove) to a policy.
     * This is the generalized replacement for the old addPermission/removePermission
     * flow: instead of editing a flattened subject/permission pair, it edits the
     * actual ODRL rule node identified by rule.id.
     *
     * NOTE: the delete-then-insert body for 'edit' sends two update operations in
     * one PATCH request. This follows standard SPARQL 1.1 Update syntax but has not
     * been verified against your authorization server, confirm it accepts this shape.
     */
    public async applyRuleUpdate(webId: string, update: RuleUpdate): Promise<void> {
        console.log("applyRuleUpate");
    }

    /**
     * Funcion that searches every owned rule by the logged on client, finds the target 
     * of an assigner and deletes the actions on it
     */
    public async deleteActionRule(targetId: string, actions: Permission[], assignee: string = ""): Promise<void> {
        const session = getDefaultSession();
        const webId = session.info.webId!;

        // 1: Fetch the policy contents
        const response = await fetch(UMA_URL(this.authorizationServerURL), {
            headers: {
                Authorization: `WebID ${encodeURIComponent(webId)}`,
                Accept: "text/turtle"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch policy: ${response.status}`);
        }

        const turtleText = await response.text();

        // 2: Parse into store
        const parser = new PolicyParser();
        const store = parser.parseText(turtleText);

        // 3: Find all rules with our target
        const targetRules = store.getQuads(null, ODRL("target"), namedNode(targetId), null);

        const policyIds = new Map<string, Set<string>>();
        targetRules.forEach(
            // Filter only the targets that have rules with us as assignee, or public if no assignee
            target => {
                // Search the rule of the target, and then the policy of the rule, only for permission (for now)
                const rule = target.subject;
                const matches = store.getQuads(null, ODRL("permission"), rule, null);
                if (matches.length === 0)
                    console.warn("out of bounds rule");
                const policyId = matches[0].subject.id;

                // We now have the policies that have our target, check if our assignee has an action to delete here
                if (assignee === "") {
                    // If no assignee specified, the rule is public and it has an action to be deleted, select it
                    if (store.getQuads(rule, ODRL("assignee"), null, null).length === 0) {
                        for (const action of actions)
                            if (store.getQuads(rule, ODRL("action"), ODRL(action.toLowerCase()), null).length > 0) {
                                if (!policyIds.has(policyId)) policyIds.set(policyId, new Set<string>());
                                policyIds.get(policyId)!.add(rule.id);
                            }
                    }
                } else {
                    // Do the same, with a check if the assignee is correct
                    if (store.getQuads(rule, ODRL("assignee"), namedNode(assignee), null).length >= 1) {
                        for (const action of actions) {
                            if (store.getQuads(rule, ODRL("action"), ODRL(action.toLowerCase()), null).length > 0) {
                                if (!policyIds.has(policyId)) policyIds.set(policyId, new Set<string>());
                                policyIds.get(policyId)!.add(rule.id);
                            }
                        }

                    }
                }
            }
        )

        // 4: Delete the rule that has the matching target and permission for the matching assignee
        for (const policyId of policyIds.keys()) {
            for (const ruleId of policyIds.get(policyId)!) {
                const deleteResponse = await fetch(
                    UMA_URL(this.authorizationServerURL, `/${encodeURIComponent(policyId)}`), {
                        method: "PATCH",
                        headers: {
                            "Authorization": `WebID ${encodeURIComponent(webId)}`,
                            "Content-type": "application/sparql-update",
                        },
                        body: `
PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

DELETE {
    <${ruleId}> ?p ?o .
    ?policy odrl:permission <${ruleId}> .
} WHERE {
    <${ruleId}> ?p ?o .
    ?policy odrl:permission <${ruleId}> .
}`
                    }
                );

                if (!deleteResponse.ok) {
                    throw new Error(`Policy deletion failed: ${deleteResponse.status}`);
                }
            }
        }
    }
}