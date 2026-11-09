import type { BugMetadata, ReproMode } from '../types.js';

export function renderIntakeMarkdown(meta: BugMetadata): string {
  const screenshotList =
    meta.screenshots.length > 0
      ? meta.screenshots.map((s) => `- \`${s}\``).join('\n')
      : '- *(Add screenshot path or paste visual description here)*';

  return `# 0. Bug Intake & Symptom Extraction: ${meta.id}

**Title:** ${meta.title}
**Jira / Ticket URL:** ${meta.jiraUrl ?? 'N/A'}
**Created:** ${meta.createdAt}
**Current Status:** \`${meta.status}\`

---

## 1. Raw Ticket Description (Analyst / QA Report)
> Describe or paste the exact text from the Jira bug ticket here.
- **Reported Symptom:** ${meta.title}
- **Environment Reported:** \`Production / Staging / QA\`
- **Timestamp / Frequency:** *(e.g., Every time, Intermittent, Happened at 14:32 UTC)*

---

## 2. Attached UI Screenshots & Visual Clues
${screenshotList}

### Extracted Clues from UI / Screenshot (For Codebase Reverse-Search)
| Clue Type | Observed Value in Screenshot | Codebase Search Keyword |
| :--- | :--- | :--- |
| **Screen / Page Title** | *(e.g. "Checkout Summary")* | \`"Checkout Summary"\` or i18n key |
| **URL / Route Path** | *(e.g. \`/orders/confirm\`)* | \`/orders/confirm\` |
| **Error Toast / Banner Text** | *(e.g. "Unable to process request")* | \`"Unable to process"\` |
| **Button / Action Triggered** | *(e.g. Clicked "Submit Payment")* | \`onSubmit\` / \`handlePayment\` |
| **Visible Input / Data Values** | *(e.g. Customer ID #882, Total: NaN)* | \`calculateTotal\` |
`;
}

export function renderTriageMarkdown(meta: BugMetadata): string {
  return `# 1. Technical Triage & Call-Chain Trace: ${meta.id}

**Bug ID:** ${meta.id} — ${meta.title}

---

## 1. Symptom-to-Code Reverse Trace
*(Trace from the UI clue in \`0-intake.md\` down to the backend/external dependency)*

1. **UI Layer (Component / Screen):**
   - File / Component: \`TODO: e.g. src/pages/CheckoutPage.tsx\`
   - Trigger Event: \`TODO: e.g. onClick -> submitOrder()\`
2. **API / Network Layer:**
   - Endpoint / Route: \`TODO: e.g. POST /api/v1/orders\`
   - Request Payload Clues: \`TODO\`
3. **Service / Business Logic Layer:**
   - Controller / Handler: \`TODO: e.g. OrderController.create\`
   - Service Method: \`TODO: e.g. PaymentService.chargeCustomer\`
4. **Database / External Server Layer:**
   - External Dependency / DB Table: \`TODO: e.g. Stripe API / Partner Webhook / orders table\`

---

## 2. Candidate Hypotheses
- **Hypothesis 1 (Internal Code):** \`TODO: e.g. Null pointer when discount code is empty\`
- **Hypothesis 2 (External Server):** \`TODO: e.g. Upstream payment server returning 502/504 timeout\`
- **Hypothesis 3 (Data / State):** \`TODO: e.g. Legacy user record missing currency field\`

---

## 3. Triage Classification Gate
*Select one classification via \`openfix triage ${meta.id} --classify <type>\`:*

- [${meta.classification === 'internal-code-bug' ? 'x' : ' '}] **\`internal-code-bug\`**: Legitimate defect in this repository's code. Proceed to Stage 2 (\`2-repro/\`).
- [${meta.classification === 'external-server-issue' ? 'x' : ' '}] **\`external-server-issue\`**: Caused by external server / 3rd-party API outage or invalid upstream response. **HALT code changes.**
- [${meta.classification === 'already-in-progress' ? 'x' : ' '}] **\`already-in-progress\`**: Legitimate issue already tracked and being fixed under ticket: \`${meta.linkedTicket ?? 'TODO-TICKET-ID'}\`. **HALT duplicate work.**
- [${meta.classification === 'environment-or-data' ? 'x' : ' '}] **\`environment-or-data\`**: Environment config drift, missing migration, or bad test data.
- [${meta.classification === 'working-as-intended' ? 'x' : ' '}] **\`working-as-intended\`**: Matches product specification; not a bug.
- [${meta.classification === 'need-more-info' ? 'x' : ' '}] **\`need-more-info\`**: Ticket lacks minimum data to isolate. Send questions below to Analyst.

---

## 4. Analyst Communication / Clarification Note
> This section is included when exporting the ticket summary for QA/Business Analysts.

- **Is this an application bug?** \`${meta.classification ?? 'Pending Triage'}\`
- **Explanation for Analyst (Non-technical):**
  *(Explain clearly if this is an external server issue, a duplicate of an active fix, or a confirmed bug)*
- **Questions for Analyst (if \`need-more-info\`):**
  1. Which user account / ID was used when taking the screenshot?
  2. What exact time did this error occur (so we can correlate server logs)?
  3. Does this happen for all records or only specific ones?
`;
}

