# User, Plugin, and ACL Authorization

## Three Separate Concepts

1. **Plugin loading:** `PluginLoader` imports and instantiates every direct `.js` child of `plugins/`. It does not consult users or ACLs.
2. **Authorization decision:** `AccessControlPlugin.canAccess()` evaluates a user/action/resource against datastore ACL records.
3. **Enforcement:** the caller must invoke `canAccess()` before performing the protected operation and deny the operation when it returns `false`.

Only item 2 is implemented as a reusable service. Current plugin methods and the dashboard request handler do not automatically call it. ACL configuration by itself therefore does not secure an endpoint or plugin function. Do not claim that a user is effectively restricted until call sites are wired to enforce the decision.

## Inputs and Identity Resolution

Call signature:

```js
await accessControl.canAccess(userId, resourceId, action, resourceType);
```

`resourceType` defaults to `plugin`. A missing user returns `false`. The subject list is formed from:

- the direct user (`subjectType: "user"`, subject ID = `userId`, organization = `user.organizationId`);
- each group listed in `user.groupIds` (`subjectType: "group"`, subject ID = group ID, organization = `group.organizationId` or the user's organization).

The organization's ID scopes matching ACL entries; organization membership is not itself an ACL subject. User `roles` are not consulted. The method does not recursively expand nested groups.

## ACL Record Shape

Stored in `data/acls/<acl-id>.json` and usually configured in the top-level `acls` array:

```json
{
  "id": "monitorer-read-only",
  "subjectType": "user",
  "subjectId": "monitorer",
  "resourceType": "*",
  "resourceId": "*",
  "action": "read",
  "effect": "allow",
  "organizationId": "org-platform"
}
```

Fields:

- `subjectType`: currently queried as `user` or `group`.
- `subjectId`: must match the user ID or group ID.
- `organizationId`: must match the subject's organization scope when that scope is present. Current matching treats a missing scope as no organization filter, so validate that real users and groups have an organization assigned.
- `resourceType`: exact type such as `plugin` or `data-area`, or `*`.
- `resourceId`: exact resource such as `vm-orchestrator`, or `*` for the wildcard-resource lookup.
- `action`: exact caller-supplied action string, or `*`.
- `effect`: `allow` returns true; any other value on a matching entry returns false.

## Current Evaluation Order

For the direct user, then each group, `canAccess()`:

1. Finds ACLs matching subject, organization, resource type (exact or `*`), and exact resource ID.
2. For those ACLs, returns on the first action match (`action` exact or `*`); result is true only for `effect: "allow"`.
3. If no exact-resource action matched, searches the same subject and organization for `resourceId: "*"`, also accepting exact or wildcard resource type.
4. Returns on the first wildcard-resource action match.
5. Continues to the next group if no entry matched; returns false if no subject grants the action.

There is no explicit deny-priority rule or conflict resolution across user and group entries. A matching entry returns immediately, so avoid conflicting ACLs for the same subject/resource/action. Missing or unmatched policy is deny-by-default.

## Examples

`monitorer` has a wildcard resource type and ID but only the literal action `read`:

- `canAccess("monitorer", "vm-orchestrator", "read", "plugin")` returns true.
- `canAccess("monitorer", "users", "read", "data-area")` returns true.
- `canAccess("monitorer", "vm-orchestrator", "deleteVm", "plugin")` returns false.
- `canAccess("monitorer", "vm-orchestrator", "listVirtualMachines", "plugin")` also returns false; `read` is not interpreted as a family of method names.

`testmaster` has `action: "*"` entries for `secrets-manager` and `vm-orchestrator`, so any action checked for those resource IDs is allowed by the decision service.

## Enforcement Requirements for New Operations

Before adding or exposing a protected operation:

1. Identify the authenticated user ID. The current web server has no authenticated identity source.
2. Choose a stable `resourceType`, `resourceId`, and action string; document the exact strings in tests and configuration.
3. Call `canAccess()` at the operation boundary before side effects or sensitive reads.
4. Reject on false; do not treat absent ACL records as permission.
5. Add tests for direct-user and group grants, organization scoping, wildcard matching, default deny, and denied side effects.

The plugin loader currently creates all plugins using one shared `appContext`; it does not inject the access-control instance into other plugin contexts. A central authenticated dispatcher or explicit authorization dependency is needed before plugin ACLs can be enforced consistently.