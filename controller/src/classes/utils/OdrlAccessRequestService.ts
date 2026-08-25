import { authenticatedFetch, getLoggedInIdentifier } from './Authentication';
import { AccessRequest } from "@/types/modules";
import { QueryEngine } from "@comunica/query-sparql";
import { Parser, Store } from "n3";
import { v4 as uuid } from 'uuid';

export class ODRLAccessRequestService {

    private readonly queryEngine = new QueryEngine();
    private readonly parser = new Parser({ format: 'text/turtle' });

    constructor(
        private readonly authorizationServerURL: string
    ) {}

    /**
     * Place a POST request to create an access request to a UMA backend
     * @param accessRequest - all information regarding an access request
     */
    public requestAccess = async (accessRequest: AccessRequest): Promise<void> => {
        const response = await authenticatedFetch(
            `${this.authorizationServerURL}/requests`, {
                method: 'POST',
                body: await this.accessRequestToJson(accessRequest)
            }
        );

        if (response.status !== 201) throw new Error('failed to create access request');
    }

    /**
     * Transform accessrequest to required JSON format
     * @param accessRequest - all information regarding an access request
     * @returns
     */
    private accessRequestToJson = async (accessRequest: AccessRequest): Promise<string> => {
        const payload: any = {
            resource_id: accessRequest.target,
            resource_scopes:
            accessRequest.actions.map(action =>
            action.startsWith('http') ? action : `http://www.w3.org/ns/odrl/2/${action}`
        )
        };

        const constraintsList: any[] = [];

        if (accessRequest.constraint && accessRequest.constraint.length > 0) {
            accessRequest.constraint.forEach(con => {
                constraintsList.push([
                    con.leftOperand,
                    con.operator,
                    con.rightOperand[0] //ToDo Work with list
                ]);
            });
        }

        if (constraintsList.length > 0) {
            payload.constraints = constraintsList;
        }

        return JSON.stringify(payload, null, 12);
    };

