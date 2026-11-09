# OpenFix

**Test-Driven Bug Fixing (TDBF) & Root Cause Analysis (RCA) Framework for Software Engineers and AI Coding Assistants**

---

While **OpenSpec** solves 0-to-1 Feature Development (*Intent $\rightarrow$ Spec $\rightarrow$ Design $\rightarrow$ Code*), **OpenFix** solves the inverted lifecycle of **Defect Resolution** in real-world codebases:

$$\text{Jira Symptom / Screenshot} \longrightarrow \text{Triage} \longrightarrow \text{Reproduction (Red)} \longrightarrow \text{RCA} \longrightarrow \text{Flow, DB & Caller Impact} \longrightarrow \text{Effective Fix (Green)} \longrightarrow \text{Proof & Runbook}$$

---

## Why OpenFix?

1. **Jira Tickets Have Minimal Info + Screenshots:** Analysts know the application UI, not the code. OpenFix includes a **Stage 0 Symptom-to-Code Reverse Trace** that maps UI labels, error toasts, and form values directly to frontend components, API endpoints, and backend services.
2. **External Server & Outage Filtering (Zero Wasted Code):** Not every ticket is a code bug. Stage 1 Triage catches **3rd-Party Outages**, **Environment Drift**, and **Already-In-Progress Fixes** early—halting code changes and generating a clear non-technical explanation for QA/Analysts.
3. **Mandatory Reproduction Gate (Red-to-Green):** AI coding assistants and developers are strictly blocked from touching application code until a deterministic failing reproduction (`RED` state) is recorded.
4. **Multi-Stack Reproduction Modes:** Works across any tech stack via 4 modes:
   - `unit-fixture`: JSON fixture passed into unit/service function tests.
   - `api-probe`: HTTP/contract probe checking backend controllers & external servers.
   - `ui-e2e`: Browser/widget interaction matching screenshot steps (Playwright/Cypress/Flutter).
   - `log-replay`: Replaying captured state/payload snapshots locally.
5. **Flow, DB Transaction & Caller Blast-Radius Audit (Stage 3b):** In large enterprise repositories, shared services have dozens of callers. OpenFix audits database transaction rollback safety (`@Transactional`), maps in-between connections (Redis, Kafka, hooks), forces an explicit choice between **Page-Isolated Fix** vs. **Shared Fix**, and explicitly contrasts **Weak Fix (Rejected)** vs. **Effective Fix (Approved)**.
6. **"Grill the Developer" Clarification Gate:** Halts with `NEED_CLARIFICATION` if DB rollback or caller scope is ambiguous, asking clarifying questions before any code changes.
7. **Post-Fix Documentation & Proof of Resolution (Stage 5):** Generates `5-fix-proof.md` containing Before (Red) vs. After (Green) terminal execution evidence, modified file lists, and Before/After UI screenshot pairing for Jira.
8. **Multi-Platform Documentation:** Exports directly to **Confluence** (`--format confluence`), **Jira Comment** (`--format jira`), **Markdown** (`--format markdown`), and **JSON** (`--format json`), while automatically syncing a central **`.openfix/KNOWN_ISSUES.md` Runbook**.

---

## Directory Structure Per Bug

```text
.openfix/
├── config.json
├── AGENT_PROTOCOL.md
├── KNOWN_ISSUES.md            # Central Symptom-to-Cause Runbook
└── bugs/
    └── BUG-104-checkout-timeout/
        ├── meta.json          # State machine, gate history & proof records
        ├── 0-intake.md        # Jira description + UI screenshot visual clues
        ├── 1-triage.md        # Reverse call-chain trace + hypotheses + classification
        ├── 2-repro/           # Mandatory Reproduction Gate (Must FAIL first)
        │   ├── fixture.json   # Extracted data payload
        │   ├── repro-unit.mjs # Executable reproduction test/probe
        │   └── REPRO_STEPS.md # QA UI steps + developer automated command
        ├── 3-rca.md           # Root cause, exact trigger conditions & related scenarios
        ├── 3b-impact.md       # End-to-end flow, DB transaction audit & Effective Fix plan
        ├── 4-tasks.md         # Fix implementation & verification tasks
        ├── 5-fix-proof.md     # Before vs. After evidence & visual proof for Jira
        └── ANALYST_REPORT.md  # Multi-format export for Analysts & Stakeholders
```

