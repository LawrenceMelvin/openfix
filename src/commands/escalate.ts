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
    : 'See OpenFix RCA file';

  const openspecProposal = renderOpenSpecEscalation(meta, rcaContent);

  const openspecChangeDir = path.resolve(
    cwd,
    config.openspecDir,
    'changes',
    `fix-${meta.id.toLowerCase()}`
  );
  fs.mkdirSync(openspecChangeDir, { recursive: true });

  fs.writeFileSync(
    path.join(openspecChangeDir, 'proposal.md'),
    openspecProposal,
    'utf-8'
  );

  meta.status = 'ESCALATED_TO_OPENSPEC';
  meta.openspecEscalation = path.relative(cwd, openspecChangeDir);
  saveBugMeta(bugDir, meta);

  return { bugDir, meta, openspecChangeDir };
}

export function printEscalateResult(
  result: ReturnType<typeof runEscalate>
): void {
  const { meta, openspecChangeDir } = result;
  console.log(
    pc.magenta(
      `✔ Escalated ${pc.bold(meta.id)} to OpenSpec architectural proposal!`
    )
  );
  console.log(`  OpenSpec Dir: ${pc.cyan(openspecChangeDir)}`);
  console.log(
    `  Proposal:     ${pc.cyan(path.join(openspecChangeDir, 'proposal.md'))}`
  );
  console.log(
    '\nOpenFix handoff complete. Use "openspec" CLI or OpenSpec workflows to design the architectural change.'
  );
}
