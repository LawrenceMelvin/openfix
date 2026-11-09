# OpenFix Agent Guidelines for Claude Code

When working on any defect, bug report, or error in this repository:
1. Always start by running `npx openfix new <id> "<title>"`.
2. Review Jira details and UI screenshots in `0-intake.md`.
3. Perform codebase reverse search and complete call-chain triage in `1-triage.md`.
4. Run `npx openfix triage <id> --classify <type>`. If classified as `external-server-issue`, stop and do NOT edit code.
5. You are strictly forbidden from modifying source code until `npx openfix repro <id>` records a failing test (`RED` state).
6. Perform Stage 3 RCA (`npx openfix rca <id> --size <size>`) and Stage 3b Flow/DB Impact Audit (`npx openfix impact <id> --scope <scope> --db <db>`).
7. Apply the Effective Fix, run `npx openfix verify <id> --summary "<change>"`, promote with `npx openfix promote <id>`, and export documentation with `npx openfix export <id>`.
