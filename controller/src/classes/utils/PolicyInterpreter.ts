import { Permission } from "../../types/";
import { Constraint, IPolicy, ISpecificTargetInfo, Policy, PolicyType, RuleType, Rule, TargetSubjects } from "../../types/modules";
import { DataFactory, Parser, Store, Writer } from "n3";
import { ODRL } from "./PolicyParser";
//import { Rule } from "@inrupt/solid-client/acp/rule";

const { namedNode, literal } = DataFactory;

export class PolicyInterpreter {
    private fromODRL = (odrlString: string) => odrlString.split('/')[6];
    private defaultTarget = (uri: string, subject: string = ""): ISpecificTargetInfo => ({ uri: uri, permissions: new Set(), subject: subject, public: subject === "" })

    /**
    * Extract the quads of one subject, and recursively add whatever their object is referring to
    * @param store store to extract subject from
    * @param subjectIRI 
    * @param existing IDs that have already been added to the store
    * @returns detailed store of the original subject and all of their children
    */
    private extractQuadsRecursive(store: Store, subjectIRI: string, existing: Set<string> = new Set([subjectIRI])): Store {
        // Add the direct quads to the store
        const result = new Store();
        const subjectQuads = store.getQuads(subjectIRI, null, null, null);
        result.addQuads(subjectQuads);

        // If objects are not already added, add their quads and their children
        for (const quad of subjectQuads) {
            if (!existing.has(quad.object.id)) {
                existing.add(quad.object.id);
                result.addQuads(this.extractQuadsRecursive(store, quad.object.id, existing).getQuads(null, null, null, null));
            }
        }
        return result;
    }

    /**
     * Function that returns the stored Target objects without sanitization
     * This function assumes all policies are correct, and only contains information for the logged on client
     * 
     * Currently, it does not check the rule type (permission, prohibition, duty) and it only takes permission into account
     * @param store the owned policies in a store
     * @returns the target -> subjects -> permissions relation for all owned targets
     */
    public ownedPoliciesToObject = (store: Store, specifiedTarget: string = ""): TargetSubjects[] => {
    }

    // Return the subject -> permissions relation for a target
    public permissionsForOneResource(resourceUrl: string, store: Store): TargetSubjects {
    }

    private readonly ruleRelations: RuleType[] = ['permission', 'prohibition', 'duty'];

    private extractConstraints(ruleStore: Store, ruleId: string): Constraint[] {
    }

    /**
     * Unflattened version of permissionsForOneResource. Instead of collapsing every rule
     * into a single subject -> permissions map, this keeps the real policy/rule structure
     * so the UI (and updatePolicy) can operate on actual ODRL rules.
     *
     * A single ODRL rule can list multiple assignees. Since Rule only carries one
     * subjectId, a rule with N assignees is expanded into N Rule entries that share
     * the same id. A rule with no assignee becomes one Rule with subjectId "" (public).
     *
     * @param store the fetched policies
     * @param resourceUrl if given, only rules targeting this resource are included
     */
    public storeToPolicies(store: Store, resourceUrl: string = ""): Policy[] {
        let policies: Policy[] = [];
        const policyNodes = store.getQuads(null, namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), namedNode("http://www.w3.org/ns/odrl/2/Agreement"), null);
        const policyIds = policyNodes.map(quad => quad.subject.value);

        policyIds.forEach(polId => {
            const policy: Policy = {
                id: polId,
                rules: [],
                type: 'Agreement'
            };

            const permissionNodes = store.getObjects(namedNode(polId), ODRL("permission"), null);
            const permissionIds = permissionNodes.map(node => node.value);
            permissionIds.forEach(permId => {
                const permNamedNode = namedNode(permId);
                const actionNodes = store.getObjects(permNamedNode, ODRL("action"), null);
                const targetNodes = store.getObjects(permNamedNode, ODRL("target"), null);
                const assigneeNodes = store.getObjects(permNamedNode, ODRL("assignee"), null);
                const assignerNodes = store.getObjects(permNamedNode, ODRL("assigner"), null);
                const constraintNodes = store.getObjects(permNamedNode, ODRL("constraint"), null);

                const actions = actionNodes.map(node => node.value);
                const targets = targetNodes.map(node => node.value); 
                const assignees = assigneeNodes.map(node => node.value);
                const assigners = assignerNodes.map(node => node.value);
                const constraintIds = constraintNodes.map(node => node.value);

                const permission: Rule = {
                    id: permId,
                    type: 'Permission',
                    subjectId: assignees[0],
                    action: actions,
                    resourceIdentifier: targets[0],
                    constraint: []
                }
                
                constraintIds.forEach(constrId =>{
                    const constrNamedNode = namedNode(constrId);
                    const leftOperandNodes = store.getObjects(constrNamedNode, ODRL("leftOperand"), null);
                    const operatorNodes = store.getObjects(constrNamedNode, ODRL("operator"), null);
                    const rightOperandNodes = store.getObjects(constrNamedNode, ODRL("rightOperand"), null);
                    
                    const leftOperand = leftOperandNodes[0]?.value;
                    const operator = operatorNodes[0]?.value;
                    const rightOperand = rightOperandNodes.map(node => node.value);

                    const constraint: Constraint = {
                        leftOperand: leftOperand,
                        operator: operator,
                        rightOperand: rightOperand
                    };

                    permission.constraint.push(constraint);
                });
                policy.rules.push(permission);
            });
            policies.push(policy);
        });

