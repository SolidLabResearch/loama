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
corepack enable
yarn install
yarn build
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
   yarn dev
   ```

### UMA server
```sh
yarn start
```

## Mock policy injection

If no policy matches the target resource, the user interface hides the access request. Run these commands to insert initial policies.

### Windows (PowerShell)


Give Alice append access to Bob's readme, *(This is append since Alice requests read-permissions later in the demo)*
```powershell
curl.exe --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me' --header 'Content-Type: text/plain' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy a odrl:Agreement ; odrl:uid ex:policy ; odrl:permission ex:permission .ex:permission a odrl:Permission ; odrl:action odrl:append ; odrl:target <http://localhost:3000/bob/README> ; odrl:assignee <http://localhost:3000/alice/profile/card#me> ; odrl:assigner <http://localhost:3000/bob/profile/card#me> .'
```

Give bob read acces to Alice's readme
```powershell
curl.exe --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me' --header 'Content-Type: text/turtle' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy1 a odrl:Agreement ; odrl:uid ex:policy1 ; odrl:permission ex:permission1 . ex:permission1 a odrl:Permission ; odrl:action odrl:read ; odrl:target <http://localhost:3000/alice/README> ; odrl:assignee <http://localhost:3000/bob/profile/card#me> ; odrl:assigner <http://localhost:3000/alice/profile/card#me> .'
```

### Unix (Bash/Zsh)

Give Alice append access to Bob's readme, *(This is append since Alice requests read-permissions later in the demo)*
```sh
curl --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me' --header 'Content-Type: text/plain' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy a odrl:Agreement ; odrl:uid ex:policy ; odrl:permission ex:permission .ex:permission a odrl:Permission ; odrl:action odrl:append ; odrl:target <http://localhost:3000/bob/README> ; odrl:assignee <http://localhost:3000/alice/profile/card#me> ; odrl:assigner <http://localhost:3000/bob/profile/card#me> .'
```

Give bob read acces to Alice's readme
```sh
curl --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me' --header 'Content-Type: text/turtle' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy1 a odrl:Agreement ; odrl:uid ex:policy1 ; odrl:permission ex:permission1 . ex:permission1 a odrl:Permission ; odrl:action odrl:read ; odrl:target <http://localhost:3000/alice/README> ; odrl:assignee <http://localhost:3000/bob/profile/card#me> ; odrl:assigner <http://localhost:3000/alice/profile/card#me> .'
```

## Verification workflows

### Session setup
1. Open `http://localhost:5173/` in your standard browser window, use IDP `http://localhost:3000` and authenticate as Bob (`bob@example.org`, `abc123`).
2. Open a private/incognito browser window and authenticate as Alice (`alice@example.org`, `abc123`).

### Testing the denial flow
1. From Alice's session, navigate to the **Request Access** tab and request access to Bob's resource `http://localhost:3000/bob/README`.
2. In Bob's session, navigate to the **Grant Access** tab.
3. Click **Deny**.
4. Confirm that the request is removed from Bob's pending list.

### Testing the approval flow
1. From Alice's session, submit another access request to Bob's resource `http://localhost:3000/bob/README`.
2. In Bob's session under the **Grant Access** tab, click **Accept**.
3. Verify that the request appears in Alice's **Accepted** tab.
4. Verify that the request appears in Bob's **Accepted** tab.

## Deep-linking to a specific access request (Grant Access page)

External clients can redirect a resource owner directly to the **Grant Access** page with a specific incoming request pre-filtered, so they immediately see the one they need to act on.

### How it works

Append a `request` query parameter whose value is the URL-encoded UID of the access request:

```
/access-grants/?request=<url-encoded-request-uid>
```

**Example:**

```
http://localhost:5173/access-grants/?request=http%3A%2F%2Fexample.org%2Fc432df06-9bae-4a20-a21d-0e30833552b0
```

When the parameter is present the page will:

1. Show a **purple filter banner** at the top: *"Active filter: showing only the request you were directed to."*
2. Display **only the matching request**, with the Accept / Deny buttons available as normal.
3. Provide a **"Show all requests"** button inside the banner to clear the filter and return to the full grouped view (Requested / Accepted / Denied).

If the UID in the parameter does not match any known request, a *"The requested access request could not be found."* message is shown instead.

### Usage notes

- The filter is applied purely client-side via the Vue Router query parameter; no server changes are required.
- Clicking **"Show all requests"** removes the `request` parameter from the URL via `router.replace`, so the browser history is not polluted with the filtered URL.
- The feature is intentionally **only on the Grant Access page** (`/access-grants/`). The Request Access page (`/access-requests/`) does not support this parameter.

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
You can evaluate state machine accuracy after an approval using the ``trustflows-client``. *Note we used v0.1.0-alpha.6*

```
yarn add trustflows-client@0.1.0-alpha.6
```

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
