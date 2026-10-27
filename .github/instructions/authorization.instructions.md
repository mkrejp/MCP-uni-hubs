---
applyTo: "src/access-control.js"
---

# Authorization Rules

- Read [authorization flow and limits](../../docs/architecture/authorization.md) before changing ACL decisions.
- ACL data alone does not enforce access. Protected operations must call `canAccess()` and deny before reads or side effects.
- Preserve default-deny behavior; test exact and wildcard resource matching, user/group scope, organization matching, and denied operations.
- User `roles` are descriptive only in the current implementation; do not make behavior depend on them unless adding tested role evaluation.