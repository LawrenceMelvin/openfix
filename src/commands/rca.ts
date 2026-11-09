import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, FixSize } from '../types.js';
import {
  renderFormattedDocumentation,
  syncKnownIssuesRunbook,
} from '../core/doc-exporters.js';
import {
  getBugDir,
  hasDeterministicFailure,
  loadBugMeta,
  saveBugMeta,
} from '../core/state.js';
import { renderRcaMarkdown, renderTasksMarkdown } from '../core/templates.js';

export interface RcaOptions {
  cwd?: string;
  size: FixSize;
  allowWithoutRepro?: boolean;
}

export function runRca(
  bugId: string,
  options: RcaOptions
): { bugDir: string; meta: BugMetadata } {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  if (!hasDeterministicFailure(meta) && !options.allowWithoutRepro) {
    throw new Error(
      `Reproduction Gate Violation: Bug ${meta.id} does not have a recorded failing reproduction (Red state) yet. Run "openfix repro ${meta.id}" first.`
    );
  }

  meta.fixSize = options.size;
  meta.status = 'ANALYZED';

  saveBugMeta(bugDir, meta);

  const rcaPath = path.join(bugDir, '3-rca.md');
  if (!fs.existsSync(rcaPath)) {
    fs.writeFileSync(rcaPath, renderRcaMarkdown(meta), 'utf-8');
  }
  const tasksPath = path.join(bugDir, '4-tasks.md');
  if (fs.existsSync(tasksPath)) {
    fs.writeFileSync(tasksPath, renderTasksMarkdown(meta), 'utf-8');
  }

  // Sync documentation & Known Issues runbook
  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  syncKnownIssuesRunbook(cwd);

  return { bugDir, meta };
}

export function printRcaResult(result: ReturnType<typeof runRca>): void {
  const { meta } = result;
  console.log(
    pc.green(
      `✔ RCA recorded for ${pc.bold(meta.id)} (Fix Size: ${pc.yellow(meta.fixSize ?? '')})`
    )
  );
  if (meta.fixSize === 'big-architectural') {
    console.log(
      pc.magenta(
        `  Architectural Fix Detected! Run ${pc.bold(`openfix escalate ${meta.id}`)} to bridge this bug into an OpenSpec proposal.`
      )
    );
  } else {
    console.log(
      `  Next Step: Apply minimal code fix, then run ${pc.bold(`openfix verify ${meta.id}`)}`
    );
  }
}
