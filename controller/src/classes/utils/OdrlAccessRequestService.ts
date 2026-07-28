import { AccessRequest } from "@/types/modules";
import { QueryEngine } from "@comunica/query-sparql";
import { Parser, Store, Writer } from "n3";
import { v4 as uuid } from 'uuid';

export class ODRLAccessRequestService {
    
    private readonly queryEngine = new QueryEngine();
    private readonly parser = new Parser({ format: 'text/turtle' });
    
    constructor(
        private readonly authorizationServerURL: string
    ) {}

    /**
     * Place a POST request to create an access request to an UMA backend
     * @param AccessRequest - contains all infromation regarding an access request
     */
    public requestAccess = async (accessRequest: AccessRequest): Promise<void> => {
        console.log("requesting-access");
        const response = await fetch(
            `${this.authorizationServerURL}/requests`, {
                method: 'POST',
                headers: {
                    'authorization': `WebID ${encodeURIComponent(accessRequest.requestingParty)}`
                }, body: await this.accessRequestToJson(accessRequest)
            }
        );

        if (response.status !== 201) throw new Error('failed to create access request');
    }

    private accessRequestToJson = async (accessRequest: AccessRequest): Promise<string> => {
        console.log("AR")
        console.log(accessRequest);
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
     * @param resourceOwner - user credentials of the resource owner
     * @param status - new status for the update, must either be 'accepted' or 'denied'
     */
    public acceptOrDenyAccess = async (
        accessRequestID: string,
        resourceOwner: string,
        status: 'accepted' | 'denied'
    ): Promise<void> => {
        const response = await fetch(
            `${this.authorizationServerURL}/requests/${encodeURIComponent(accessRequestID)}`, {
                method: 'PATCH',
                headers: {
                    'authorization': `WebID ${encodeURIComponent(resourceOwner)}`,
                    'content-type': 'application/json'
                }, body: JSON.stringify({ status: status })
            }
        );

        if (response.status !== 204) throw new Error('failed to patch access request');
    }

    /**
     * Retrieve all access requests related to the given resource owner or requesting party
     * @param resourceOwnerOrRequestingPartyID - ID of the resource owner or requesting party
     */
    public retrieveAccessRequests = async (resourceOwnerOrRequestingPartyID: string): Promise<{ asRequestingParty: AccessRequest[], asResourceOwner: AccessRequest[] }> => {
        const [ requestsResponse, policiesResponse ] = await Promise.all(
            ['/requests', '/policies'].map((endpoint) => fetch(
                `${this.authorizationServerURL}${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'authorization': `WebID ${encodeURIComponent(resourceOwnerOrRequestingPartyID)}`
                    }
                }
            ))
        );

        if (requestsResponse.status === 404) return {
            asRequestingParty: [],
            asResourceOwner: []
        }

        const requestsText = await requestsResponse.text() || '';
        const policiesText = await policiesResponse.text() || '';

        const requestsStore = new Store(this.parser.parse(requestsText));
        const policiesStore = new Store(this.parser.parse(policiesText));

        const requestingPartyBindings = await this.queryEngine.queryBindings(
            this.accessRequestForRequestingParty(resourceOwnerOrRequestingPartyID), { sources: [requestsStore] }
        );

        const resourceOwnerBindings = await this.queryEngine.queryBindings(
            this.accessRequestForResourceOwner(resourceOwnerOrRequestingPartyID), { sources: [requestsStore, policiesStore] }
        );

        return {
            asRequestingParty: await this.bindingsToAccessRequest(requestingPartyBindings),
            asResourceOwner: await this.bindingsToAccessRequest(resourceOwnerBindings)
        };
    }

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

    private readonly accessRequestForRequestingParty = (requestingPartyID: string): string => `
        PREFIX ex: <http://example.org/>
        PREFIX sotw: <https://w3id.org/force/sotw#>
        PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

        SELECT ?uid ?target ?requestingParty ?status 
            (GROUP_CONCAT(DISTINCT ?action; separator=",") AS ?actions)
            ?constraintUri ?leftOperand ?operator ?rightOperand
        WHERE {
            ?uid a sotw:EvaluationRequest ;
                sotw:requestedTarget ?target ;
                sotw:requestedAction ?action ;
                sotw:requestingParty <${requestingPartyID}> ;
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

    private readonly accessRequestForResourceOwner = (resourceOwnerID: string): string => `
        PREFIX ex: <http://example.org/>
        PREFIX sotw: <https://w3id.org/force/sotw#>
        PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

        SELECT ?uid ?target ?requestingParty ?status 
            (GROUP_CONCAT(DISTINCT ?action; separator=",") AS ?actions)
            ?constraintUri ?leftOperand ?operator ?rightOperand
        WHERE {
            ?policy odrl:target ?target ;
                    odrl:assigner <${resourceOwnerID}> .

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