    /**
     * Place a PATCH request to update an access request to an UMA backend
     * @param accessRequestID - ID of the access request to update
     * @param status - new status for the update, must either be 'accepted' or 'denied'
     */
    public acceptOrDenyAccess = async (
        accessRequestID: string,
        status: 'accepted' | 'denied'
    ): Promise<void> => {
        const response = await authenticatedFetch(
            `${this.authorizationServerURL}/requests/${encodeURIComponent(accessRequestID)}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json'
                }, body: JSON.stringify({ status: status })
            }
        );

        if (response.status !== 204) throw new Error('failed to patch access request');
    }

    /**
     * Retrieve all access requests related to the given resource owner or requesting party
     */
    public retrieveAccessRequests = async (owned: string[]): Promise<{ asRequestingParty: AccessRequest[], asResourceOwner: AccessRequest[] }> => {
        const requestsResponse = await authenticatedFetch(`${this.authorizationServerURL}/requests`);

        if (requestsResponse.status === 404) return {
            asRequestingParty: [],
            asResourceOwner: []
        }

        const requestsText = await requestsResponse.text() || '';

        const requestsStore = new Store(this.parser.parse(requestsText));

        const id = getLoggedInIdentifier();
        const requestingPartyBindings = await this.queryEngine.queryBindings(
            this.accessRequestForRequestingParty(id), { sources: [requestsStore] }
        );

        const resourceOwnerBindings = await this.queryEngine.queryBindings(
            this.accessRequestForResourceOwner(owned), { sources: [requestsStore] }
        );

        return {
            asRequestingParty: await this.bindingsToAccessRequest(requestingPartyBindings),
            asResourceOwner: await this.bindingsToAccessRequest(resourceOwnerBindings)
        };
    }

    /**
     * Transform raw bindings to AccessRequest objects
     * @param bindings
     * @returns
     */
    private bindingsToAccessRequest = async (bindings: any): Promise<AccessRequest[]> => {
        const requestsMap = new Map<string, AccessRequest>();

        for await (const binding of bindings) {
            const uid = binding.get('uid')?.value;
            if (!uid) continue;

            if (!requestsMap.has(uid)) {
                const rawActions = binding.get('actions')?.value ?? '';
                const actions = rawActions
                    ? rawActions.split(',').map((act: string) => this.cleanValue(act))
                    : [];

                requestsMap.set(uid, {
                    uid,
                    target: binding.get('target')?.value ?? '',
                    actions,
                    constraint: [],
                    requestingParty: binding.get('requestingParty')?.value ?? '',
                    status: this.cleanValue(binding.get('status')?.value),
                });
            }

            const request = requestsMap.get(uid)!;

            const leftOperand = binding.get('leftOperand')?.value;
            const operator = binding.get('operator')?.value;
            const rightOperand = binding.get('rightOperand')?.value;

            if (leftOperand && operator && rightOperand) {
                const cleanLeft = this.cleanValue(leftOperand);
                const cleanOp = this.cleanValue(operator);
                const cleanRight = this.cleanValue(rightOperand);

                let existingConstraint = request.constraint.find(
                    c => c.leftOperand === cleanLeft && c.operator === cleanOp
                );

                if (!existingConstraint) {
                    existingConstraint = {
                        leftOperand: cleanLeft,
                        operator: cleanOp,
                        rightOperand: []
                    };
                    request.constraint.push(existingConstraint);
                }

                if (!existingConstraint.rightOperand.includes(cleanRight)) {
                    existingConstraint.rightOperand.push(cleanRight);
                }
            }
        }

        return Array.from(requestsMap.values());
    };


    /**
     * Retrieves last part of URI.
     * @param val - URI
     */
    private readonly cleanValue = (val?: string): string => {
        if (!val) return '';
        const match = val.match(/([^/#]+)$/);
        return (match ? match[1] : val).toLowerCase();
    }

    /**
     * Fetches all access requests submitted by a given WebId
     * Returns a SPARQL query string
     * @param requestingPartyID
     * @returns
     */
    private readonly accessRequestForRequestingParty = (requestingPartyID: string): string => `
        PREFIX ex: <http://example.org/>
        PREFIX sotw: <https://w3id.org/force/sotw#>
        PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

        SELECT ?uid ?target ?requestingParty ?status 
            (GROUP_CONCAT(DISTINCT ?action; separator=",") AS ?actions)
            ?constraintUri ?leftOperand ?operator ?rightOperand
        WHERE {
            VALUES ?requestingParty { <${requestingPartyID}> }
        
            ?uid a sotw:EvaluationRequest ;
                sotw:requestedTarget ?target ;
                sotw:requestedAction ?action ;
                sotw:requestingParty ?requestingParty ;
                sotw:requestStatus ?status .

            OPTIONAL {
                ?uid odrl:constraint ?constraintUri .
                ?constraintUri a odrl:Constraint ;
                            odrl:leftOperand ?leftOperand ;
                            odrl:operator ?operator ;
                            odrl:rightOperand ?rightOperand .
            }
        }
        GROUP BY ?uid ?target ?requestingParty ?status ?constraintUri ?leftOperand ?operator ?rightOperand
    `;

    /**
     * Fetches all access requests controlled by a given WebId
     * Returns a SPARQL query string
     *
     * @returns
     */
    private readonly accessRequestForResourceOwner = (owned: string[]): string => `
        PREFIX ex: <http://example.org/>
        PREFIX sotw: <https://w3id.org/force/sotw#>
        PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

        SELECT ?uid ?target ?requestingParty ?status 
            (GROUP_CONCAT(DISTINCT ?action; separator=",") AS ?actions)
            ?constraintUri ?leftOperand ?operator ?rightOperand
        WHERE {
            VALUES ?target { ${owned.map(o => `<${o}>`).join(' ')} }
            
            ?uid a sotw:EvaluationRequest ;
                sotw:requestedTarget ?target ;
                sotw:requestedAction ?action ;
                sotw:requestingParty ?requestingParty ;
                sotw:requestStatus ?status .

            OPTIONAL {
                ?uid odrl:constraint ?constraintUri .
                ?constraintUri a odrl:Constraint ;
                            odrl:leftOperand ?leftOperand ;
                            odrl:operator ?operator ;
                            odrl:rightOperand ?rightOperand .
            }
        }
        GROUP BY ?uid ?target ?requestingParty ?status ?constraintUri ?leftOperand ?operator ?rightOperand
    `;
}
