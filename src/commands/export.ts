import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, ExportFormat } from '../types.js';
import {
  renderFormattedDocumentation,
  syncKnownIssuesRunbook,
} from '../core/doc-exporters.js';
import { getBugDir, loadBugMeta } from '../core/state.js';

export interface ExportOptions {
  cwd?: string;
  outputPath?: string;
  format?: ExportFormat;
}

export function runExport(
  bugId: string,
  options: ExportOptions = {}
): {
  reportPath: string;
  reportContent: string;
  format: ExportFormat;
  runbookPath: string;
  meta: BugMetadata;
} {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);
  const format: ExportFormat = options.format ?? 'markdown';

  const rendered = renderFormattedDocumentation(meta, bugDir, format);

  const reportPath = options.outputPath
    ? path.resolve(cwd, options.outputPath)
    : path.join(bugDir, rendered.defaultFilename);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, rendered.content, 'utf-8');

  const runbookPath = syncKnownIssuesRunbook(cwd);

  return {
    reportPath,
    reportContent: rendered.content,
    format,
    runbookPath,
    meta,
  };
}

export function printExportResult(result: ReturnType<typeof runExport>): void {
  console.log(
    pc.green(
      `✔ Exported ${pc.bold(result.format.toUpperCase())} documentation for ${pc.bold(result.meta.id)}!`
    )
  );
  console.log(`  Report File:     ${pc.cyan(result.reportPath)}`);
  console.log(`  Master Runbook:  ${pc.cyan(result.runbookPath)}`);
}