        return policies;
    }

    public policyToTurtle(webId: string, policy: Policy): string {
        const ODRL = 'http://www.w3.org/ns/odrl/2/';
        const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

        const writer = new Writer({
            prefixes: {
            odrl: ODRL,
            ex: 'http://example.org/'
            }
        });

        const policyNode = namedNode(policy.id);

        // 1. Policy Type & UID
        writer.addQuad(policyNode, namedNode(RDF_TYPE), namedNode(`${ODRL}${policy.type}`));
        writer.addQuad(policyNode, namedNode(`${ODRL}uid`), policyNode);

        // 2. Rules
        for (const rule of policy.rules) {
            const ruleNode = namedNode(rule.id);
            const ruleTypePredicate = rule.type.toLowerCase();

            writer.addQuad(policyNode, namedNode(`${ODRL}${ruleTypePredicate}`), ruleNode);
            writer.addQuad(ruleNode, namedNode(RDF_TYPE), namedNode(`${ODRL}${rule.type}`));

            if (rule.resourceIdentifier) {
            writer.addQuad(ruleNode, namedNode(`${ODRL}target`), namedNode(rule.resourceIdentifier));
            }

            if (rule.subjectId) {
            writer.addQuad(ruleNode, namedNode(`${ODRL}assignee`), namedNode(rule.subjectId));
            }

            writer.addQuad(ruleNode, namedNode(`${ODRL}assigner`), namedNode(webId));

            if (rule.action && rule.action.length > 0) {
            for (const act of rule.action) {
                const actionURI = act.startsWith('http') ? act : `${ODRL}${act}`;
                writer.addQuad(ruleNode, namedNode(`${ODRL}action`), namedNode(actionURI));
            }
            }

            // 3. Constraints
            if (rule.constraint && rule.constraint.length > 0) {
            for (let i = 0; i < rule.constraint.length; i++) {
                const constraint = rule.constraint[i];
                const constraintNode = namedNode(`${rule.id}/constraint/${i + 1}`);

                writer.addQuad(ruleNode, namedNode(`${ODRL}constraint`), constraintNode);
                writer.addQuad(constraintNode, namedNode(RDF_TYPE), namedNode(`${ODRL}Constraint`));

                if (constraint.leftOperand) {
                const leftUri = constraint.leftOperand.startsWith('http')
                    ? constraint.leftOperand
                    : `${ODRL}${constraint.leftOperand}`;
                writer.addQuad(constraintNode, namedNode(`${ODRL}leftOperand`), namedNode(leftUri));
                }

                if (constraint.operator) {
                const opUri = constraint.operator.startsWith('http')
                    ? constraint.operator
                    : `${ODRL}${constraint.operator}`;
                writer.addQuad(constraintNode, namedNode(`${ODRL}operator`), namedNode(opUri));
                }

                if (constraint.rightOperand && constraint.rightOperand.length > 0) {
                for (const operand of constraint.rightOperand) {
                    const isUri = operand.startsWith('http://') || operand.startsWith('https://');
                    const rightValue = isUri ? namedNode(operand) : literal(operand);
                    writer.addQuad(constraintNode, namedNode(`${ODRL}rightOperand`), rightValue);
                }
                }
            }
            }
        }

        let turtleText = '';
        writer.end((error, result) => {
            if (error) throw error;
            turtleText = result;
        });

        return turtleText;
    }

}