---

## Quick Start & CLI Reference

### 1. Initialize OpenFix
Auto-detects the repository test runner (Vitest, Jest, Playwright, Pytest, Go, Cargo, Flutter, Gradle):
```bash
npx openfix init
```

### 2. Scaffold a New Bug Workspace (Stage 0)
```bash
npx openfix new BUG-104 "Checkout error toast on submit" \
  --jira "https://jira.company.com/browse/BUG-104" \
  --screenshot "./screenshots/checkout-broken.png" \
  --mode unit-fixture
```

### 3. Triage & Reverse Call-Chain Trace (Stage 1)
Trace from the UI screenshot to the backend service. If an external server outage is identified, halt immediately without modifying code:
```bash
# Confirmed code defect
npx openfix triage BUG-104 --classify internal-code-bug

# OR External service issue (halts and generates report)
npx openfix triage BUG-104 --classify external-server-issue
```

### 4. Prove the Bug Exists (Stage 2 Reproduction Gate)
The reproduction script in `2-repro/` must exit with non-zero (`RED` state) to pass the gate:
```bash
npx openfix repro BUG-104
```

### 5. Root Cause Analysis & Fix Sizing (Stage 3)
```bash
npx openfix rca BUG-104 --size small
```

### 6. Flow, DB Transaction & Caller Impact Audit (Stage 3b)
In large organization repos, decide between isolating the fix to the target page/endpoint vs. modifying a shared service:
```bash
npx openfix impact BUG-104 \
  --scope isolated-page-or-endpoint \
  --db transactional-write
```
*(Optional: If DB schema change or cross-system impact is detected, run `npx openfix escalate BUG-104` to hand off to an OpenSpec proposal).*

### 7. Apply Minimal Code Fix & Verify Red-to-Green (Stage 4 & 5)
Verifies that the reproduction script transitions from **FAIL (Red)** to **PASS (Green)**, runs existing regression suites, and generates `5-fix-proof.md`:
```bash
npx openfix verify BUG-104 \
  --summary "Normalized null discount before DB transaction in CheckoutController" \
  --files src/controllers/CheckoutController.ts \
  --proof-screenshot ./screenshots/checkout-fixed-green.png
```

### 8. Promote Reproduction to Permanent Test Suite
```bash
npx openfix promote BUG-104
```

### 9. Export for Jira, Confluence, or Analysts
```bash
# Export Jira comment with QA retest checklist and Before/After proof
npx openfix export BUG-104 --format jira

# Export Confluence-ready XML documentation
npx openfix export BUG-104 --format confluence

# Export JSON payload for API / MCP publishing
npx openfix export BUG-104 --format json
```

---

## AI Coding Assistant Integration

OpenFix includes built-in agent rules for **Cursor**, **Claude Code**, and **Antigravity**:
* `templates/agents/CURSOR_RULES.md`
* `templates/agents/CLAUDE.md`
* `templates/agents/SKILL.md`

When installed in a repository, coding assistants are step-locked:
1. They cannot modify production code until `openfix repro <id>` records a failing test (`RED`).
2. They are required to complete the Stage 3b Impact audit to reject "weak band-aid fixes".
3. They must resolve developer questions via the "Grill Gate" before writing code.
4. They must supply Before vs. After proof during `openfix verify`.\n\n---\n\n## Development & Testing\n\n```bash\n# Install dependencies\nnpm install\n\n# Compile TypeScript\nnpm run build\n\n# Run Vitest test suite (37 tests across 7 suites)\nnpm test\n```\n\n---\n\n## License\n\nMIT\n