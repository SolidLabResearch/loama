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
     * Place a POST request to create an access request to an UMA backend
     * @param resourceURL - URL of the resource to request access for
     * @param requestingParty - user credentials of the requesting party
     * @param action - the action the user wants to perform on the resource
     */
    public requestAccess = async (resourceURL: string, requestingParty: string, action: string): Promise<void> => {
        const response = await fetch(
            `${this.authorizationServerURL}/requests`, {
                method: 'POST',
                headers: {
                    'authorization': `WebID ${encodeURIComponent(requestingParty)}`
                }, body: await this.accessRequestToJson({
                    uid: uuid(),
                    target: resourceURL,
                    action: action,
                    requestingParty: requestingParty,
                    status: 'requested'
                })
            }
        );

        if (response.status !== 201) throw new Error('failed to create access request');
    }

    private accessRequestToJson = async (accessRequest: AccessRequest): Promise<string> => `
        {
            "resource_id": "${accessRequest.target}",
            "resource_scopes": [ "http://www.w3.org/ns/odrl/2/${accessRequest.action}" ]
        }
    `;

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
        const results: AccessRequest[] = [];

        for await (const binding of bindings) {
            results.push({
                uid: binding.get('uid')?.value!,
                target: binding.get('target')?.value!,
                action: this.cleanValue(binding.get('action')?.value),
                requestingParty: binding.get('requestingParty')?.value!,
                status: this.cleanValue(binding.get('status')?.value),
            })
        }
        
        return results;
    }


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

        SELECT DISTINCT ?uid ?target ?action ?requestingParty ?status
        WHERE {
            ?uid a sotw:EvaluationRequest ;
                 sotw:requestedTarget ?target ;
                 sotw:requestedAction ?action ;
                 sotw:requestingParty <${requestingPartyID}> ;
                 sotw:requestStatus ?status .
        }
    `;

    private readonly accessRequestForResourceOwner = (resourceOwnerID: string): string => `
        PREFIX ex: <http://example.org/>
        PREFIX sotw: <https://w3id.org/force/sotw#>
        PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

        SELECT DISTINCT ?uid ?target ?action ?requestingParty ?status
        WHERE {
            ?policy odrl:target ?target ;
                    odrl:assigner <${resourceOwnerID}> .

            ?uid a sotw:EvaluationRequest ;
                    sotw:requestedTarget ?target ;
                    sotw:requestedAction ?action ;
                    sotw:requestingParty ?requestingParty ;
                    sotw:requestStatus ?status .
        }
    `;
}
