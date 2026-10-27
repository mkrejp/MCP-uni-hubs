---
applyTo: "tests/**/*.js"
---

# Test Rules

- Use `node:test` and `node:assert/strict`, matching the existing suite.
- Test observable behavior and contracts rather than implementation-only details.
- Put generated records under `tmp/`; never rely on `data/`, `logs/`, network services, or a real secret token for unit tests.
- Stub global network APIs only inside `try/finally` and restore the original implementation.
- Use clearly synthetic fixture credentials and assert that serialized dashboard/store records do not contain secrets.
- Load the matching reference from `docs/README.md`; do not load the entire documentation tree for a narrow test change.