---
description: OpenFix Test-Driven Bug Fixing (TDBF) & RCA Rules
globs: ["**/*"]
alwaysApply: false
---

# OpenFix Bug Resolution Protocol

When the user asks to investigate or fix a bug:
1. Initialize or create a workspace via `npx openfix new <id> "<title>"`.
2. Extract UI clues from screenshots/Jira into `0-intake.md` and trace the call chain in `1-triage.md`.
3. Classify via `npx openfix triage <id> --classify <type>`. Halt immediately without editing code if it is `external-server-issue` or `already-in-progress`.
4. Prove the bug exists with a failing reproduction (`npx openfix repro <id>`) BEFORE editing any source code.
5. Document the root cause, trigger conditions, and fix size in `3-rca.md` (`npx openfix rca <id> --size <small|medium|big-architectural>`).
6. Apply the fix, verify Red-to-Green (`npx openfix verify <id>`), promote (`npx openfix promote <id>`), and export the analyst summary (`npx openfix export <id>`).
