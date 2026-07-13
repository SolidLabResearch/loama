# Seeding Loama and UMA

These commands automate the creation of local policies and access requests between two test accounts (Alice and Bob). 

## Environment configuration

* **Identity Provider:** `http://localhost:3000`
* **Test Accounts:** `bob@example.org`, `alice@example.org`
* **Password:** `abc123`
* **UMA Version:** Repository `SolidLabResearch/user-managed-access` at commit `9b08f27`

## Installation

### Loama setup

```sh
git clone git@github.com:SolidLabResearch/loama.git
cd loama
git checkout feat/odrl
nvm use 20
npm install
npm run build
```

### UMA setup

```sh
git clone git@github.com:SolidLabResearch/user-managed-access.git 
cd user-managed-access
nvm use 22
yarn install
yarn build
```

## Service startup

### Loama application
1. Start the backend services by following the initialization script in the `SolidLabResearch/user-managed-access` README.
2. Launch the development server:
   ```sh
   npm run dev
   ```

### UMA server
```sh
yarn start
```

## Mock policy injection

If no policy matches the target resource, the user interface hides the access request. Run these commands to insert initial policies.

### Windows (PowerShell)

```powershell
curl.exe --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me' --header 'Content-Type: text/plain' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy a odrl:Agreement ; odrl:uid ex:policy ; odrl:permission ex:permission .ex:permission a odrl:Permission ; odrl:action odrl:append ; odrl:target <http://localhost:3000/bob/README> ; odrl:assignee <http://localhost:3000/alice/profile/card#me> ; odrl:assigner <http://localhost:3000/bob/profile/card#me> .'
```
```powershell
curl.exe --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me' --header 'Content-Type: text/turtle' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy1 a odrl:Agreement ; odrl:uid ex:policy1 ; odrl:permission ex:permission1 . ex:permission1 a odrl:Permission ; odrl:action odrl:read ; odrl:target <http://localhost:3000/alice/README> ; odrl:assignee <http://localhost:3000/bob/profile/card#me> ; odrl:assigner <http://localhost:3000/alice/profile/card#me> .'
```

### Unix (Bash/Zsh)

```sh
curl --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me' --header 'Content-Type: text/plain' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy a odrl:Agreement ; odrl:uid ex:policy ; odrl:permission ex:permission .ex:permission a odrl:Permission ; odrl:action odrl:append ; odrl:target <http://localhost:3000/bob/README> ; odrl:assignee <http://localhost:3000/alice/profile/card#me> ; odrl:assigner <http://localhost:3000/bob/profile/card#me> .'
```
```sh
curl --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me' --header 'Content-Type: text/turtle' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy1 a odrl:Agreement ; odrl:uid ex:policy1 ; odrl:permission ex:permission1 . ex:permission1 a odrl:Permission ; odrl:action odrl:read ; odrl:target <http://localhost:3000/alice/README> ; odrl:assignee <http://localhost:3000/bob/profile/card#me> ; odrl:assigner <http://localhost:3000/alice/profile/card#me> .'
```

## Verification workflows

### Session setup
1. Open `http://localhost:5173/` in your standard browser window and authenticate as Bob (`bob@example.org`).
2. Open a private/incognito browser window and authenticate as Alice (`alice@example.org`).

### Testing the denial flow
1. From Alice's session, navigate to the **Request Access** tab and request access to Bob's resource.
2. In Bob's session, navigate to the **Grant Access** tab.
3. Click **Deny**.
4. Confirm that the request is removed from Bob's pending list.

### Testing the approval flow
1. From Alice's session, submit another access request to Bob's resource.
2. In Bob's session under the **Grant Access** tab, click **Accept**.
3. Verify that the request appears in Alice's **Accepted** tab.
4. Verify that the request appears in Bob's **Accepted** tab.

## Known bugs and limitations

* **UI State Sync:** When you update a policy on a selected resource, the interface does not visually refresh until you manually deselect and reselect that resource.

## Direct API validation

### Fallback access request generation (PowerShell)
If the UI buttons fail to create an access request, force execution via the API:

```powershell
curl.exe --% --location "http://localhost:4000/uma/requests" --header "Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me" --header "Content-Type: application/json" --data "{\"resource_id\": \"http://localhost:3000/bob/README\", \"resource_scopes\": [\"http://www.w3.org/ns/odrl/2/read\", \"http://www.w3.org/ns/odrl/2/write\"]}"
```
```powershell
curl.exe --% --location "http://localhost:4000/uma/requests" --header "Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me" --header "Content-Type: application/json" --data "{\"resource_id\": \"http://localhost:3000/alice/README\",\"resource_scopes\": [ \"http://www.w3.org/ns/odrl/2/read\" ]}"
```

### Request checking
You can evaluate state machine accuracy after an approval using the ``trustflows-client``. 

```ts
import { getDefaultAuth, configureDefaultAuth } from "trustflows-client";

async function runClientCredentialsFlow() {
  configureDefaultAuth({
    persistTokens: false, 
  });

  const auth = getDefaultAuth();

  try {
    console.log("Authenticating via Client Credentials...");
    
    await auth.loginClientCredentials(
      "http://localhost:3000/alice/profile/card#me",  // Your WebID
      "alice@example.org",                            // Account email
      "abc123"                                        // Account password
    );

    console.log("Authentication successful.");

    const authFetch = auth.createAuthFetch();
    
    const targetUrl = "http://localhost:3000/bob/README";
    console.log(`Fetching: ${targetUrl}`);
    
    const response = await authFetch(targetUrl);
    const data = await response.text();
    
    console.log("Response status:", response.status);
    console.log("Data payload:", data);

  } catch (error) {
    console.error("Execution failed:", error);
  }
}

runClientCredentialsFlow();
```