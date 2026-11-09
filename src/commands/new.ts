import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { BugMetadata, ReproMode } from '../types.js';
import { isInitialized, loadConfig } from '../core/config.js';
import { syncKnownIssuesRunbook } from '../core/doc-exporters.js';
import { saveBugMeta } from '../core/state.js';
import {
  renderImpactMarkdown,
  renderIntakeMarkdown,
  renderRcaMarkdown,
  renderReproFixtureJson,
  renderReproStarterScript,
  renderReproStepsMarkdown,
  renderTasksMarkdown,
  renderTriageMarkdown,
} from '../core/templates.js';
import { runInit } from './init.js';

export interface NewBugOptions {
  cwd?: string;
  jiraUrl?: string;
  screenshots?: string[];
  mode?: ReproMode;
}

export function runNewBug(
  id: string,
  title: string,
  options: NewBugOptions = {}
): { bugDir: string; meta: BugMetadata } {
  const cwd = options.cwd ?? process.cwd();

  if (!isInitialized(cwd)) {
    runInit({ cwd });
  }

  const config = loadConfig(cwd);
  const bugDir = path.resolve(cwd, config.bugsDir, id);

  if (fs.existsSync(bugDir)) {
    throw new Error(`Bug workspace already exists at ${bugDir}`);
  }

  const now = new Date().toISOString();
  const reproMode: ReproMode = options.mode ?? 'unit-fixture';

  const meta: BugMetadata = {
    id,
    title,
    jiraUrl: options.jiraUrl,
    screenshots: options.screenshots ?? [],
    reproMode,
    createdAt: now,
    status: 'INTAKE',
    reproHistory: [],
    artifacts: {
      intake: '0-intake.md',
      triage: '1-triage.md',
      reproSteps: '2-repro/REPRO_STEPS.md',
      rca: '3-rca.md',
      impact: '3b-impact.md',
      tasks: '4-tasks.md',
    },
  };

  // Create workspace structure
  fs.mkdirSync(bugDir, { recursive: true });
  fs.mkdirSync(path.join(bugDir, '2-repro'), { recursive: true });

  // Write stage files
  fs.writeFileSync(path.join(bugDir, '0-intake.md'), renderIntakeMarkdown(meta), 'utf-8');
  fs.writeFileSync(path.join(bugDir, '1-triage.md'), renderTriageMarkdown(meta), 'utf-8');
  fs.writeFileSync(
    path.join(bugDir, '2-repro', 'REPRO_STEPS.md'),
    renderReproStepsMarkdown(meta),
    'utf-8'
  );

  const fixtureContent = renderReproFixtureJson(meta);
  if (fixtureContent) {
    fs.writeFileSync(
      path.join(bugDir, '2-repro', 'fixture.json'),
      fixtureContent,
      'utf-8'
    );
  }

  const starter = renderReproStarterScript(meta, config.detectedStack);
  fs.writeFileSync(
    path.join(bugDir, '2-repro', starter.filename),
    starter.content,
    'utf-8'
  );

  fs.writeFileSync(path.join(bugDir, '3-rca.md'), renderRcaMarkdown(meta), 'utf-8');
  fs.writeFileSync(path.join(bugDir, '3b-impact.md'), renderImpactMarkdown(meta), 'utf-8');
  fs.writeFileSync(path.join(bugDir, '4-tasks.md'), renderTasksMarkdown(meta), 'utf-8');

  // Save metadata
  saveBugMeta(bugDir, meta);

  // Sync Known Issues runbook
  syncKnownIssuesRunbook(cwd);

  return { bugDir, meta };
}

export function printNewBugResult(result: ReturnType<typeof runNewBug>): void {
  const { meta, bugDir } = result;
  console.log(pc.green(`✔ Created bug workspace for ${pc.bold(meta.id)}`));
  console.log(`  Title:       ${meta.title}`);
  console.log(`  Directory:   ${pc.cyan(bugDir)}`);
  console.log(`  Repro Mode:  ${pc.yellow(meta.reproMode)}`);
  console.log(`  Status:      ${pc.magenta(meta.status)}`);
  console.log('\nNext Steps:');
  console.log(`  1. Inspect ${pc.cyan('0-intake.md')} to review ticket clues.`);
  console.log(`  2. Trace call-chain in ${pc.cyan('1-triage.md')}.`);
  console.log(
    `  3. Run ${pc.bold(`openfix triage ${meta.id} --classify <code-defect|external-server-issue|already-in-progress|need-more-info>`)}`
  );
}
