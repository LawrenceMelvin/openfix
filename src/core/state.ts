import fs from 'node:fs';
import path from 'node:path';
import type { BugMetadata, BugStatus } from '../types.js';
import { loadConfig } from './config.js';

export const META_FILENAME = 'meta.json';

export function getBugsRoot(cwd: string = process.cwd()): string {
  const config = loadConfig(cwd);
  return path.resolve(cwd, config.bugsDir);
}

export function getBugDir(bugId: string, cwd: string = process.cwd()): string {
  const bugsRoot = getBugsRoot(cwd);
  const direct = path.join(bugsRoot, bugId);
  if (fs.existsSync(direct)) {
    return direct;
  }

  // Also allow matching by prefix (e.g. "BUG-104" matches "BUG-104-checkout-timeout")
  if (fs.existsSync(bugsRoot)) {
    const entries = fs.readdirSync(bugsRoot, { withFileTypes: true });
    const match = entries.find(
      (e) =>
        e.isDirectory() &&
        (e.name.toLowerCase() === bugId.toLowerCase() ||
          e.name.toLowerCase().startsWith(`${bugId.toLowerCase()}-`))
    );
    if (match) {
      return path.join(bugsRoot, match.name);
    }
  }

  return direct;
}

export function loadBugMeta(
  bugId: string,
  cwd: string = process.cwd()
): BugMetadata {
  const bugDir = getBugDir(bugId, cwd);
  const metaPath = path.join(bugDir, META_FILENAME);
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Bug workspace "${bugId}" not found at ${bugDir}`);
  }
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as BugMetadata;
}

export function saveBugMeta(
  bugDir: string,
  meta: BugMetadata
): void {
  meta.updatedAt = new Date().toISOString();
  fs.mkdirSync(bugDir, { recursive: true });
  fs.writeFileSync(
    path.join(bugDir, META_FILENAME),
    JSON.stringify(meta, null, 2) + '\n',
    'utf-8'
  );
}

export function listAllBugs(cwd: string = process.cwd()): BugMetadata[] {
  const bugsRoot = getBugsRoot(cwd);
  if (!fs.existsSync(bugsRoot)) {
    return [];
  }

  const dirs = fs
    .readdirSync(bugsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const list: BugMetadata[] = [];
  for (const dir of dirs) {
    const metaPath = path.join(bugsRoot, dir.name, META_FILENAME);
    if (fs.existsSync(metaPath)) {
      try {
        list.push(
          JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as BugMetadata
        );
      } catch {
        // Ignore corrupted metadata
      }
    }
  }
  return list;
}

/**
 * Checks if a bug has recorded at least one deterministic failing reproduction
 * (Red State) — the core gate before allowing verification of a code fix.
 */
export function hasDeterministicFailure(meta: BugMetadata): boolean {
  return meta.reproHistory.some((r) => !r.passed && r.exitCode !== 0);
}

/**
 * Checks whether the bug is in a terminal halted state (not requiring code changes).
 */
export function isHaltedState(status: BugStatus): boolean {
  return (
    status === 'HALTED_EXTERNAL' ||
    status === 'HALTED_DUPLICATE' ||
    status === 'HALTED_INVALID' ||
    status === 'NEED_CLARIFICATION' ||
    status === 'ESCALATED_OPENSPEC'
  );
}
