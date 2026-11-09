---
name: openfix
description: Test-Driven Bug Fixing (TDBF) & Root Cause Analysis (RCA) workflow. Use whenever investigating a Jira bug ticket, UI error screenshot, production defect, or unexpected behavior.
---

# OpenFix Skill: Reproduction-First Bug Fixing

Never guess or hallucinate a bug fix directly from a brief bug report. Follow the 5-stage OpenFix protocol:

## Stage 0: Symptom Intake (`0-intake.md`)
1. Run `npx openfix new <BUG-ID> "<Title>" --mode <unit-fixture|api-probe|ui-e2e|log-replay>`.
2. Inspect the Jira description and any attached UI screenshots.
3. Extract concrete visual clues into `0-intake.md`:
   - Screen title, route/URL, exact error banner/toast text, button clicked, visible form/table values.

## Stage 1: Reverse Trace & Triage (`1-triage.md`)
1. Search the codebase for the exact UI string or i18n key from Stage 0.
2. Trace the call chain: `UI Component -> API Request -> Controller -> Service -> Database / External Server`.
3. Classify the ticket:
   ```bash
   npx openfix triage <BUG-ID> --classify <internal-code-bug|external-server-issue|already-in-progress|need-more-info>
   ```
4. **Halt Gate:** If the issue is an `external-server-issue` (3rd-party API down/timeout), `already-in-progress`, or `need-more-info`, **STOP**. Do NOT modify application code. Run `npx openfix export <BUG-ID>` to give the analyst a clear report.

## Stage 2: Mandatory Reproduction Gate (`2-repro/`)
1. **Strict Rule:** Do NOT edit application source code until you have a deterministic failing reproduction.
2. Populate `2-repro/fixture.json` with the input data extracted from the screenshot/logs, and update the script in `2-repro/`.
3. Execute:
   ```bash
   npx openfix repro <BUG-ID>
   ```
   Confirm it exits with a non-zero status (`RED STATE ACHIEVED`).

## Stage 3: Root Cause Analysis & Sizing (`3-rca.md`)
1. Document in `3-rca.md`:
   - **Root Cause:** Exact file, function, and logic flaw.
   - **Trigger Condition:** When exactly this issue happens (and when it does not).
   - **Other Potential Scenarios:** Other flows sharing this code or other issues that cause the same symptom.
2. Size the fix:
   ```bash
   npx openfix rca <BUG-ID> --size <small|medium|big-architectural>
   ```
3. If `big-architectural`, run `npx openfix escalate <BUG-ID>` to hand off to **OpenSpec**.

## Stage 4: Minimal Fix, Verify & Promote (`4-tasks.md`)
1. Apply the minimal code fix.
2. Verify Red-to-Green transition:
   ```bash
   npx openfix verify <BUG-ID>
   ```
3. Promote the reproduction to the permanent test suite and export the Analyst Report:
   ```bash
   npx openfix promote <BUG-ID>
   npx openfix export <BUG-ID>
   ```
