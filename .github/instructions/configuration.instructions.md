---
applyTo: "config/**"
---

# Configuration Rules

- Keep shared application configuration in JSON and preserve the existing `app.env.json` schema unless a migration is part of the task.
- Represent credentials with `${ENVIRONMENT_VARIABLE}` placeholders. The service must provide their values at runtime.
- Never put usable tokens, passwords, private keys, or cloud credentials in config files.
- Keep user, group, organization, environment, and ACL records consistent with their datastore IDs and references.
- Remember startup bootstrap writes configuration records to `data/`; credential-shaped store fields are removed before persistence.
- Add or update tests when changing placeholder expansion, store bootstrap, or config shape.