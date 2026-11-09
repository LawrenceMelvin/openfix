import fs from 'node:fs';
import path from 'node:path';
import type { BugMetadata, ExportFormat } from '../types.js';
import { getOpenFixRoot } from './config.js';
import { getBugDir, listAllBugs } from './state.js';
import {
  renderAnalystReport,
  renderFixProofMarkdown,
  renderImpactMarkdown,
  renderReproStepsMarkdown,
} from './templates.js';

export interface BugSectionContents {
  intakeContent: string;
  triageContent: string;
  reproStepsContent: string;
  rcaContent: string;
  impactContent: string;
  fixProofContent: string;
  fixtureRaw: string;
}

export function loadBugSections(
  bugDir: string,
  meta: BugMetadata
): BugSectionContents {
  const readSafe = (relPath: string, fallback: string): string => {
    const full = path.join(bugDir, relPath);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : fallback;
  };

  return {
    intakeContent: readSafe('0-intake.md', '_No 0-intake.md found._'),
    triageContent: readSafe('1-triage.md', '_No 1-triage.md found._'),
    reproStepsContent: readSafe(
      path.join('2-repro', 'REPRO_STEPS.md'),
      renderReproStepsMarkdown(meta)
    ),
    rcaContent: readSafe('3-rca.md', '_No 3-rca.md found._'),
    impactContent: readSafe('3b-impact.md', renderImpactMarkdown(meta)),
    fixProofContent: readSafe('5-fix-proof.md', renderFixProofMarkdown(meta)),
    fixtureRaw: readSafe(path.join('2-repro', 'fixture.json'), '{}'),
  };
}

/**
 * Renders Confluence Storage / Wiki format with Info/Warning panels,
 * Summary Table, "How to Reproduce This Issue", Root Cause Analysis, Flow/DB Impact, and Fix-Proof.
 */
export function renderConfluenceFormat(
  meta: BugMetadata,
  sections: BugSectionContents
): string {
  const panelMacro =
    meta.status === 'HALTED_EXTERNAL'
      ? 'warning'
      : meta.status === 'VERIFIED' || meta.status === 'CLOSED'
      ? 'info'
      : 'note';

  const latestFail = [...meta.reproHistory]
    .reverse()
    .find((r) => !r.passed && r.exitCode !== 0);

  return `<ac:structured-macro ac:name="${panelMacro}">
  <ac:parameter ac:name="title">${meta.id}: ${meta.title} [${meta.status}]</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Classification:</strong> ${meta.classification ?? 'Pending'} | <strong>Repro Mode:</strong> ${meta.reproMode} | <strong>Fix Size:</strong> ${meta.fixSize ?? 'N/A'} | <strong>Scope:</strong> ${meta.fixScope ?? 'N/A'} | <strong>DB Impact:</strong> ${meta.dbImpact ?? 'N/A'}</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>1. Ticket &amp; Triage Overview</h2>
<table>
  <tbody>
    <tr><th>Bug ID</th><td><code>${meta.id}</code></td></tr>
    <tr><th>Symptom / Title</th><td>${meta.title}</td></tr>
    <tr><th>Ticket URL</th><td>${meta.jiraUrl ?? 'N/A'}</td></tr>
    <tr><th>Classification</th><td><code>${meta.classification ?? 'Pending'}</code></td></tr>
    <tr><th>Status</th><td><code>${meta.status}</code></td></tr>
    <tr><th>Fix Scope &amp; DB Impact</th><td><code>${meta.fixScope ?? 'N/A'}</code> / <code>${meta.dbImpact ?? 'N/A'}</code></td></tr>
    <tr><th>Fix Summary</th><td>${meta.fixSummary ?? 'N/A'}</td></tr>
    <tr><th>Red-to-Green Verified</th><td><code>${meta.verificationPassed ? 'Yes (Passed)' : 'No'}</code></td></tr>
    <tr><th>Promoted Regression Test</th><td><code>${meta.promotedTo ?? 'N/A'}</code></td></tr>
  </tbody>
</table>

<h2>2. How to Reproduce This Issue (QA UI Steps &amp; Technical Probe)</h2>
<p><strong>Deterministic Failure Recorded (Red State):</strong> <code>${latestFail ? `YES (Exit Code ${latestFail.exitCode})` : 'Pending'}</code></p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="title">How to Reproduce (${meta.id})</ac:parameter>
  <ac:plain-text-body><![CDATA[${sections.reproStepsContent}]]></ac:plain-text-body>
</ac:structured-macro>

<h2>3. Root Cause Analysis, Exact Trigger Conditions &amp; Related Scenarios</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="title">RCA &amp; Trigger Conditions (${meta.id})</ac:parameter>
  <ac:plain-text-body><![CDATA[${sections.rcaContent}]]></ac:plain-text-body>
</ac:structured-macro>

<h2>4. End-to-End Flow, DB Transactions &amp; Effective Fix Plan</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="title">Flow, DB Impact &amp; Effective Fix (${meta.id})</ac:parameter>
  <ac:plain-text-body><![CDATA[${sections.impactContent}]]></ac:plain-text-body>
</ac:structured-macro>

<h2>5. Fix Documentation &amp; Proof of Resolution (Before vs. After)</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="title">Fix Proof (${meta.id})</ac:parameter>
  <ac:plain-text-body><![CDATA[${sections.fixProofContent}]]></ac:plain-text-body>
</ac:structured-macro>

<h2>6. Triage &amp; Call-Chain Trace</h2>
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">Stage 0 Intake &amp; Stage 1 Triage Details</ac:parameter>
  <ac:rich-text-body>
    <pre>${sections.triageContent}</pre>
  </ac:rich-text-body>
</ac:structured-macro>
`;
}

