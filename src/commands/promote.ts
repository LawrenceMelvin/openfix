import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata } from '../types.js';
import { loadConfig } from '../core/config.js';
import {
  renderFormattedDocumentation,
  syncKnownIssuesRunbook,
} from '../core/doc-exporters.js';
import { getBugDir, loadBugMeta, saveBugMeta } from '../core/state.js';
import { renderFixProofMarkdown } from '../core/templates.js';

export interface PromoteOptions {
  cwd?: string;
  destDir?: string;
}

export function runPromote(
  bugId: string,
  options: PromoteOptions = {}
): { bugDir: string; meta: BugMetadata; promotedFiles: string[] } {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(cwd);
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  if (!meta.verificationPassed) {
    throw new Error(
      `Verification Gate Violation: Bug ${meta.id} must pass "openfix verify ${meta.id}" before its reproduction test can be promoted.`
    );
  }

  const reproDir = path.join(bugDir, '2-repro');
  const targetDir = path.resolve(
    cwd,
    options.destDir ?? config.regressionTestDir,
    meta.id.toLowerCase()
  );
  fs.mkdirSync(targetDir, { recursive: true });

  const files = fs.readdirSync(reproDir);
  const promotedFiles: string[] = [];

  for (const file of files) {
    const srcFile = path.join(reproDir, file);
    const destFile = path.join(targetDir, file);
    fs.copyFileSync(srcFile, destFile);
    promotedFiles.push(path.relative(cwd, destFile));
  }

  meta.promotedTo = path.relative(cwd, targetDir);
  meta.status = 'CLOSED';
  saveBugMeta(bugDir, meta);

  // Refresh 5-fix-proof.md, ANALYST_REPORT.md, and KNOWN_ISSUES.md with promoted path
  fs.writeFileSync(
    path.join(bugDir, '5-fix-proof.md'),
    renderFixProofMarkdown(meta),
    'utf-8'
  );
  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  syncKnownIssuesRunbook(cwd);

  return { bugDir, meta, promotedFiles };
}

export function printPromoteResult(
  result: ReturnType<typeof runPromote>
): void {
  console.log(
    pc.green(
      `✔ Promoted reproduction suite for ${pc.bold(result.meta.id)} to permanent regression tests!`
    )
  );
  console.log(`  Destination: ${pc.cyan(result.meta.promotedTo ?? '')}`);
  console.log(`  Status:      ${pc.green(result.meta.status)}`);
}
