import { authenticatedFetch, getLoggedInIdentifier } from './Authentication';
import { AccessRequest, Constraint } from '@/types/modules';
import { Parser, Store } from 'n3';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const ODRL = 'http://www.w3.org/ns/odrl/2/';
const SOTW = 'https://w3id.org/force/sotw#';

export class ODRLAccessRequestService {

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
                const rightOperand = con.rightOperand.length === 1
                    ? con.rightOperand[0]
                    : con.rightOperand;
                constraintsList.push([
                    con.leftOperand,
                    con.operator,
                    rightOperand
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

        const accessRequests = this.storeToAccessRequests(requestsStore);
        console.log(accessRequests);

        return {
            asRequestingParty: accessRequests.filter(req => req.requestingParty === id),
            asResourceOwner: accessRequests.filter(req => owned.includes(req.target)),
        };
    }

    private storeToAccessRequests = (store: Store): AccessRequest[] => {
        const requests: AccessRequest[] = [];

        const lists = store.extractLists();
        for (const node of store.getSubjects(RDF_TYPE, `${SOTW}EvaluationRequest`, null)) {
            const uid = node.value;
            const target = store.getObjects(node, `${SOTW}requestedTarget`, null)[0]?.value;
            const actions = store.getObjects(node, `${SOTW}requestedAction`, null).map(obj => obj.value);
            const requestingParty = store.getObjects(node, `${SOTW}requestingParty`, null)[0]?.value;
            const status = store.getObjects(node, `${SOTW}requestStatus`, null)[0]?.value.slice(SOTW.length);
            if (!uid || !target || !requestingParty || !status || actions.length === 0) continue;

            let constraints: Constraint[] = [];
            for (const constraintNode of store.getObjects(node, `${ODRL}constraint`, null)) {
                const leftOperand = store.getObjects(constraintNode, `${ODRL}leftOperand`, null)[0]?.value;
                const operator = store.getObjects(constraintNode, `${ODRL}operator`, null)[0]?.value;
                const rightOperand = store.getObjects(constraintNode, `${ODRL}rightOperand`, null)[0]?.value;
                const rightOperands = lists[rightOperand] ? lists[rightOperand].map(term => term.value) : [rightOperand];
                if (!leftOperand || !operator || rightOperands.length === 0) continue;

                constraints.push({
                    type: 'ODRL',
                    leftOperand,
                    operator,
                    rightOperand: rightOperands,
                });
            }

            requests.push({
                uid,
                target,
                actions,
                constraint: constraints,
                requestingParty,
                status,
            });
        }
        return requests;
    }
}
