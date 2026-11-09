import pc from 'picocolors';
import type { BugMetadata } from '../types.js';
import {
  hasDeterministicFailure,
  listAllBugs,
  loadBugMeta,
} from '../core/state.js';

export function getStatus(
  bugId?: string,
  cwd: string = process.cwd()
): BugMetadata[] {
  if (bugId) {
    return [loadBugMeta(bugId, cwd)];
  }
  return listAllBugs(cwd);
}

export function printStatus(bugs: BugMetadata[]): void {
  if (bugs.length === 0) {
    console.log(pc.yellow('No bugs tracked yet. Run "openfix new <id> <title>" to start.'));
    return;
  }

  for (const bug of bugs) {
    const redAchieved = hasDeterministicFailure(bug);
    console.log(
      `${pc.bold(pc.cyan(bug.id))} — ${bug.title} [${pc.yellow(bug.status)}]`
    );
    console.log(
      `  Classification: ${bug.classification ?? 'pending'} | Mode: ${bug.reproMode} | Size: ${bug.fixSize ?? 'pending'}`
    );
    console.log(
      `  Gates: [Triage: ${bug.classification ? '✔' : '·'}] [Repro Red: ${redAchieved ? '✔' : '·'}] [RCA: ${bug.fixSize ? '✔' : '·'}] [Verified Green: ${bug.verificationPassed ? '✔' : '·'}]`
    );
  }
}
