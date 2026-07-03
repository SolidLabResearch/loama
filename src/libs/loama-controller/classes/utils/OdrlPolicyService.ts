import { Permission } from "../../types";
import { ODRL, PolicyParser } from "./PolicyParser";
import { DataFactory } from "n3";
import { getAuthenticatedWebId, getBearerAuthorizationHeader } from "./auth";
const { namedNode } = DataFactory;
const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

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

    private getOdrlActions(permission: Permission) {
        if (permission === Permission.Write) {
            return [ODRL('write'), ODRL('modify')];
        }

        return [ODRL(permission.toLowerCase())];
    }

    private getOdrlActionNameForInsert(permission: Permission) {
        return permission === Permission.Write ? 'modify' : permission.toLowerCase();
    }

    private isClientGeneratedRuleId(ruleId: string) {
        return ruleId.startsWith('http://example.org/rule');
    }

    private ruleMatchesAssignee(ruleId: string, assignee: string, store: ReturnType<PolicyParser['parseText']>) {
        if (assignee === "") {
            return store.getQuads(namedNode(ruleId), ODRL("assignee"), null, null).length === 0;
        }

        return store.getQuads(namedNode(ruleId), ODRL("assignee"), namedNode(assignee), null).length > 0;
    }

    public async fetchPolicies(_webId: string) {

        // Get all our policies
        const response = await fetch(UMA_URL(this.authorizationServerURL), {
            headers: {
                "Authorization": await getBearerAuthorizationHeader(),
                "Accept": "text/turtle"
            }
        });

        // Extract the target Ids
        const turtleText = await response.text();

        // Use parser to extract an N3 Store
        const parser = new PolicyParser();
        return parser.parseText(turtleText);
    }

    public async fetchOnePolicy(_webId: string, policyId: string) {
        // Get all our policies
        const response = await fetch(UMA_URL(this.authorizationServerURL,`/${encodeURIComponent(policyId)}`), {
            headers: {
                "Authorization": await getBearerAuthorizationHeader(),
                "Accept": "text/turtle"
            }
        });

        const turtleText = await response.text();

        // Use parser to extract an N3 Store
        const parser = new PolicyParser();
        return parser.parseText(turtleText);
    }

    public async postPolicy(webId: string, body: string) {
        const response = await fetch(UMA_URL(this.authorizationServerURL), {
            method: 'POST',
            headers: {
                'Authorization': await getBearerAuthorizationHeader(),
                'Content-type': 'text/turtle'
                // 'Content-type': 'application/sparql-update'
            },
            body: body
        })

        if (!response.ok) {
            throw new Error(`Policy creation failed: ${response.status}`);
        }
    }

    public async patchPolicy(webId: string, _policyId: string, body: string) {
        const response = await fetch(UMA_URL(this.authorizationServerURL), {
            method: 'PATCH',
            headers: {
                'Authorization': await getBearerAuthorizationHeader(),
                'Content-type': 'application/sparql-update'
            },
            body: body
        })

        if (!response.ok) {
            throw new Error(`Policy update failed: ${response.status}`);
        }
    }


    /**
     * Function to insert an action rule for each permission in the provided array. They will be inserted in a new policy, via POST and not PATCH.
     */
    public async insertActionRule(targetId: string, actions: Permission[], assignee: string = ""): Promise<void> {
        const webId = getAuthenticatedWebId();
        const policyType = assignee ? ODRL('Agreement') : ODRL('Set');

        // Find out if this target already has a policy
        const store = (await this.fetchPolicies(webId));
        const ruleIds = store.getQuads(null, ODRL('target'), namedNode(targetId), null).map(quad => quad.subject);
        const policyIds = new Set<string>();
        ruleIds.forEach(ruleId =>
            // We also only take permission into account (for now)
            store.getQuads(null, ODRL('permission'), ruleId, null).forEach(quad =>
                // Add each policyId
                {
                    const policyId = quad.subject.id;
                    if (store.getQuads(namedNode(policyId), RDF_TYPE, policyType, null).length > 0) {
                        policyIds.add(policyId);
                    }
                }
            )
        )

        // Our policyId is either one from the set or a random generator if there are none, this is not verified to be unique, but 20^62 possibilities should work for now
        // Since we found this target, it implicitly means that there must exist a policy and thus we will never create a random one...
        const policyId: string = policyIds.size > 0
            ? [...policyIds][0]
            : `http://example.org/policy${this.getRandomString(20)}`;


        for (const action of actions) {
            const matchingRule = ruleIds.find(ruleId =>
                this.ruleMatchesAssignee(ruleId.id, assignee, store)
                && this.getOdrlActions(action).some(odrlAction => store.getQuads(ruleId, ODRL('action'), odrlAction, null).length > 0)
            );
            if (matchingRule) continue;

            // We need a proper way to create new rules, probably better server side? 
            const ruleId = `http://example.org/rule${this.getRandomString(20)}`;

            // Define the new triples in the rule
            const actionTriple = `odrl:action odrl:${this.getOdrlActionNameForInsert(action)} ;`;
            const assigneeTriple = assignee
                ? `odrl:assignee <${assignee}> ;`
                : "";

            // The response contains the full and updated version of the policy, which we cannot return in this interface
            // If there already exists a policy for this target, patch this rule into it. Otherwise, just post a new one
            if (policyIds.size > 0) {
                await this.patchPolicy(webId, policyId, `
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
            }
// ! this branch below has no use, as the current version of LOAMA is unable to create new policies on its own, it can only discover the policies already sent.
            else {
                await this.postPolicy(webId, `
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
<${policyId}> a odrl:${assignee ? 'Agreement' : 'Set'} ;
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
    }

    /**
     * Funcion that searches every owned rule by the logged on client, finds the target 
     * of an assigner and deletes the actions on it
     */
    public async deleteActionRule(targetId: string, actions: Permission[], assignee: string = ""): Promise<void> {
        const webId = getAuthenticatedWebId();

        // 1: Fetch the policy contents
        const response = await fetch(UMA_URL(this.authorizationServerURL), {
            headers: {
                Authorization: await getBearerAuthorizationHeader(),
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

        const ruleCandidates = new Map<Permission, Map<string, Set<string>>>();
        const addRuleCandidate = (action: Permission, policyId: string, ruleId: string) => {
            if (!ruleCandidates.has(action)) ruleCandidates.set(action, new Map<string, Set<string>>());
            if (!ruleCandidates.get(action)!.has(policyId)) ruleCandidates.get(action)!.set(policyId, new Set<string>());
            ruleCandidates.get(action)!.get(policyId)!.add(ruleId);
        }

        targetRules.forEach(
            // Filter only the targets that have rules with us as assignee, or public if no assignee
            target => {
                // Search the rule of the target, and then the policy of the rule, only for permission (for now)
                const rule = target.subject;
                const matches = store.getQuads(null, ODRL("permission"), rule, null);
                if (matches.length === 0) {
                    console.warn("out of bounds rule");
                    return;
                }
                const policyId = matches[0].subject.id;

                // We now have the policies that have our target, check if our assignee has an action to delete here
                if (assignee === "") {
                    // If no assignee specified, the rule is public and it has an action to be deleted, select it
                    if (store.getQuads(rule, ODRL("assignee"), null, null).length === 0) {
                        for (const action of actions)
                            if (this.getOdrlActions(action).some(odrlAction => store.getQuads(rule, ODRL("action"), odrlAction, null).length > 0)) {
                                addRuleCandidate(action, policyId, rule.id);
                            }
                    }
                } else {
                    // Do the same, with a check if the assignee is correct
                    if (store.getQuads(rule, ODRL("assignee"), namedNode(assignee), null).length >= 1) {
                        for (const action of actions) {
                            if (this.getOdrlActions(action).some(odrlAction => store.getQuads(rule, ODRL("action"), odrlAction, null).length > 0)) {
                                addRuleCandidate(action, policyId, rule.id);
                            }
                        }

                    }
                }
            }
        )

        const policyIds = new Map<string, Set<string>>();
        ruleCandidates.forEach(policyRules => {
            const serverRuleIds = [...policyRules.values()]
                .flatMap(ruleIds => [...ruleIds])
                .filter(ruleId => !this.isClientGeneratedRuleId(ruleId));

            policyRules.forEach((ruleIds, policyId) => {
                const selectedRuleIds = serverRuleIds.length > 0
                    ? [...ruleIds].filter(ruleId => !this.isClientGeneratedRuleId(ruleId))
                    : [...ruleIds];

                for (const ruleId of selectedRuleIds) {
                    if (!policyIds.has(policyId)) policyIds.set(policyId, new Set<string>());
                    policyIds.get(policyId)!.add(ruleId);
                }
            });
        });

        // 4: Delete the rule that has the matching target and permission for the matching assignee
        for (const policyId of policyIds.keys()) {
            for (const ruleId of policyIds.get(policyId)!) {
                const deleteResponse = await fetch(
                    UMA_URL(this.authorizationServerURL), {
                        method: "PATCH",
                        headers: {
                            "Authorization": await getBearerAuthorizationHeader(),
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
