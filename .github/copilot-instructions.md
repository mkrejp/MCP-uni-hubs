# Copilot Instructions

- Read `AGENTS.md` and `docs/architecture.md` before making broad changes.
- Keep implementation aligned with the existing dependency-light Node.js ES module design.
- Verify changes with `npm test`; add behavior-focused tests for changed contracts.
- Treat `SECRETARIO_TOKEN` as runtime-only. Never add real secret values to tracked config, datastore fixtures, logs, dashboard responses, or test output.
- The dashboard lists configured secret stores; do not imply connectivity without a real health check.
- Be explicit about prototype boundaries: VM provider dispatch and SQL storage are not real integrations yet; only Secretario has a working HTTP secrets backend.
- Avoid changing or deleting generated/runtime data under `data/`, `tmp/`, or `logs/` unless the task specifically requires it.
- Keep docs and examples consistent with actual startup behavior and scripts in `package.json`.