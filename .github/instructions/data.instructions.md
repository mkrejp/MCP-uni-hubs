---
applyTo: "data/**/*.json"
---

# Datastore Record Rules

- Treat files under `data/` as application state; preserve user-owned records and avoid bulk rewrites.
- Keep each filename key, record `id`, and references between users, groups, organizations, environments, and ACLs consistent.
- Never add credentials to datastore records. Startup config bootstrap redacts credential-shaped store fields.
- For exact record schemas, load only [data-models](../../docs/architecture/data-models.md); for access decisions load [authorization](../../docs/architecture/authorization.md).