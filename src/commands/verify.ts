import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, ReproRecord } from '../types.js';
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
import { runShellCommand } from '../core/runner.js';
import { renderFixProofMarkdown } from '../core/templates.js';
import { findDefaultReproCommand } from './repro.js';

export interface VerifyOptions {
  cwd?: string;
  reproCmd?: string;
  regressionCmd?: string;
  summary?: string;
  files?: string[];
  proofScreenshots?: string[];
}

function detectGitModifiedFiles(cwd: string): string[] {
  const res = runShellCommand('git status --porcelain', cwd);
  if (res.exitCode !== 0 || !res.stdout.trim()) {
    return [];
  }
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(2).trim())
    .filter((f) => !f.startsWith('.openfix'));
}

export function runVerify(
  bugId: string,
  options: VerifyOptions = {}
): {
  bugDir: string;
  meta: BugMetadata;
  reproPassed: boolean;
  regressionPassed: boolean;
  fixProofPath: string;
  output: string;
} {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  // Strict Gate 1: Cannot verify if blocked on user clarification ("Grill Gate")
  if (meta.status === 'NEED_CLARIFICATION') {
    throw new Error(
      `Clarification ("Grill") Gate Violation: Bug ${meta.id} has unresolved questions in 3b-impact.md or 1-triage.md. Resolve clarifications with the user and run "openfix impact ${meta.id}" first.`
    );
  }

  // Strict Gate 2: Cannot verify a fix if it was never reproduced in a failing (Red) state first
  if (!hasDeterministicFailure(meta)) {
    throw new Error(
      `Reproduction Gate Violation: Bug ${meta.id} has never recorded a failing reproduction (Red state). You must prove the bug exists with "openfix repro ${meta.id}" before verifying a fix.`
    );
  }

  const reproCommand = options.reproCmd ?? findDefaultReproCommand(bugDir);
  const reproExec = runShellCommand(reproCommand, cwd);
  const reproPassed = reproExec.exitCode === 0;

  const record: ReproRecord = {
    timestamp: new Date().toISOString(),
    mode: meta.reproMode,
    command: reproCommand,
    exitCode: reproExec.exitCode,
    passed: reproPassed,
    outputSnippet: reproExec.combinedOutput.slice(0, 600),
  };
  meta.reproHistory.push(record);

  let regressionPassed = true;
  let combinedOutput = reproExec.combinedOutput;

  if (reproPassed && options.regressionCmd) {
    const regExec = runShellCommand(options.regressionCmd, cwd);
    regressionPassed = regExec.exitCode === 0;
    combinedOutput += `\n${regExec.combinedOutput}`;
  }

  if (options.summary) {
    meta.fixSummary = options.summary;
  }
  if (options.files && options.files.length > 0) {
    meta.modifiedFiles = options.files;
  } else if (!meta.modifiedFiles || meta.modifiedFiles.length === 0) {
    const gitFiles = detectGitModifiedFiles(cwd);
    if (gitFiles.length > 0) {
      meta.modifiedFiles = gitFiles;
    }
  }
  if (options.proofScreenshots && options.proofScreenshots.length > 0) {
    meta.proofScreenshots = [
      ...(meta.proofScreenshots ?? []),
      ...options.proofScreenshots,
    ];
  }

  if (reproPassed && regressionPassed) {
    meta.verificationPassed = true;
    meta.status = 'VERIFIED';
  }

  saveBugMeta(bugDir, meta);

  // Generate 5-fix-proof.md with Before (Red) vs After (Green) evidence
  const fixProofPath = path.join(bugDir, '5-fix-proof.md');
  fs.writeFileSync(fixProofPath, renderFixProofMarkdown(meta), 'utf-8');

  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  syncKnownIssuesRunbook(cwd);

  return {
    bugDir,
    meta,
    reproPassed,
    regressionPassed,
    fixProofPath,
    output: combinedOutput,
  };
}

export function printVerifyResult(result: ReturnType<typeof runVerify>): void {
  const { meta, reproPassed, regressionPassed, fixProofPath, output } = result;
  if (output) {
    console.log(pc.dim(output));
  }

  if (reproPassed && regressionPassed) {
    console.log(
      pc.green(
        `✔ [GREEN STATE ACHIEVED] Fix verified for ${pc.bold(meta.id)}! Reproduction transitioned from FAIL -> PASS.`
      )
    );
    console.log(`  Fix-Proof Doc: ${pc.cyan(fixProofPath)}`);
    console.log(
      `  Next Step:     Run ${pc.bold(`openfix promote ${meta.id}`)} and ${pc.bold(`openfix export ${meta.id} --format jira`)}`
    );
  } else if (!reproPassed) {
    console.log(
      pc.red(
        `✖ Verification failed: Reproduction test for ${meta.id} is still failing (RED).`
      )
    );
  } else {
    console.log(
      pc.red(
        `✖ Verification failed: Reproduction passed, but regression test command failed.`
      )
    );
  }
}
