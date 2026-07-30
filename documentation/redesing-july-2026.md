# Loama Redesign 2026

Documentation of the changes and implementation decisions made during the redesign, covering PR #49 ("Update to work with current UMA api / Feat/odrl").

## Motivation

The old interface only supported access level specifications, which didn't reflect the underlying nuances present in Solid.

**Now supported:**
- Multi-rule policies
- Access requests
- Constraints

**Known limitations:**
- Prohibitions can be selected as a rule type, but this isn't implemented functionally yet.
- The interface can only display purpose or temporal restrictions.

## Architecture

### State management (`state.ts`)

Policy access using a pod store.

- `loadPolicies`: retrieves and stores all policies in `Policies[]`.
- `updatePolicy`: handles all changes on a policy (create, update, delete) at the rule layer, and updates policy state accordingly.

### Composables and helpers

- `Accesslevel.ts`: determines the most intrusive rule inside a category.
- `policyGrouping.ts`: flattens policies to rule level and allows grouping by assignee, resource, or policy.
- `Purposes.ts`: stores a hardcoded list of possible purposes selectable in forms.
- `Usetomselect.ts`: transforms a multiselect into an accessible interface.

### Views

- `GroupEntry.vue`: formats elements in a table.
- `GroupExplorer.vue`: table with filter logic and base functionality.
- `PolicyDetail.vue`: shows a policy with all existing rules, plus add/delete functionality.
- `RuleForm.vue`: CRUD screen for rules.
- `SelectedGroup.vue`: lists all rules present in a filtered subcategory.
- `HomeView.vue`: root page for the policy view.

### Controller (`OdrlController.ts`)

Handles local management of policies.

**Added:**
- `updatePolicy(updates: RuleUpdate[])`: applies rule-level updates (add, edit, remove) to existing policies. For updates without a `policyId` it creates a new policy from the given rule. For existing policies it locates the rule by id and applies the requested change, generating a rule id when needed. Modified policies are then either deleted (if left with no rules) or converted back to Turtle via `PolicyInterpreter.policyToTurtle` and pushed to the authorization server with `putPolicy`.
- `getResourcePolicies(resourceUrl)`: returns all policies the logged-in user has control over, fetched from the authorization server and parsed via `PolicyInterpreter.storeToPolicies`.
- `requestAccess`: reworked to accept a full access request object instead of a bare action/resource pair, so the requesting party's WebID is attached before the request is sent.

**Removed** (relied on the old subject/permission data structure):
- `getItem`, `addPermission`, `removePermission`, `removeSubject`
- `getContainerPermissionList`, `getResourcePermissionList`
- The `AccessRequest()` accessor and the whole `IAccessRequest` abstraction it exposed

### API service (`OdrlPolicyService.ts`)

Handles API communication with the authorization server.

**Added:**
- `putPolicy(webId, policyId, body)`: PUT request used to create a policy or push an updated set of rules.
- `deletePolicy(webId, policyId)`: DELETE request used once a policy has no rules left.

### Policy interpreter (`PolicyInterpreter.ts`)

**Added:**
- `storeToPolicies(store, resourceUrl?)`: rebuilds `Policy`/`Rule` objects directly from the N3 store (permissions, actions, targets, assignees/assigners, and constraints), optionally filtered to a single resource.
- `policyToTurtle(webId, policy)`: serializes a `Policy` object back to Turtle for API calls, including constraint triples (`leftOperand`, `operator`, `rightOperand`).

**Removed:**
- `ownedPoliciesToObject`: flattened policies into a target-to-subject-to-permission map, which dropped rule- and constraint-level detail needed by the new UI.
- `permissionsForOneResource`: could potentially be reintroduced later for optimization.

### Access request service (`OdrlAccessRequestService.ts`)

- Access requests moved from single-action, Turtle-encoded bodies to a JSON payload (`accessRequestToJson`) supporting multiple `actions` and a list of `constraints`, sent as `resource_id` / `resource_scopes` / `constraints` to the `/requests` endpoint.
- The SPARQL queries used to read back requests (`accessRequestForRequestingParty`, `accessRequestForResourceOwner`) were updated to `GROUP_CONCAT` multiple actions per request and to `OPTIONAL`ly join constraint triples, and `bindingsToAccessRequest` now folds those bindings into `actions[]` and `constraint[]` per request instead of one row per action.