/**
 * Renders a concise Jira comment specifically tailored for QA & Business Analysts,
 * highlighting "How to Reproduce & Retest in QA", plain-English Cause, and Fix-Proof Evidence.
 */
export function renderJiraCommentFormat(
  meta: BugMetadata,
  sections: BugSectionContents
): string {
  const firstRed = meta.reproHistory.find((r) => !r.passed && r.exitCode !== 0);
  const latestGreen = [...meta.reproHistory]
    .reverse()
    .find((r) => r.passed && r.exitCode === 0);

  return `h2. [OpenFix] Investigation, Reproduction & Fix-Proof Summary: ${meta.id}

||Field||Value||
|*Bug ID*|{{${meta.id}}} — ${meta.title}|
|*Classification*|{{${meta.classification ?? 'Pending'}}}|
|*Lifecycle Status*|*${meta.status}*|
|*Fix Scope & DB Impact*|{{${meta.fixScope ?? 'N/A'}}} / {{${meta.dbImpact ?? 'N/A'}}}|
|*Fix Summary*|${meta.fixSummary ?? 'N/A'}|
|*Modified Files*|${meta.modifiedFiles && meta.modifiedFiles.length > 0 ? meta.modifiedFiles.map((f) => `{{${f}}}`).join(', ') : 'N/A'}|
|*Before Fix (Red)*|${firstRed ? `Exit Code ${firstRed.exitCode} (Reproduced)` : 'No'}|
|*After Fix (Green)*|${latestGreen ? 'Exit Code 0 (PASSED)' : 'Pending'}|
|*Visual Proof*|Before: ${meta.screenshots.length > 0 ? meta.screenshots.map((s) => `{{${s}}}`).join(', ') : 'N/A'} -> After: ${meta.proofScreenshots && meta.proofScreenshots.length > 0 ? meta.proofScreenshots.map((s) => `{{${s}}}`).join(', ') : 'N/A'}|
|*Regression Test*|{{${meta.promotedTo ?? 'N/A'}}}|

----
h3. 1. Cause Summary for Analysts
* *Is this an internal code bug?* {{${meta.classification ?? 'Under Investigation'}}}
${
  meta.classification === 'external-server-issue'
    ? '* *Analyst Note:* This issue is caused by an external server / 3rd-party dependency outage, NOT application code. No code change is required.'
    : meta.classification === 'already-in-progress'
    ? `* *Analyst Note:* Duplicate of active fix in *${meta.linkedTicket ?? 'linked ticket'}*.`
    : '* *Analyst Note:* Confirmed internal defect. See reproduction steps, root cause, and fix-proof below.'
}

----
h3. 2. How to Reproduce & Retest This Issue (QA Guide)
{quote}
${sections.reproStepsContent}
{quote}

----
h3. 3. Root Cause & Exact Trigger Conditions
{code:markdown}
${sections.rcaContent}
{code}

----
h3. 4. End-to-End Flow, DB Impact & Effective Fix
{code:markdown}
${sections.impactContent}
{code}

----
h3. 5. Fix Documentation & Proof of Resolution (Before vs. After)
{code:markdown}
${sections.fixProofContent}
{code}
`;
}

