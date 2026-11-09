import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, TriageClassification } from '../types.js';
import {
  renderFormattedDocumentation,
  syncKnownIssuesRunbook,
} from '../core/doc-exporters.js';
import {
  getBugDir,
  isHaltedState,
  loadBugMeta,
  saveBugMeta,
} from '../core/state.js';
import {
  renderImpactMarkdown,
  renderRcaMarkdown,
  renderTasksMarkdown,
  renderTriageMarkdown,
} from '../core/templates.js';

export interface TriageOptions {
  cwd?: string;
  classify?: TriageClassification;
  reason?: string;
}

export function runTriage(
  bugId: string,
  options: TriageOptions = {}
): {
  bugDir: string;
  meta: BugMetadata;
  halted: boolean;
  haltReason?: string;
} {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  if (options.classify) {
    meta.classification = options.classify;

    switch (options.classify) {
      case 'external-server-issue':
        meta.status = 'HALTED_EXTERNAL_DEPENDENCY';
        break;
      case 'already-in-progress':
        meta.status = 'HALTED_ALREADY_IN_PROGRESS';
        break;
      case 'need-more-info':
        meta.status = 'HALTED_NEED_MORE_INFO';
        break;
      case 'code-defect':
      default:
        meta.status = 'TRIAGED';
        break;
    }
  } else {
    meta.status = 'TRIAGED';
  }

  saveBugMeta(bugDir, meta);

  // Update triage markdown & tasks markdown
  const triagePath = path.join(bugDir, '1-triage.md');
  if (fs.existsSync(triagePath)) {
    fs.writeFileSync(triagePath, renderTriageMarkdown(meta), 'utf-8');
  }

  const impactPath = path.join(bugDir, '3b-impact.md');
  if (fs.existsSync(impactPath)) {
    fs.writeFileSync(impactPath, renderImpactMarkdown(meta), 'utf-8');
  }

  const rcaPath = path.join(bugDir, '3-rca.md');
  if (fs.existsSync(rcaPath)) {
    fs.writeFileSync(rcaPath, renderRcaMarkdown(meta), 'utf-8');
  }

  const tasksPath = path.join(bugDir, '4-tasks.md');
  if (fs.existsSync(tasksPath)) {
    fs.writeFileSync(tasksPath, renderTasksMarkdown(meta), 'utf-8');
  }

  // Update master documentation and Known Issues runbook
  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  syncKnownIssuesRunbook(cwd);

  const halted = isHaltedState(meta.status);
  return {
    bugDir,
    meta,
    halted,
    haltReason: halted ? options.reason ?? meta.classification : undefined,
  };
}

export function printTriageResult(result: ReturnType<typeof runTriage>): void {
  const { meta, halted, haltReason } = result;
  if (halted) {
    console.log(
      pc.red(
        `⛔ [HALTED] Bug ${pc.bold(meta.id)} was triaged as ${pc.bold(meta.classification ?? 'halted')}.`
      )
    );
    console.log(
      pc.yellow(
        '  No code changes are permitted for this issue. Contact the responsible external team or assignee.'
      )
    );
    if (haltReason) {
      console.log(`  Reason: ${haltReason}`);
    }
  } else {
    console.log(
      pc.green(
        `✔ Bug ${pc.bold(meta.id)} successfully triaged as ${pc.yellow(meta.classification ?? 'code-defect')}.`
      )
    );
    console.log(
      `  Next Step: Execute the reproduction test via ${pc.bold(`openfix repro ${meta.id}`)}`
    );
  }
}
