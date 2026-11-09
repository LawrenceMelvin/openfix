import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, BugStatus, TriageClassification } from '../types.js';
import {
  renderFormattedDocumentation,
  syncKnownIssuesRunbook,
} from '../core/doc-exporters.js';
import { getBugDir, loadBugMeta, saveBugMeta } from '../core/state.js';
import { renderTasksMarkdown, renderTriageMarkdown } from '../core/templates.js';

export interface TriageOptions {
  cwd?: string;
  classify: TriageClassification;
  linkedTicket?: string;
}

const CLASSIFICATION_TO_STATUS: Record<TriageClassification, BugStatus> = {
  'internal-code-bug': 'TRIAGED',
  'external-server-issue': 'HALTED_EXTERNAL',
  'already-in-progress': 'HALTED_DUPLICATE',
  'environment-or-data': 'HALTED_INVALID',
  'working-as-intended': 'HALTED_INVALID',
  'need-more-info': 'NEED_CLARIFICATION',
};

export function runTriage(
  bugId: string,
  options: TriageOptions
): { bugDir: string; meta: BugMetadata; runbookPath: string } {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  meta.classification = options.classify;
  if (options.linkedTicket) {
    meta.linkedTicket = options.linkedTicket;
  }
  meta.status = CLASSIFICATION_TO_STATUS[options.classify];

  saveBugMeta(bugDir, meta);

  // Refresh 1-triage.md and 4-tasks.md checkboxes if present
  const triagePath = path.join(bugDir, '1-triage.md');
  if (fs.existsSync(triagePath)) {
    fs.writeFileSync(triagePath, renderTriageMarkdown(meta), 'utf-8');
  }
  const tasksPath = path.join(bugDir, '4-tasks.md');
  if (fs.existsSync(tasksPath)) {
    fs.writeFileSync(tasksPath, renderTasksMarkdown(meta), 'utf-8');
  }

  // Immediately document Step 1 findings in ANALYST_REPORT.md and central KNOWN_ISSUES.md
  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  const runbookPath = syncKnownIssuesRunbook(cwd);

  return { bugDir, meta, runbookPath };
}

export function printTriageResult(result: ReturnType<typeof runTriage>): void {
  const { meta, runbookPath } = result;
  console.log(
    pc.green(`✔ Bug ${pc.bold(meta.id)} triaged as: ${pc.yellow(meta.classification ?? '')}`)
  );
  console.log(`  Lifecycle Status: ${pc.cyan(meta.status)}`);
  console.log(`  Runbook Updated:  ${pc.cyan(runbookPath)}`);

  if (meta.status === 'HALTED_EXTERNAL') {
    console.log(
      pc.bgYellow(pc.black(' HALT ')) +
        ' External server/3rd-party issue detected. Do NOT modify application code.'
    );
    console.log(`  Run ${pc.bold(`openfix export ${meta.id} --format confluence`)} to export for Confluence.`);
  } else if (meta.status === 'HALTED_DUPLICATE') {
    console.log(
      pc.bgYellow(pc.black(' HALT ')) +
        ` Already tracked under ${meta.linkedTicket ?? 'another ticket'}. Do NOT duplicate fix.`
    );
  } else if (meta.status === 'NEED_CLARIFICATION') {
    console.log(
      pc.bgYellow(pc.black(' BLOCKED ')) +
        ' Ticket lacks minimum info. Send the clarification questions in 1-triage.md to the Analyst.'
    );
  } else if (meta.status === 'TRIAGED') {
    console.log(
      `  Next Step: Document reproduction in ${pc.cyan('2-repro/REPRO_STEPS.md')} and run ${pc.bold(`openfix repro ${meta.id}`)}`
    );
  }
}