/**
 * Renders structured JSON ready for Confluence REST API, Jira API, Notion API, or MCP tools.
 */
export function renderJsonExportFormat(
  meta: BugMetadata,
  sections: BugSectionContents
): string {
  let parsedFixture: unknown = {};
  try {
    parsedFixture = JSON.parse(sections.fixtureRaw);
  } catch {
    parsedFixture = sections.fixtureRaw;
  }

  const firstRed = meta.reproHistory.find((r) => !r.passed && r.exitCode !== 0);
  const latestGreen = [...meta.reproHistory]
    .reverse()
    .find((r) => r.passed && r.exitCode === 0);

  return (
    JSON.stringify(
      {
        id: meta.id,
        title: meta.title,
        jiraUrl: meta.jiraUrl ?? null,
        status: meta.status,
        classification: meta.classification ?? null,
        fixSize: meta.fixSize ?? null,
        fixScope: meta.fixScope ?? null,
        dbImpact: meta.dbImpact ?? null,
        impactReviewed: Boolean(meta.impactReviewed),
        clarificationsResolved: Boolean(meta.clarificationsResolved),
        linkedTicket: meta.linkedTicket ?? null,
        verificationPassed: meta.verificationPassed,
        promotedTo: meta.promotedTo ?? null,
        howToReproduce: {
          mode: meta.reproMode,
          reproducedRed: Boolean(firstRed),
          reproCommand: firstRed?.command ?? `npx openfix repro ${meta.id}`,
          latestFailureExitCode: firstRed?.exitCode ?? null,
          latestFailureOutput: firstRed?.outputSnippet ?? null,
          fixture: parsedFixture,
          reproStepsMarkdown: sections.reproStepsContent,
        },
        fixProof: {
          verified: meta.verificationPassed,
          fixSummary: meta.fixSummary ?? null,
          modifiedFiles: meta.modifiedFiles ?? [],
          beforeScreenshots: meta.screenshots,
          afterProofScreenshots: meta.proofScreenshots ?? [],
          beforeRedRun: firstRed ?? null,
          afterGreenRun: latestGreen ?? null,
          fixProofMarkdown: sections.fixProofContent,
        },
        documentation: {
          intakeMarkdown: sections.intakeContent,
          triageMarkdown: sections.triageContent,
          rcaMarkdown: sections.rcaContent,
          impactMarkdown: sections.impactContent,
          fixProofMarkdown: sections.fixProofContent,
        },
      },
      null,
      2
    ) + '\n'
  );
}

export function renderFormattedDocumentation(
  meta: BugMetadata,
  bugDir: string,
  format: ExportFormat = 'markdown'
): { content: string; defaultFilename: string } {
  const sections = loadBugSections(bugDir, meta);

  switch (format) {
    case 'confluence':
      return {
        content: renderConfluenceFormat(meta, sections),
        defaultFilename: 'CONFLUENCE_DOC.xml',
      };
    case 'jira':
      return {
        content: renderJiraCommentFormat(meta, sections),
        defaultFilename: 'JIRA_COMMENT.txt',
      };
    case 'json':
      return {
        content: renderJsonExportFormat(meta, sections),
        defaultFilename: 'BUG_REPORT.json',
      };
    case 'markdown':
    default:
      return {
        content: renderAnalystReport(
          meta,
          sections.intakeContent,
          sections.triageContent,
          sections.reproStepsContent,
          sections.rcaContent,
          sections.impactContent,
          sections.fixProofContent
        ),
        defaultFilename: 'ANALYST_REPORT.md',
      };
  }
}

