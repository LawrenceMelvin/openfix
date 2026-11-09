import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata } from '../types.js';
import { loadConfig } from '../core/config.js';
import { getBugDir, loadBugMeta, saveBugMeta } from '../core/state.js';
import { renderOpenSpecEscalation } from '../core/templates.js';

export interface EscalateOptions {
  cwd?: string;
}

export function runEscalate(
  bugId: string,
  options: EscalateOptions = {}
): { bugDir: string; meta: BugMetadata; openspecChangeDir: string } {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(cwd);
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  const rcaPath = path.join(bugDir, '3-rca.md');
  const rcaContent = fs.existsSync(rcaPath)
    ? fs.readFileSync(rcaPath, 'utf-8')
    : 'See OpenFix workspace.';

  const openspecChangeDir = path.resolve(
    cwd,
    config.openspecDir,
    `fix-${meta.id.toLowerCase()}`
  );
  fs.mkdirSync(openspecChangeDir, { recursive: true });

  const docs = renderOpenSpecEscalation(meta, rcaContent);
  fs.writeFileSync(
    path.join(openspecChangeDir, 'proposal.md'),
    docs.proposal,
    'utf-8'
  );
  fs.writeFileSync(
    path.join(openspecChangeDir, 'design.md'),
    docs.design,
    'utf-8'
  );
  fs.writeFileSync(
    path.join(openspecChangeDir, 'tasks.md'),
    docs.tasks,
    'utf-8'
  );

  meta.fixSize = 'big-architectural';
  meta.status = 'ESCALATED_OPENSPEC';
  meta.escalatedTo = path.relative(cwd, openspecChangeDir);
  saveBugMeta(bugDir, meta);

  return { bugDir, meta, openspecChangeDir };
}

export function printEscalateResult(
  result: ReturnType<typeof runEscalate>
): void {
  console.log(
    pc.green(
      `✔ Escalated ${pc.bold(result.meta.id)} to OpenSpec architectural workflow!`
    )
  );
  console.log(`  OpenSpec Directory: ${pc.cyan(result.openspecChangeDir)}`);
  console.log(
    `  Created:            ${pc.yellow('proposal.md, design.md, tasks.md')}`
  );
}
