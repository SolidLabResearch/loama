# Seeding Loama + UMA

These commands can be used to create policies for alice and bob, an access requests to eachother. 
This eliminates the needs to manually setup each time.
---
Identity Provider: ``http://localhost:3000``

Emails: ``bob@example.org``, ``alice@example.org``

Pass: ``abc123``

This is designed to work with [uma](https://github.com/SolidLabResearch/user-managed-access) commit ``9b08f27``
and my version of [loama](https://github.com/siltn/loama) branch ``feat/odrl``

## Install

```sh
#loama
git clone git@github.com:siltn/loama.git loama-siltn
cd loama-siltn
git checkout feat/odrl

# for the right node version to install it (if you use nvm)
nvm use 20
npm install
npm run build
```

```sh
#loama
git clone git@github.com:SolidLabResearch/user-managed-access.git 
cd user-managed-access

# for the right node version to install it (if you use nvm)
nvm use 22
yarn install
yarn build
```
## Startup

### LOAMA
Follow startup script of [uma](https://github.com/SolidLabResearch/user-managed-access/blob/main/README.md)

```sh
npm run dev
```

### UMA server

```sh
yarn start
```

## Creating policies (cold start)

### Create mock policies for resources (windows)

If there is no policy related to the resource you won't be able to see the access request.

```powershell
curl.exe --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me' --header 'Content-Type: text/plain' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy a odrl:Agreement ; odrl:uid ex:policy ; odrl:permission ex:permission .ex:permission a odrl:Permission ; odrl:action odrl:append ; odrl:target <http://localhost:3000/bob/README> ; odrl:assignee <http://localhost:3000/alice/profile/card#me> ; odrl:assigner <http://localhost:3000/bob/profile/card#me> .'
```
```powershell
curl.exe --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me' --header 'Content-Type: text/turtle' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy1 a odrl:Agreement ; odrl:uid ex:policy1 ; odrl:permission ex:permission1 . ex:permission1 a odrl:Permission ; odrl:action odrl:read ; odrl:target <http://localhost:3000/alice/README> ; odrl:assignee <http://localhost:3000/bob/profile/card#me> ; odrl:assigner <http://localhost:3000/alice/profile/card#me> .'
```

### Create mock policies for resources (unix)

If there is no policy related to the resource you won't be able to see the access request.

```sh
curl --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me' --header 'Content-Type: text/plain' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy a odrl:Agreement ; odrl:uid ex:policy ; odrl:permission ex:permission .ex:permission a odrl:Permission ; odrl:action odrl:append ; odrl:target <http://localhost:3000/bob/README> ; odrl:assignee <http://localhost:3000/alice/profile/card#me> ; odrl:assigner <http://localhost:3000/bob/profile/card#me> .'
```
```sh
curl --location 'http://localhost:4000/uma/policies' --header 'Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me' --header 'Content-Type: text/turtle' --data-raw '@prefix ex: <http://example.org/>. @prefix odrl: <http://www.w3.org/ns/odrl/2/> . @prefix dct: <http://purl.org/dc/terms/>. ex:policy1 a odrl:Agreement ; odrl:uid ex:policy1 ; odrl:permission ex:permission1 . ex:permission1 a odrl:Permission ; odrl:action odrl:read ; odrl:target <http://localhost:3000/alice/README> ; odrl:assignee <http://localhost:3000/bob/profile/card#me> ; odrl:assigner <http://localhost:3000/alice/profile/card#me> .'
```


## Policy management

After the mock policies, you should see a resource for both Alice and Bob


### Authenticate with bob

go to `http://localhost:5173/` and authenticate with Bobs credentials

IDP: http://localhost:3000
mail: bob@example.org
password: abc123

### Authentice with Alice

Pick another browser (or a private window) and authenticate with Alice her credentials

IDP: http://localhost:3000
mail: alice@example.org
password: abc123

TODO: add some steps to verify the managing -> have policies changed
TODO: add a curl request to view all the policies (verifying it changed)

## Requesting access
NOTE: assumes being authenticated already with Bob and Alice

From Alice her LOAMA session, create an access request to Bob his resource.


Expectation:
You should sent request on the Request Access tab and in Bob his UI, you should in the Grant Access tab an incoming request.


First step: click on deny

Do it again: "From Alice her LOAMA session, create an access request to Bob his resource."

Expected behaviour:
- Alice should see it now in the accepted tab
- Bob should see it in the accepted tab
- Using the trustflows client, Alice should now have access to the resource (TODO:)
- Bob should see in LOAMA the correct permissions in the Edit permissions tab

Extra test: I asked to the same resource now a different action. After clicking accept, this new permission did not get placed
Following things worked:
- Alice should see it now in the accepted tab
- Bob should see it in the accepted tab

What didn't work
- Bob should see in LOAMA the correct permissions in the Edit permissions tab


### Create access requests
In case the requests do not work

mock access requests to validate functionality

```powershell
curl.exe --% --location "http://localhost:4000/uma/requests" --header "Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprofile%2Fcard%23me" --header "Content-Type: application/json" --data "{\"resource_id\": \"http://localhost:3000/bob/README\", \"resource_scopes\": [\"http://www.w3.org/ns/odrl/2/read\", \"http://www.w3.org/ns/odrl/2/write\"]}"
```
```powershell
curl.exe --% --location "http://localhost:4000/uma/requests" --header "Authorization: WebID http%3A%2F%2Flocalhost%3A3000%2Fbob%2Fprofile%2Fcard%23me" --header "Content-Type: application/json" --data "{\"resource_id\": \"http://localhost:3000/alice/README\",\"resource_scopes\": [ \"http://www.w3.org/ns/odrl/2/read\" ]}"
```


## Validation

After accepting the access requests on bob's account, [verify-access-request.ts](../scripts/verify-access-requests/script.ts) can be used to verify the access-requests.

```
cd scripts/verify-access-requests
npm install
npx tsx script.ts
```
