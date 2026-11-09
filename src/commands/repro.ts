import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, ReproRecord } from '../types.js';
import {
  renderFormattedDocumentation,
  syncKnownIssuesRunbook,
} from '../core/doc-exporters.js';
import { getBugDir, isHaltedState, loadBugMeta, saveBugMeta } from '../core/state.js';
import { runShellCommand } from '../core/runner.js';
import {
  renderReproStepsMarkdown,
  renderTasksMarkdown,
} from '../core/templates.js';

export interface ReproOptions {
  cwd?: string;
  cmd?: string;
}

export function findDefaultReproCommand(bugDir: string): string {
  const reproDir = path.join(bugDir, '2-repro');
  if (!fs.existsSync(reproDir)) {
    throw new Error(`Reproduction directory not found at ${reproDir}`);
  }

  const files = fs
    .readdirSync(reproDir)
    .filter((f) => f !== 'fixture.json' && !f.endsWith('.md'));

  const firstFile = files[0];
  if (!firstFile) {
    throw new Error(`No reproduction script found in ${reproDir}`);
  }

  const fullPath = path.join(reproDir, firstFile);
  if (firstFile.endsWith('.mjs') || firstFile.endsWith('.js')) {
    return `node "${fullPath}"`;
  }
  if (firstFile.endsWith('.py')) {
    return `python "${fullPath}"`;
  }
  if (firstFile.endsWith('.sh')) {
    return `sh "${fullPath}"`;
  }
  return `npx tsx "${fullPath}"`;
}

export function runRepro(
  bugId: string,
  options: ReproOptions = {}
): {
  bugDir: string;
  meta: BugMetadata;
  record: ReproRecord;
  reproducedRed: boolean;
} {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  if (isHaltedState(meta.status)) {
    throw new Error(
      `Cannot run reproduction for ${meta.id} because its status is ${meta.status} (${meta.classification}).`
    );
  }

  const command = options.cmd ?? findDefaultReproCommand(bugDir);
  const execResult = runShellCommand(command, cwd);

  const passed = execResult.exitCode === 0;
  const record: ReproRecord = {
    timestamp: new Date().toISOString(),
    mode: meta.reproMode,
    command,
    exitCode: execResult.exitCode,
    passed,
    outputSnippet: execResult.combinedOutput.slice(0, 600),
  };

  meta.reproHistory.push(record);

  // Stage 2 Gate: Reproduction succeeds when the test FAILS (Red state)
  const reproducedRed = !passed;
  if (reproducedRed) {
    meta.status = 'REPRODUCED';
  }

  saveBugMeta(bugDir, meta);

  // Update REPRO_STEPS.md with the recorded failure output & command proof
  const reproStepsPath = path.join(bugDir, '2-repro', 'REPRO_STEPS.md');
  fs.writeFileSync(reproStepsPath, renderReproStepsMarkdown(meta), 'utf-8');

  const tasksPath = path.join(bugDir, '4-tasks.md');
  if (fs.existsSync(tasksPath)) {
    fs.writeFileSync(tasksPath, renderTasksMarkdown(meta), 'utf-8');
  }

  // Sync documentation & Known Issues runbook
  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  syncKnownIssuesRunbook(cwd);

  return { bugDir, meta, record, reproducedRed };
}

export function printReproResult(result: ReturnType<typeof runRepro>): void {
  const { meta, record, reproducedRed } = result;
  console.log(`Command: ${pc.dim(record.command)}`);
  if (record.outputSnippet) {
    console.log(pc.dim(record.outputSnippet));
  }

  if (reproducedRed) {
    console.log(
      pc.green(
        `✔ [RED STATE ACHIEVED] Bug ${pc.bold(meta.id)} deterministically reproduced (exit code ${record.exitCode}).`
      )
    );
    console.log(
      `  Updated ${pc.cyan('2-repro/REPRO_STEPS.md')} with verified reproduction steps & failure output.`
    );
    console.log(
      `  Next Step: Complete ${pc.cyan('3-rca.md')} and run ${pc.bold(`openfix rca ${meta.id} --size <small|medium|big-architectural>`)}`
    );
  } else {
    console.log(
      pc.yellow(
        `⚠ Reproduction script exited with 0 (PASS). A reproduction gate requires a failing test (RED) demonstrating the bug before fixing.`
      )
    );
  }
}
