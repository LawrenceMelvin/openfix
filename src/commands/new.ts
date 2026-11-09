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

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export function runNewBug(
  id: string,
  title: string,
  options: NewBugOptions = {}
): {
  bugDir: string;
  meta: BugMetadata;
  reproScriptPath: string;
  reproStepsPath: string;
} {
  const cwd = options.cwd ?? process.cwd();
  if (!isInitialized(cwd)) {
    runInit({ cwd });
  }

  const config = loadConfig(cwd);
  const cleanId = id.trim();
  const folderName = `${cleanId}-${slugify(title)}`;
  const bugDir = path.resolve(cwd, config.bugsDir, folderName);

  if (fs.existsSync(bugDir)) {
    throw new Error(`Bug workspace already exists at ${bugDir}`);
  }

  const now = new Date().toISOString();
  const reproMode: ReproMode = options.mode ?? 'unit-fixture';

  const meta: BugMetadata = {
    id: cleanId,
    title,
    jiraUrl: options.jiraUrl,
    screenshots: options.screenshots ?? [],
    status: 'INTAKE',
    reproMode,
    createdAt: now,
    updatedAt: now,
    reproHistory: [],
    verificationPassed: false,
  };

  fs.mkdirSync(bugDir, { recursive: true });
  const reproDir = path.join(bugDir, '2-repro');
  fs.mkdirSync(reproDir, { recursive: true });

  // Write stage files
  fs.writeFileSync(
    path.join(bugDir, '0-intake.md'),
    renderIntakeMarkdown(meta),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(bugDir, '1-triage.md'),
    renderTriageMarkdown(meta),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(reproDir, 'fixture.json'),
    renderReproFixtureJson(meta),
    'utf-8'
  );

  const reproStepsPath = path.join(reproDir, 'REPRO_STEPS.md');
  fs.writeFileSync(reproStepsPath, renderReproStepsMarkdown(meta), 'utf-8');

  const starter = renderReproStarterScript(meta, reproMode);
  const reproScriptPath = path.join(reproDir, starter.filename);
  fs.writeFileSync(reproScriptPath, starter.content, 'utf-8');

  fs.writeFileSync(
    path.join(bugDir, '3-rca.md'),
    renderRcaMarkdown(meta),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(bugDir, '3b-impact.md'),
    renderImpactMarkdown(meta),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(bugDir, '4-tasks.md'),
    renderTasksMarkdown(meta),
    'utf-8'
  );

  saveBugMeta(bugDir, meta);
  syncKnownIssuesRunbook(cwd);

  return { bugDir, meta, reproScriptPath, reproStepsPath };
}

export function printNewBugResult(
  result: ReturnType<typeof runNewBug>
): void {
  console.log(
    pc.green(`✔ Created OpenFix workspace for ${pc.bold(result.meta.id)}`)
  );
  console.log(`  Directory:   ${pc.cyan(result.bugDir)}`);
  console.log(`  Repro Guide: ${pc.cyan(result.reproStepsPath)}`);
  console.log(`  Repro Mode:  ${pc.yellow(result.meta.reproMode)}`);
  console.log(`  Next Step:   Fill ${pc.cyan('0-intake.md')} & ${pc.cyan('1-triage.md')}, then run:`);
  console.log(`               ${pc.bold(`openfix triage ${result.meta.id} --classify <type>`)}`);
}
