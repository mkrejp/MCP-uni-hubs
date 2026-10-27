# Copilot Instructions

- Start with `AGENTS.md` and `docs/README.md`; open only the task-specific reference listed there.
- Use matching `.github/instructions/*.instructions.md` files for path-scoped rules and `.github/skills/*/SKILL.md` only for matching workflows.
- Keep this global file short. Store architecture facts in `docs/`, path constraints in instructions, and multi-step procedures in skills.
- Preserve the dependency-light Node.js ES module design; run `npm test` after behavior changes.
- `SECRETARIO_TOKEN` is runtime-only. Never commit or persist real credentials.
- Do not describe configured stores as reachable, VM dispatch as real provisioning, SQL storage as a real database, or ACL records as enforced unless call sites actually check them.