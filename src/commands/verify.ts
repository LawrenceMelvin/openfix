import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, ReproRecord } from '../types.js';
import {
  findDefaultReproCommand,
  runShellCommand,
} from '../core/runner.js';
import {
  renderFormattedDocumentation,
  syncKnownIssuesRunbook,
} from '../core/doc-exporters.js';
import {
  getBugDir,
  hasDeterministicFailure,
  isHaltedState,
  loadBugMeta,
  saveBugMeta,
} from '../core/state.js';
import {
  renderFixProofMarkdown,
  renderTasksMarkdown,
} from '../core/templates.js';

export interface VerifyOptions {
  cwd?: string;
  cmd?: string;
  beforeScreenshot?: string;
  afterScreenshot?: string;
}

export function runVerify(
  bugId: string,
  options: VerifyOptions = {}
): {
  bugDir: string;
  meta: BugMetadata;
  record: ReproRecord;
  verifiedGreen: boolean;
  fixProofPath: string;
} {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  if (isHaltedState(meta.status)) {
    throw new Error(
      `Cannot verify ${meta.id} because it is in a halted state: ${meta.status} (${meta.classification}).`
    );
  }

  if (!hasDeterministicFailure(meta)) {
    throw new Error(
      `Reproduction Gate Violation: Bug ${meta.id} never achieved a failing reproduction (Red state). Run "openfix repro ${meta.id}" first.`
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

  // Stage 4 Gate: Fix Verification requires PASS (Green state)
  const verifiedGreen = passed;
  if (verifiedGreen) {
    meta.status = 'VERIFIED';
    meta.verificationPassed = true;
    meta.verifiedAt = new Date().toISOString();

    // Inspect git status for modified files list
    try {
      const gitStatus = runShellCommand('git status --short', cwd);
      if (gitStatus.exitCode === 0) {
        meta.modifiedFiles = gitStatus.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.replace(/^[MADRCU?!]{1,2}\s+/, ''));
      }
    } catch {
      // Git optional
    }

    // Attach Before / After screenshots if provided
    if (options.beforeScreenshot || options.afterScreenshot) {
      meta.uiProof = {
        beforeScreenshot: options.beforeScreenshot ?? meta.screenshots[0],
        afterScreenshot: options.afterScreenshot,
      };
    }
  }

  saveBugMeta(bugDir, meta);

  // Write Stage 5 Fix Proof artifact
  const fixProofPath = path.join(bugDir, '5-fix-proof.md');
  fs.writeFileSync(fixProofPath, renderFixProofMarkdown(meta), 'utf-8');

  const tasksPath = path.join(bugDir, '4-tasks.md');
  if (fs.existsSync(tasksPath)) {
    fs.writeFileSync(tasksPath, renderTasksMarkdown(meta), 'utf-8');
  }

  // Sync documentation & Known Issues runbook
  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  syncKnownIssuesRunbook(cwd);

  return { bugDir, meta, record, verifiedGreen, fixProofPath };
}

export function printVerifyResult(result: ReturnType<typeof runVerify>): void {
  const { meta, record, verifiedGreen, fixProofPath } = result;
  console.log(`Command: ${pc.dim(record.command)}`);
  if (record.outputSnippet) {
    console.log(pc.dim(record.outputSnippet));
  }

  if (verifiedGreen) {
    console.log(
      pc.green(
        `✔ [GREEN STATE ACHIEVED] Bug ${pc.bold(meta.id)} successfully verified! Reproduction test now passes (exit code 0).`
      )
    );
    console.log(`  Fix Proof Doc: ${pc.cyan(fixProofPath)}`);
    console.log(
      `  Next Step: Run ${pc.bold(`openfix promote ${meta.id}`)} to install reproduction test into regression test suite.`
    );
  } else {
    console.log(
      pc.red(
        `✖ Verification failed (exit code ${record.exitCode}). Reproduction test is still failing. Review fix and try again.`
      )
    );
  }
}
