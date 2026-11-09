import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, DbImpact, FixScope, FixSize } from '../types.js';
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
import { renderImpactMarkdown, renderTasksMarkdown } from '../core/templates.js';

export interface ImpactOptions {
  cwd?: string;
  scope: FixScope;
  db: DbImpact;
  size?: FixSize;
  grillPending?: boolean;
  allowWithoutRepro?: boolean;
}

export function runImpact(
  bugId: string,
  options: ImpactOptions
): {
  bugDir: string;
  meta: BugMetadata;
  impactPath: string;
  requiresEscalation: boolean;
} {
  const cwd = options.cwd ?? process.cwd();
  const bugDir = getBugDir(bugId, cwd);
  const meta = loadBugMeta(bugId, cwd);

  if (!hasDeterministicFailure(meta) && !options.allowWithoutRepro) {
    throw new Error(
      `Reproduction Gate Violation: Bug ${meta.id} does not have a recorded failing reproduction (Red state) yet. Run "openfix repro ${meta.id}" before planning the fix impact.`
    );
  }

  meta.fixScope = options.scope;
  meta.dbImpact = options.db;

  // Automatically upgrade size to big-architectural if cross-system or schema-or-migration
  const requiresEscalation =
    options.scope === 'cross-system' ||
    options.db === 'schema-or-migration' ||
    options.size === 'big-architectural';

  if (options.size) {
    meta.fixSize = options.size;
  } else if (requiresEscalation) {
    meta.fixSize = 'big-architectural';
  } else if (options.scope === 'shared-service-module' || options.db === 'transactional-write') {
    meta.fixSize = meta.fixSize ?? 'medium';
  } else {
    meta.fixSize = meta.fixSize ?? 'small';
  }

  if (options.grillPending) {
    meta.clarificationsResolved = false;
    meta.impactReviewed = false;
    meta.status = 'NEED_CLARIFICATION';
  } else {
    meta.clarificationsResolved = true;
    meta.impactReviewed = true;
    meta.status = 'IMPACT_REVIEWED';
  }

  saveBugMeta(bugDir, meta);

  const impactPath = path.join(bugDir, '3b-impact.md');
  fs.writeFileSync(impactPath, renderImpactMarkdown(meta), 'utf-8');

  const tasksPath = path.join(bugDir, '4-tasks.md');
  if (fs.existsSync(tasksPath)) {
    fs.writeFileSync(tasksPath, renderTasksMarkdown(meta), 'utf-8');
  }

  const doc = renderFormattedDocumentation(meta, bugDir, 'markdown');
  fs.writeFileSync(path.join(bugDir, doc.defaultFilename), doc.content, 'utf-8');
  syncKnownIssuesRunbook(cwd);

  return { bugDir, meta, impactPath, requiresEscalation };
}

export function printImpactResult(
  result: ReturnType<typeof runImpact>
): void {
  const { meta, impactPath, requiresEscalation } = result;
  console.log(
    pc.green(
      `✔ Impact, Full-Flow & DB Transaction Audit recorded for ${pc.bold(meta.id)}!`
    )
  );
  console.log(`  Impact Doc:  ${pc.cyan(impactPath)}`);
  console.log(`  Fix Scope:   ${pc.yellow(meta.fixScope ?? '')}`);
  console.log(`  DB Impact:   ${pc.yellow(meta.dbImpact ?? '')}`);
  console.log(`  Fix Size:    ${pc.yellow(meta.fixSize ?? '')}`);

  if (meta.status === 'NEED_CLARIFICATION') {
    console.log(
      pc.bgYellow(pc.black(' GRILL GATE PAUSED ')) +
        ' Waiting on user clarification for flow/DB/caller questions in 3b-impact.md before touching code.'
    );
  } else if (requiresEscalation) {
    console.log(
      pc.magenta(
        `  Architectural / Schema Impact Detected! Run ${pc.bold(`openfix escalate ${meta.id}`)} to bridge this into an OpenSpec proposal.`
      )
    );
  } else {
    console.log(
      `  Next Step: Apply the Effective Fix (avoiding the Weak Fix in 3b-impact.md), then run ${pc.bold(`openfix verify ${meta.id}`)}`
    );
  }
}