/**
 * Automatically updates the repository's central Known-Issues & Symptom Runbook
 * (.openfix/KNOWN_ISSUES.md) so analysts and developers can immediately look up:
 * - Symptom / Error Text
 * - Classification (External Server vs Code Bug vs Duplicate)
 * - How to Reproduce This Issue
 * - Root Cause, Fix Scope, DB Impact, Fix Proof & Status
 */
export function syncKnownIssuesRunbook(cwd: string = process.cwd()): string {
  const bugs = listAllBugs(cwd);
  const runbookPath = path.join(getOpenFixRoot(cwd), 'KNOWN_ISSUES.md');

  const rows = bugs.map((b) => {
    const red = b.reproHistory.some((r) => !r.passed && r.exitCode !== 0);
    const reproSummary = red
      ? `Verified (\`${b.reproMode}\`) — see \`${b.id}/2-repro/REPRO_STEPS.md\``
      : b.status === 'HALTED_EXTERNAL'
      ? 'External Server Outage (No local repro needed)'
      : 'Pending Repro';

    return `| \`${b.id}\` | ${b.title} | \`${b.classification ?? 'pending'}\` | ${reproSummary} | \`${b.fixSize ?? 'N/A'}\` (\`${b.fixScope ?? 'N/A'}\`) | \`${b.status}\` |`;
  });

  const detailBlocks = bugs.map((b) => {
    const bugDir = getBugDir(b.id, cwd);
    const reproStepsPath = path.join(bugDir, '2-repro', 'REPRO_STEPS.md');
    const reproText = fs.existsSync(reproStepsPath)
      ? fs.readFileSync(reproStepsPath, 'utf-8')
      : renderReproStepsMarkdown(b);

    return `### ${b.id}: ${b.title}
- **Status:** \`${b.status}\` | **Classification:** \`${b.classification ?? 'pending'}\` | **Fix Size:** \`${b.fixSize ?? 'N/A'}\` | **Scope:** \`${b.fixScope ?? 'N/A'}\` | **DB Impact:** \`${b.dbImpact ?? 'N/A'}\`
- **Fix Summary:** ${b.fixSummary ?? 'Pending'}
- **How to Reproduce Command:** \`npx openfix repro ${b.id}\`
- **Full Repro Guide:** \`.openfix/bugs/${b.id}/2-repro/REPRO_STEPS.md\`
- **Fix Proof Document:** \`.openfix/bugs/${b.id}/5-fix-proof.md\`

<details>
<summary><strong>How to Reproduce (${b.id})</strong></summary>

${reproText}
</details>
`;
  });

  const content = `# OpenFix Known Issues, Reproduction & Root Cause Runbook

> Auto-generated and kept in sync by OpenFix after Triage, Reproduction, RCA, Impact Audit, and Verification.
> Can be synced to Confluence / Notion / Internal Wiki via \`openfix export <id> --format confluence\`.

## 1. Master Symptom-to-Cause Lookup Table

| Bug ID | Reported Symptom / UI Error | Classification | How to Reproduce | Fix Size & Scope | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
${rows.length > 0 ? rows.join('\n') : '| *(None yet)* | - | - | - | - | - |'}

---

## 2. Reproduction Guides & Cause Details by Ticket

${detailBlocks.join('\n---\n\n')}
`;

  fs.mkdirSync(path.dirname(runbookPath), { recursive: true });
  fs.writeFileSync(runbookPath, content, 'utf-8');
  return runbookPath;
}
