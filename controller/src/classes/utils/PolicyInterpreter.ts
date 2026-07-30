import { Constraint, ISpecificTargetInfo, Policy, Rule } from "../../types/modules";
import { DataFactory, Store, Writer } from "n3";
import { ODRL } from "./PolicyParser";

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
     * transforms N3 data-store object to Policy object 
     * @param store the fetched policies
     * @param resourceUrl if given, only rules targeting this resource are included
     */
    public storeToPolicies(store: Store, resourceUrl: string = ""): Policy[] {
        const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

        const typeMap: Record<string, Policy['type']> = {
            "http://www.w3.org/ns/odrl/2/Agreement": 'Agreement',
            "http://www.w3.org/ns/odrl/2/Set": 'Set',
        };

        let policies: Policy[] = [];
        const typeQuads = store.getQuads(null, RDF_TYPE, null, null);

        typeQuads.forEach(quad => {
            const polId = quad.subject.value;
            const policy: Policy = {
                id: polId,
                rules: [],
                type: typeMap[quad.object.value]
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

    /**
     * Transform policy object to a turtle-string
     * @param webId 
     * @param policy 
     * @returns 
     */
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
                        let rightValue;

                        if (operand.includes('^^')) {
                            // Typed literal: "value"^^<http://...> or value^^http://...
                            const [valuePart, datatypePart] = operand.split('^^');

                            // Clean surrounding quotes or angle brackets if present
                            const cleanValue = valuePart.replace(/^"|"$/g, '');
                            const cleanDatatype = datatypePart.replace(/^<|>$/g, '');

                            rightValue = literal(cleanValue, namedNode(cleanDatatype));
                        } else if (operand.startsWith('http://') || operand.startsWith('https://')) {
                            // Pure URI / NamedNode
                            rightValue = namedNode(operand);
                        } else {
                            // Plain literal
                            const cleanValue = operand.replace(/^"|"$/g, '');
                            rightValue = literal(cleanValue);
                        }

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