### Type changes (`types/modules.ts`)

- `RuleType` narrowed from `'permission' | 'prohibition' | 'duty'` to `'Permission' | 'Prohibition'` (duty dropped, isn't the right place for it).
- New types: `Constraint`, `Rule`, `Policy`, `PolicyType`, `RuleUpdate`, `RuleUpdateType`.
- `AccessRequest` changed from a single `action: string` to `actions: string[]` plus `constraint: Constraint[]`.
- `IController` updated to match the methods above; `IAccessRequest` interface removed entirely.

### Removed subsystems

The old subject/permission-manager based UI was removed in favor of the new rule/policy-grouped UI:
- `accessRequests/AccessRequest.ts` and `accessRequests/OdrlAccessRequest.ts` (the old access-request permission-manager classes)
- `permissionManager/odrl/GroupManager.ts` and `permissionManager/odrl/OdrlPermissionManager.ts`
- The old explorer components: `ExplorerBreadcrumbs.vue`, `ExplorerEntity.vue`, `ExplorerEntry.vue`, `FallbackExplorer.vue`, `NewSubject.vue`, `ResourceExplorer.vue`, `SelectedEntry.vue`, `SubjectPermissionTable.vue`
- `subjectForms.ts` and its `Public.vue` / `WebId.vue` forms

These are superseded by the `policy-view` components listed above (`Groupentry`, `Groupexplorer`, `PolicyDetail`, `RuleForm`, `Selectedgroup`) and by `access-requests/AccessRequest.vue` and `AccessRequestEntry.vue`, which were substantially rewritten to work with the new multi-action, constraint-aware request model.

A new `documentation/access-requests.md` was added to document the access-request flow in more detail.

## Design choises

Adding a new rule creates a policy of type 'Set', policies via access-request are 'Agreement'.
Policies of type 'Set' allow rules without a assignee this makes them funcionally public rules.

'Agreement' policies are locked to one assignee for all rules, this also can't be changed later on.


## ToDo

- Bulk edit / Bulk export (Dev mode) would be useful
- Dead/unused code (`insertActionRule` in `OdrlPolicyService.ts`): some unused functions are still present since they weren't causing issues. Whether they're still needed should be checked separately.
- `getResourcePolicies(resourceUrl)`: no functionality in place for the `resourceUrl` param yet, left in place for when multi-pod ownership is supported.
- `enablePermissions` / `disablePermissions` in `OdrlController.ts` are stubbed (`won't fix`), check if they're still needed or should be removed.
- Prohibitions are selectable as a rule type but not functionally implemented

## Creating and testing policies via the interface

Policy creation no longer requires the seeding script or manual curls, LOAMA can create policies directly from the UI.

**UMA version:** see [user-managed-access PR #96](https://github.com/SolidLabResearch/user-managed-access/pull/96)

### Step by step

### Step by step

0. Log in with one of the test accounts, IDP `http://localhost:3000`, `bob@example.org` or `alice@example.org`, password `abc123`.
1. On the home screen, click **New rule**. This creates a new policy.
2. From a second account, submit an access request for the same resource. The access-request only shows up as if LOAMA already knows about the resource from an existing policy, requests for unlisted resources won't appear.
3. Accept the request. The resulting policy is now listed as well.
4. Creating a policy without an assignee makes it a public rule.

### Validating policies

- Use the `trustflows-client`, same approach as in the [access-request testing doc](./access-requests.md).
- Public rules can also be validated directly in the browser, Aslong as they only use timeconstraints.

### Navigating the interface

- Selecting a policy in the right-hand table opens the policy overview, where you can create, edit, and delete rules on that policy.
- Selecting a rule opens the rule info/management screen.

### Test resources

The current UMA setup only has a few resources for each user, replace `Base/` with either `http://localhost:3000/bob/` or `http://localhost:3000/alice/`:

- `Base/profile/card`
- `Base/profile/`
- `Base/README`
- `Base/`

`profile` and `profile/card` are already public by default, so use `README` or the account root (e.g. `bob/`) if you want to test non-public policies.