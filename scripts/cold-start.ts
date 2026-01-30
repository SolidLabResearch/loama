/**
 * This script serves to solve the cold start problem for LOAMA.
 * It creates a new policy with one or more actions attached to the same target and assignee.
 * Based on the examples provided in the UMA AMA policy management documentation.
 */

import { v4 as uuidv4 } from 'uuid';
import * as readline from 'node:readline';

const defaultAssignee = process.env.ASSIGNEE_IRI || "https://example.pod.knows.idlab.ugent.be/profile/card#me";
const defaultAssigner = process.env.ASSIGNER_IRI || "https://example.pod.knows.idlab.ugent.be/profile/card#me";

const getRandomName = () => uuidv4();
const getRandomResourceName = () =>
    `${process.env.RESOURCE_SERVER || 'http://localhost:3000/'}resources/${uuidv4()}`;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askBasicQuestion = async (question: string) => {
    return new Promise<string>((resolve) => {
        rl.question(question, (answer: string) => resolve(answer.trim()));
    });
};

const askWebId = async () => askBasicQuestion('Please provide your own WebID for authorization: ');
const askPolicyName = async () => askBasicQuestion('What do you want to name your policy? ');
const askTargetURL = async () => askBasicQuestion('Please enter the URL to the resource: ');
const askAssigneeId = async () => askBasicQuestion(`Please provide the WebID for the assignee: `);

const askActions = async () => {
    const answer = await askBasicQuestion(
        'Enter actions to associate (comma separated). Options: read, write, append, create, control: '
    );
    
    const actions = answer
        .split(",")
        .map(a => a.trim().toLowerCase())
        .filter(a => a); // remove empty entries

    return actions.length === 0 ? ['read'] : actions;
};

const main = async () => {
    console.log("To use default ENV vars, leave empty.");

    const webid = await askWebId() || defaultAssigner;
    const policy = await askPolicyName() || process.env.POLICY || getRandomName();
    const target = await askTargetURL() || process.env.RESOURCE_URL || getRandomResourceName();
    const assignee = await askAssigneeId() || defaultAssignee;

    const actions = await askActions();

    rl.close();

    let rules: string[] = [];
    let ruleRefs: string[] = [];

    for (const action of actions) {
        const rule = getRandomName();

        rules.push(`
        ex:${rule} a odrl:Permission ;
                   odrl:action odrl:${action} ;
                   odrl:target <${target}> ;
                   odrl:assignee <${assignee}> ;
                   odrl:assigner <${webid}> .`);

        ruleRefs.push(`ex:${rule}`);
    }

    const body = `
        @prefix ex: <http://example.org/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        @prefix dct: <http://purl.org/dc/terms/>.

        ex:${policy} a odrl:Agreement ;
                     ${ruleRefs.map(r => `odrl:permission ${r} ;`).join("\n                     ")}
                     odrl:uid ex:${policy} .
        ${rules.join("\n")}
    `;

    console.log(`\nPOST request with body\n${body}`);

    const response = await fetch(`${process.env.AUTHORIZATION_SERVER || 'http://localhost:4000/'}uma/policies`, {
        method: 'POST',
        headers: {
            'Authorization': `WebID ${encodeURIComponent(webid)}`,
            'Content-Type': 'text/turtle'
        },
        body: body
    });

    if (response.ok) {
        console.log('Policy added successfully');
    } else {
        console.log('Something went wrong! Try again.', response.status);
    }
};

main();