export function renderReproStepsMarkdown(meta: BugMetadata): string {
  const latestFail = [...meta.reproHistory]
    .reverse()
    .find((r) => !r.passed && r.exitCode !== 0);

  return `# 2. How to Reproduce This Issue: ${meta.id}

**Bug ID:** ${meta.id} — ${meta.title}
**Reproduction Mode:** \`${meta.reproMode}\`
**Deterministic Failure Verified (Red State):** \`${latestFail ? 'YES (Verified)' : 'PENDING'}\`

---

## 1. Preconditions & Test Data Setup
> Exact account, environment, or input state required to trigger the issue.
- **Environment:** \`Local / QA / Staging\`
- **User Role / Account State:** *(e.g. Logged-in customer with an active trial subscription)*
- **Required Input Data:** See \`2-repro/fixture.json\` *(e.g. \`sampleField: null\` or 100% discount coupon)*

---

## 2. Step-by-Step Application / UI Reproduction (For QA & Analysts)
> Follow these exact steps in the application UI to reproduce the defect and re-test after the fix is deployed:

1. **Step 1:** Navigate to the screen shown in \`0-intake.md\` *(e.g. \`/orders/confirm\`)*.
2. **Step 2:** Enter or select the trigger data *(e.g. leave optional discount field empty or apply coupon \`FREE100\`)*.
3. **Step 3:** Click the action button *(e.g. \`Submit Order\`)*.

- **Observed (Broken) Behavior:** ${meta.title}
- **Expected (Fixed) Behavior:** The request completes cleanly without throwing an error or rendering invalid UI state.

---

## 3. Technical / Automated Reproduction (For Developers & CI)
- **Reproduction Script Location:** \`.openfix/bugs/${meta.id}/2-repro/\`
- **Input Fixture:** \`.openfix/bugs/${meta.id}/2-repro/fixture.json\`
- **CLI Command to Reproduce:**
  \`\`\`bash
  npx openfix repro ${meta.id}
  \`\`\`
${
  latestFail
    ? `- **Recorded Failing Run (RED Proof):**
  - **Timestamp:** \`${latestFail.timestamp}\`
  - **Command Executed:** \`${latestFail.command}\`
  - **Exit Code:** \`${latestFail.exitCode}\`
  - **Failure Output:**
    \`\`\`text
    ${latestFail.outputSnippet || '(No output snippet)'}
    \`\`\``
    : '- **Recorded Failing Run:** *(Run `npx openfix repro ' +
      meta.id +
      '` to record deterministic failure output)*'
}
`;
}

export function renderReproFixtureJson(meta: BugMetadata): string {
  return (
    JSON.stringify(
      {
        _comment: `Input data fixture extracted from Jira screenshot / logs for ${meta.id}`,
        bugId: meta.id,
        observedInput: {
          sampleField: null,
        },
        expectedOutcome: 'Should handle input gracefully without error',
      },
      null,
      2
    ) + '\n'
  );
}

export function renderReproStarterScript(
  meta: BugMetadata,
  mode: ReproMode
): { filename: string; content: string } {
  switch (mode) {
    case 'api-probe':
      return {
        filename: 'repro-probe.mjs',
        content: `/**
 * OpenFix Stage 2: API / External Server Probe (${meta.id})
 * Mode: api-probe
 *
 * Rule: This script MUST exit with non-zero (process.exit(1)) when the bug is reproduced.
 * Once the code fix is applied, running this script again MUST exit with 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf-8'));

async function runApiProbe() {
  console.log('[OpenFix API Probe] Reproducing ${meta.id} with fixture:', fixture.bugId);

  // TODO: Replace with actual endpoint call or handler invocation
  const simulatedBugStillPresent = true;

  if (simulatedBugStillPresent) {
    console.error('FAIL [${meta.id}]: Reproduced error condition in API probe.');
    process.exit(1);
  }

  console.log('PASS [${meta.id}]: API probe succeeded without error.');
  process.exit(0);
}

runApiProbe().catch((err) => {
  console.error('FAIL [${meta.id}]: Unhandled exception:', err);
  process.exit(1);
});
`,
      };

    case 'ui-e2e':
      return {
        filename: 'repro-ui.mjs',
        content: `/**
 * OpenFix Stage 2: UI / E2E Interaction Reproduction (${meta.id})
 * Mode: ui-e2e
 *
 * Mirrors the exact user steps and screen state shown in the Jira UI screenshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf-8'));

async function runUiRepro() {
  console.log('[OpenFix UI Repro] Reproducing ${meta.id} from screenshot clues:', fixture.bugId);

  // TODO: Hook into Playwright / JSDOM / component render matching the screenshot
  const uiErrorToastVisible = true;

  if (uiErrorToastVisible) {
    console.error('FAIL [${meta.id}]: UI error state reproduced matching screenshot.');
    process.exit(1);
  }

  console.log('PASS [${meta.id}]: UI state rendered cleanly.');
  process.exit(0);
}

runUiRepro();
`,
      };

    case 'log-replay':
      return {
        filename: 'repro-replay.mjs',
        content: `/**
 * OpenFix Stage 2: Log / State Snapshot Replay (${meta.id})
 * Mode: log-replay
 *
 * Replays captured production/staging payload from fixture.json against local logic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf-8'));

function replayStateSnapshot() {
  console.log('[OpenFix Log Replay] Replaying snapshot for ${meta.id}');

  // TODO: Pass fixture.observedInput into the target parser/service
  if (fixture.observedInput.sampleField === null) {
    console.error('FAIL [${meta.id}]: Reproduced crash when replaying snapshot payload.');
    process.exit(1);
  }

  console.log('PASS [${meta.id}]: Snapshot replayed cleanly.');
  process.exit(0);
}

replayStateSnapshot();
`,
      };

    case 'unit-fixture':
    default:
      return {
        filename: 'repro-unit.mjs',
        content: `/**
 * OpenFix Stage 2: Unit + Fixture Reproduction (${meta.id})
 * Mode: unit-fixture
 *
 * Rule: Must deterministically FAIL (exit code 1) before fixing code,
 * and PASS (exit code 0) after fixing code.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf-8'));

console.log('[OpenFix Unit Repro] Running reproduction for ${meta.id}...');

// TODO: Import the target function and call it with fixture.observedInput
const actualOutput = fixture.observedInput.sampleField;
assert.notEqual(actualOutput, null, 'FAIL [${meta.id}]: Function failed on null sampleField');

console.log('PASS [${meta.id}]: Reproduction test passed!');
`,
      };
  }
}

export function renderRcaMarkdown(meta: BugMetadata): string {
  return `# 3. Root Cause Analysis (RCA) & Sizing: ${meta.id}

**Bug ID:** ${meta.id} — ${meta.title}
**Reproduction Mode Used:** \`${meta.reproMode}\`

---

## 1. Root Cause Summary
- **Faulty File & Symbol:** \`TODO: e.g. src/services/OrderService.ts -> calculateDiscount()\`
- **Why It Happens (Technical Root Cause):**
  *(Explain the exact logic flaw, unhandled state, race condition, or contract mismatch)*

---

## 2. Exact Trigger Conditions (When Does This Happen?)
> Documenting this clearly helps Analysts and Support immediately recognize the pattern.
- **Exact Scenario When Issue Occurs:**
  *(e.g. Happens ONLY when a user applies a percentage coupon on a subscription item with a $0 trial period)*
- **When It Does NOT Happen:**
  *(e.g. Standard one-time purchases or fixed-amount coupons work normally)*

---

## 3. Other Scenarios & Related Areas That Might Trigger This Issue
- **Other Features / Flows Sharing This Logic:**
  1. \`TODO: e.g. Invoice PDF regeneration endpoint uses the same calculation helper\`
  2. \`TODO: e.g. Bulk renewal cron job may hit the same null condition\`
- **Other Potential Causes of the Same UI Symptom:**
  - If the analyst sees this same error banner in the future, it can also be caused by:
    1. \`External payment gateway timeout (>10s)\`
    2. \`Expired user session token during checkout\`

---

## 4. Fix Sizing & Escalation Gate
*Classify the scope of the fix via \`openfix rca ${meta.id} --size <small|medium|big-architectural>\`:*

- [${meta.fixSize === 'small' ? 'x' : ' '}] **\`small\` (Targeted Patch):**
  - Localized to 1–2 files, no breaking API or DB schema changes. Proceed to \`3b-impact.md\` & \`4-tasks.md\`.
- [${meta.fixSize === 'medium' ? 'x' : ' '}] **\`medium\` (Multi-file Fix):**
  - Touches multiple components/handlers within the same module, requires unit + integration tests.
- [${meta.fixSize === 'big-architectural' ? 'x' : ' '}] **\`big-architectural\` (Escalate to OpenSpec):**
  - Requires database migration, API contract redesign, or cross-service architecture change.
  - **Action:** Run \`openfix escalate ${meta.id}\` to generate an OpenSpec proposal.
`;
}

export function renderImpactMarkdown(meta: BugMetadata): string {
  return `# 3b. End-to-End Flow, DB Transactions, Repo Blast Radius & Effective Fix Plan: ${meta.id}

**Bug ID:** ${meta.id} — ${meta.title}
**Fix Scope:** \`${meta.fixScope ?? 'pending'}\`
**Database Impact:** \`${meta.dbImpact ?? 'pending'}\`
**Fix Size:** \`${meta.fixSize ?? 'pending'}\`
**Clarifications ("Grill") Resolved:** \`${meta.clarificationsResolved ? 'YES' : 'PENDING'}\`

---

## 1. Full End-to-End Operation Flow & In-Between Connections
> In large organization repos, never patch a leaf function without tracing the full flow and middleware/event connections in between.

\`\`\`text
[UI Page / Component]:     TODO (e.g. CheckoutPage.tsx)
       │
       ▼
[API Route / Middleware]:  TODO (e.g. AuthGuard -> ValidationPipe -> POST /api/orders)
       │
       ▼
[Controller / Manager]:    TODO (e.g. OrderController -> OrderManager.submit)
       │
       ├──► [In-Between Connections]: TODO (e.g. Redis Cart Cache, Kafka OrderEvent, AuditLogger)
       ▼
[Repository / Database]:   TODO (e.g. OrderRepository.saveWithinTransaction)
\`\`\`

- **In-Between Side Effects Identified:**
  - **Cache / State:** *(Does this flow read/invalidate Redis or local state?)*
  - **Events / Queues / Webhooks:** *(Are domain events or webhooks emitted before or after the failure point?)*
  - **Shared Interceptors / Guards:** *(Are there interceptors transforming the payload or error?)*

---

## 2. Database Operations & Transaction Boundary Audit
- **Database Impact Level:** \`${meta.dbImpact ?? 'pending'}\`
  - [${meta.dbImpact === 'none' ? 'x' : ' '}] \`none\`: No DB operations in this flow.
  - [${meta.dbImpact === 'read-only-query' ? 'x' : ' '}] \`read-only-query\`: Only SELECT queries; no state mutation risk.
  - [${meta.dbImpact === 'transactional-write' ? 'x' : ' '}] \`transactional-write\`: Writes to DB inside a transaction.
  - [${meta.dbImpact === 'schema-or-migration' ? 'x' : ' '}] \`schema-or-migration\`: Requires schema/index change (**Must Escalate to OpenSpec**).
- **Tables Read / Written:** \`TODO: e.g. orders, order_items, payment_ledgers\`
- **Transaction & Rollback Safety Check:**
  - Is the operation wrapped in an atomic transaction (\`@Transactional\` / \`db.transaction\`)? \`TODO: Yes / No\`
  - Could a failure halfway through leave orphan rows or partial updates? \`TODO\`
  - Are any slow external HTTP calls happening *inside* an open DB transaction lock? \`TODO\`

---

## 3. Organization Repo Blast-Radius & Caller Isolation
> Decide whether to fix ONLY inside the specific UI page / backend endpoint or in a shared module.

- **All Callers of the Target Function/Method Across the Repo:**
  1. \`TODO: Caller 1 (Target Page/Endpoint) — e.g. CheckoutController.submitOrder\`
  2. \`TODO: Caller 2 (Other Flow) — e.g. RecurringBillingCron.processRenewal\`
  3. \`TODO: Caller 3 (Other Flow) — e.g. AdminRefundController.recalculate\`

- **Scope Isolation Decision (\`--scope\`):**
  - [${meta.fixScope === 'isolated-page-or-endpoint' ? 'x' : ' '}] **\`isolated-page-or-endpoint\` (Recommended for Org Repos):**
    - Apply the fix **strictly inside the specific UI page or specific backend controller/endpoint** so zero other callers or modules in the organization repo are affected.
  - [${meta.fixScope === 'shared-service-module' ? 'x' : ' '}] **\`shared-service-module\`:**
    - Apply the fix in the shared service/repository because all callers listed above suffer from the same defect and have been verified safe.
  - [${meta.fixScope === 'cross-system' ? 'x' : ' '}] **\`cross-system\`:**
    - Affects multiple microservices or shared contracts (**Escalate to OpenSpec**).

---

## 4. "Weak Fix" (Rejected) vs. "Effective Fix" (Approved)
> Never settle for a symptom band-aid that masks the error or corrupts downstream state.

| Evaluation | Approach Description | Why Rejected / Why Approved |
| :--- | :--- | :--- |
| ❌ **Weak Fix (Rejected)** | *TODO: e.g. Add \`?. \` optional chaining in the UI or swallow the null error in the repository* | Masks the symptom, leaves partial state in DB, or silently alters behavior for other callers in the repo. |
| ✅ **Effective Fix (Approved)** | *TODO: e.g. Normalize and validate discount state at the specific endpoint boundary before opening the DB transaction* | Prevents invalid state before DB transaction starts, keeps blast radius isolated, and preserves atomicity. |

---

## 5. "Grill the User" — Clarification Questions Before Coding
> If any business rule, caller impact, or DB transaction behavior is ambiguous, the AI agent MUST ask the user these questions and wait for confirmation before writing code:

- [ ] **Question 1 (Scope Isolation):** Should this fix be isolated strictly to \`[Target Page/Endpoint]\`, or should it also apply to \`[Other Callers]\`?
- [ ] **Question 2 (Transaction / Data State):** When this edge case occurs, should the transaction roll back completely or persist a fallback state?
- [ ] **Question 3 (Effective Fix Approval):** Do you approve the Effective Fix plan above (Size: \`${meta.fixSize ?? 'pending'}\`, Scope: \`${meta.fixScope ?? 'pending'}\`)?
`;
}

export function renderTasksMarkdown(meta: BugMetadata): string {
  return `# 4. Fix Execution & Verification Tasks: ${meta.id}

**Bug ID:** ${meta.id} — ${meta.title}
**Fix Size:** \`${meta.fixSize ?? 'pending'}\`
**Fix Scope:** \`${meta.fixScope ?? 'pending'}\`
**DB Impact:** \`${meta.dbImpact ?? 'pending'}\`

---

## 1. Pre-Fix Gate Checklist
- [x] **Intake Recorded:** \`0-intake.md\` has Jira details & UI screenshot clues.
- [${meta.status !== 'INTAKE' ? 'x' : ' '}] **Triaged:** Confirmed internal code defect (not an external server outage).
- [${meta.reproHistory.some((r) => !r.passed) ? 'x' : ' '}] **Reproduced (Red State):** Deterministic failing test & steps documented in \`2-repro/REPRO_STEPS.md\`.
- [${meta.fixSize ? 'x' : ' '}] **RCA & Sizing Completed:** Root cause, trigger conditions, and blast radius documented in \`3-rca.md\`.
- [${meta.impactReviewed ? 'x' : ' '}] **Full Flow, DB Transaction & Effective Fix Reviewed (\`3b-impact.md\`):** Callers checked, Weak Fix rejected, and User Clarifications resolved.

---

## 2. Implementation Tasks
- [ ] **Task 1:** Apply the **Effective Fix** (from \`3b-impact.md\`) respecting the chosen scope (\`${meta.fixScope ?? 'isolated-page-or-endpoint'}\`) and DB transaction boundaries.
- [ ] **Task 2:** Verify in-between connections (caches, events, other callers) are unaffected.
- [ ] **Task 3:** Run \`openfix verify ${meta.id} --summary "<what changed>" --proof-screenshot <path>\` to verify **FAIL (Red) -> PASS (Green)** and generate \`5-fix-proof.md\`.
- [ ] **Task 4:** Run \`openfix promote ${meta.id}\` to copy the reproduction test into the permanent regression suite.
- [ ] **Task 5:** Run \`openfix export ${meta.id} --format <markdown|confluence|jira|json>\` to publish the final report & fix proof.
`;
}

export function renderFixProofMarkdown(meta: BugMetadata): string {
  const firstRed = meta.reproHistory.find((r) => !r.passed && r.exitCode !== 0);
  const latestGreen = [...meta.reproHistory]
    .reverse()
    .find((r) => r.passed && r.exitCode === 0);

  const modifiedFilesList =
    meta.modifiedFiles && meta.modifiedFiles.length > 0
      ? meta.modifiedFiles.map((f) => `- \`${f}\``).join('\n')
      : '- *(No modified files recorded; pass `--files` or commit in git)*';

  const beforeScreens =
    meta.screenshots.length > 0
      ? meta.screenshots.map((s) => `\`${s}\``).join(', ')
      : '*(None attached in Stage 0)*';

  const afterScreens =
    meta.proofScreenshots && meta.proofScreenshots.length > 0
      ? meta.proofScreenshots.map((s) => `\`${s}\``).join(', ')
      : '*(Attach post-fix UI screenshot via `--proof-screenshot <path>`)*';

  return `# 5. Fix Documentation & Proof of Resolution: ${meta.id}

**Bug ID:** ${meta.id} — ${meta.title}
**Verification Status:** \`${meta.verificationPassed ? 'VERIFIED (Red -> Green)' : 'PENDING VERIFICATION'}\`
**Promoted Regression Test:** \`${meta.promotedTo ?? 'Pending promotion (run openfix promote)'}\`

---

## 1. What Was Fixed (Change Summary)
- **Fix Summary:** ${meta.fixSummary ?? 'Applied Effective Fix per Stage 3b Impact Plan.'}
- **Fix Scope:** \`${meta.fixScope ?? 'isolated-page-or-endpoint'}\`
- **Database Impact:** \`${meta.dbImpact ?? 'none'}\`
- **Modified Files:**
${modifiedFilesList}

---

## 2. Automated Before vs. After Proof (Red-to-Green Evidence)

| Evidence Stage | Status | Exit Code | Timestamp | Command Executed |
| :--- | :--- | :--- | :--- | :--- |
| ❌ **Before Fix (RED Proof)** | \`FAILED (Reproduced)\` | \`${firstRed?.exitCode ?? 'N/A'}\` | \`${firstRed?.timestamp ?? 'N/A'}\` | \`${firstRed?.command ?? 'N/A'}\` |
| ✅ **After Fix (GREEN Proof)** | \`${latestGreen ? 'PASSED (Verified)' : 'PENDING'}\` | \`${latestGreen?.exitCode ?? 'N/A'}\` | \`${latestGreen?.timestamp ?? 'N/A'}\` | \`${latestGreen?.command ?? 'N/A'}\` |

### Before Fix Output (Broken Behavior Captured):
\`\`\`text
${firstRed?.outputSnippet || '(No failing output recorded)'}
\`\`\`

### After Fix Output (Fixed Behavior Verified):
\`\`\`text
${latestGreen?.outputSnippet || '(Run openfix verify to capture passing output)'}
\`\`\`

---

## 3. Visual / UI Proof for Jira (Before vs. After Screenshots)

| Evidence Type | Artifact / Screenshot Reference |
| :--- | :--- |
| **Before Fix (Broken UI / Error Banner)** | ${beforeScreens} |
| **After Fix (Working UI / Proof Screenshot)** | ${afterScreens} |

---

## 4. QA Retest & Sign-Off Checklist (Copy to Jira)
- [x] **Deterministic Reproduction proved before fix (RED)**
- [${meta.verificationPassed ? 'x' : ' '}] **Fix verified against reproduction script (GREEN)**
- [${meta.promotedTo ? 'x' : ' '}] **Permanent regression test added (\`${meta.promotedTo ?? 'pending'}\`)**
- [ ] **QA Retest in Staging/QA:** Follow step-by-step UI instructions in \`2-repro/REPRO_STEPS.md\` and confirm the error no longer occurs.
`;
}

export function renderAnalystReport(
  meta: BugMetadata,
  intakeContent: string,
  triageContent: string,
  reproStepsContent: string,
  rcaContent: string,
  impactContent?: string,
  fixProofContent?: string
): string {
  const statusBanner =
    meta.status === 'HALTED_EXTERNAL'
      ? '⚠️ **NOT A CODE BUG — EXTERNAL SERVER / THIRD-PARTY ISSUE**'
      : meta.status === 'HALTED_DUPLICATE'
      ? `ℹ️ **KNOWN ISSUE — ALREADY IN PROGRESS (${meta.linkedTicket ?? 'See linked ticket'})**`
      : meta.status === 'NEED_CLARIFICATION'
      ? '❓ **BLOCKED — NEEDS CLARIFICATION**'
      : meta.status === 'ESCALATED_OPENSPEC'
      ? `🏗️ **ARCHITECTURAL CHANGE REQUIRED — ESCALATED TO OPENSPEC (${meta.escalatedTo ?? ''})**`
      : meta.status === 'VERIFIED' || meta.status === 'CLOSED'
      ? '✅ **RESOLVED & VERIFIED WITH AUTOMATED REGRESSION TEST**'
      : `🔄 **IN PROGRESS (Current Stage: ${meta.status})**`;

  return `# Bug Investigation & Resolution Report: ${meta.id}

${statusBanner}

| Field | Value |
| :--- | :--- |
| **Bug ID** | \`${meta.id}\` |
| **Title** | ${meta.title} |
| **Ticket Link** | ${meta.jiraUrl ?? 'N/A'} |
| **Classification** | \`${meta.classification ?? 'Pending'}\` |
| **Lifecycle Status** | \`${meta.status}\` |
| **Fix Size** | \`${meta.fixSize ?? 'N/A'}\` |
| **Fix Scope** | \`${meta.fixScope ?? 'N/A'}\` |
| **DB Impact** | \`${meta.dbImpact ?? 'N/A'}\` |
| **Fix Summary** | ${meta.fixSummary ?? 'N/A'} |
| **Repro Mode** | \`${meta.reproMode}\` |
| **Red-to-Green Verified** | \`${meta.verificationPassed ? 'Yes (Passed)' : 'No'}\` |
| **Promoted Regression Test** | \`${meta.promotedTo ?? 'N/A'}\` |

---

## 1. Summary for Analysts / QA / Product
- **Classification:** **\`${meta.classification ?? 'Under Investigation'}\`**
${
  meta.classification === 'external-server-issue'
    ? '- **Cause:** The application code is functioning properly. The error observed in the UI is caused by an upstream external server failure/timeout.'
    : meta.classification === 'already-in-progress'
    ? `- **Cause:** This is a known issue already being fixed in **${meta.linkedTicket ?? 'another active ticket'}**.`
    : ''
}
- **Reproduction Evidence:**
  - Total Reproduction Runs: ${meta.reproHistory.length}
  - Failing Reproduction Recorded (Red): ${meta.reproHistory.some((r) => !r.passed) ? 'Yes' : 'No'}
  - Post-Fix Verification Passed (Green): ${meta.verificationPassed ? 'Yes' : 'No'}

---

## 2. How to Reproduce This Issue (UI & Technical Steps)

${reproStepsContent}

---

## 3. Root Cause, Trigger Conditions & Related Scenarios

${rcaContent}

---

## 4. End-to-End Flow, DB Transactions & Effective Fix Impact

${impactContent ?? '_No 3b-impact.md recorded._'}

---

## 5. Fix Documentation & Proof of Resolution (Before vs. After)

${fixProofContent ?? renderFixProofMarkdown(meta)}

---

## 6. Intake & Triage Trail

<details>
<summary><strong>Stage 0: Intake & Visual Clues</strong></summary>

${intakeContent}
</details>

<details>
<summary><strong>Stage 1: Triage & Call-Chain Trace</strong></summary>

${triageContent}
</details>
`;
}

export function renderOpenSpecEscalation(
  meta: BugMetadata,
  rcaContent: string
): { proposal: string; design: string; tasks: string } {
  const proposal = `# OpenSpec Proposal: Architectural Resolution for ${meta.id}

## Background (Escalated from OpenFix \`${meta.id}\`)
- **Original Bug Report:** ${meta.title}
- **Jira URL:** ${meta.jiraUrl ?? 'N/A'}
- **Fix Scope:** \`${meta.fixScope ?? 'cross-system'}\`
- **Database Impact:** \`${meta.dbImpact ?? 'schema-or-migration'}\`
- **Reason for Escalation:** During Stage 3 RCA / Impact Analysis in OpenFix, this defect was sized as \`big-architectural\` because a safe resolution requires structural/contract/schema changes rather than a localized hotfix.

## Root Cause Findings from OpenFix
${rcaContent}

## Proposed Architectural Change
- Define updated system boundaries, schema changes, or contract updates required to eliminate this class of bug permanently.
`;

  const design = `# Architectural Design: ${meta.id}

## 1. Current Broken Architecture
Refer to OpenFix RCA (\`.openfix/bugs/${meta.id}/3-rca.md\`) and Impact Analysis (\`.openfix/bugs/${meta.id}/3b-impact.md\`).

## 2. Target Architecture & Invariants
- [ ] Define new data model / API contract invariants.
- [ ] Define backward compatibility & DB transaction migration strategy.
- [ ] Define failure handling for external dependencies.
`;

  const tasks = `# Implementation Tasks (OpenSpec + OpenFix Verification)

- [ ] **Phase 1:** Implement architectural changes per \`design.md\`.
- [ ] **Phase 2:** Run \`openfix verify ${meta.id}\` to confirm the original bug reproduction in \`.openfix/bugs/${meta.id}/2-repro/\` now passes.
- [ ] **Phase 3:** Promote reproduction test via \`openfix promote ${meta.id}\`.
`;

  return { proposal, design, tasks };
}
