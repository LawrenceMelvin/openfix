#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import type {
  DbImpact,
  ExportFormat,
  FixScope,
  FixSize,
  ReproMode,
  TriageClassification,
} from './types.js';
import { printInitResult, runInit } from './commands/init.js';
import { printNewBugResult, runNewBug } from './commands/new.js';
import { printTriageResult, runTriage } from './commands/triage.js';
import { printReproResult, runRepro } from './commands/repro.js';
import { printRcaResult, runRca } from './commands/rca.js';
import { printImpactResult, runImpact } from './commands/impact.js';
import { printEscalateResult, runEscalate } from './commands/escalate.js';
import { printVerifyResult, runVerify } from './commands/verify.js';
import { printPromoteResult, runPromote } from './commands/promote.js';
import { printExportResult, runExport } from './commands/export.js';
import { getStatus, printStatus } from './commands/status.js';

const program = new Command();

program
  .name('openfix')
  .description(
    'OpenFix: Test-Driven Bug Fixing (TDBF) & Root Cause Analysis (RCA) CLI'
  )
  .version('0.1.0');

program
  .command('init')
  .description('Initialize OpenFix in the current repository')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--no-agents', 'Skip generating AI agent protocol rules')
  .action((opts: { force?: boolean; agents?: boolean }) => {
    try {
      const res = runInit({ force: opts.force, agents: opts.agents });
      printInitResult(res);
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('new <id> <title>')
  .description('Create a new bug workspace from a Jira ticket / screenshot')
  .option('-j, --jira <url>', 'Link to Jira / GitHub issue URL')
  .option(
    '-s, --screenshot <paths...>',
    'Paths or descriptions of UI screenshots'
  )
  .option(
    '-m, --mode <mode>',
    'Reproduction mode: unit-fixture | api-probe | ui-e2e | log-replay',
    'unit-fixture'
  )
  .action(
    (
      id: string,
      title: string,
      opts: { jira?: string; screenshot?: string[]; mode?: ReproMode }
    ) => {
      try {
        const res = runNewBug(id, title, {
          jiraUrl: opts.jira,
          screenshots: opts.screenshot,
          mode: opts.mode,
        });
        printNewBugResult(res);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    }
  );

program
  .command('triage <id>')
  .description('Classify the bug at Stage 1 (internal bug vs external server vs duplicate)')
  .requiredOption(
    '-c, --classify <type>',
    'internal-code-bug | external-server-issue | already-in-progress | environment-or-data | working-as-intended | need-more-info'
  )
  .option('-l, --linked-ticket <ticket>', 'Linked ticket ID if already-in-progress')
  .action(
    (
      id: string,
      opts: { classify: TriageClassification; linkedTicket?: string }
    ) => {
      try {
        const res = runTriage(id, {
          classify: opts.classify,
          linkedTicket: opts.linkedTicket,
        });
        printTriageResult(res);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    }
  );

program
  .command('repro <id>')
  .description('Run Stage 2 reproduction and verify deterministic failure (RED state)')
  .option('--cmd <command>', 'Custom reproduction command')
  .action((id: string, opts: { cmd?: string }) => {
    try {
      const res = runRepro(id, { cmd: opts.cmd });
      printReproResult(res);
      if (!res.reproducedRed) {
        process.exit(1);
      }
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('rca <id>')
  .description('Record Stage 3 Root Cause Analysis & Fix Sizing')
  .requiredOption(
    '-s, --size <size>',
    'Fix size: small | medium | big-architectural'
  )
  .option('--allow-without-repro', 'Bypass reproduction gate (emergency only)')
  .action(
    (
      id: string,
      opts: { size: FixSize; allowWithoutRepro?: boolean }
    ) => {
      try {
        const res = runRca(id, {
          size: opts.size,
          allowWithoutRepro: opts.allowWithoutRepro,
        });
        printRcaResult(res);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    }
  );

program
  .command('impact <id>')
  .description(
    'Record Stage 3b Full-Flow, DB Transaction, Caller Blast-Radius & Effective Fix Audit'
  )
  .requiredOption(
    '--scope <scope>',
    'isolated-page-or-endpoint | shared-service-module | cross-system'
  )
  .requiredOption(
    '--db <dbImpact>',
    'none | read-only-query | transactional-write | schema-or-migration'
  )
  .option('-s, --size <size>', 'small | medium | big-architectural')
  .option(
    '--grill-pending',
    'Pause in NEED_CLARIFICATION until user answers questions in 3b-impact.md'
  )
  .action(
    (
      id: string,
      opts: {
        scope: FixScope;
        db: DbImpact;
        size?: FixSize;
        grillPending?: boolean;
      }
    ) => {
      try {
        const res = runImpact(id, {
          scope: opts.scope,
          db: opts.db,
          size: opts.size,
          grillPending: opts.grillPending,
        });
        printImpactResult(res);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    }
  );

program
  .command('escalate <id>')
  .description('Escalate a big-architectural bug into an OpenSpec proposal')
  .action((id: string) => {
    try {
      const res = runEscalate(id);
      printEscalateResult(res);
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('verify <id>')
  .description(
    'Verify Stage 4 fix: reproduction transitions from RED -> GREEN and generates 5-fix-proof.md'
  )
  .option('--repro-cmd <command>', 'Custom reproduction command')
  .option('--regression-cmd <command>', 'Full test suite command to verify no regressions')
  .option('--summary <text>', 'Short summary of what was changed in the fix')
  .option('--files <paths...>', 'List of source files modified for the fix')
  .option(
    '--proof-screenshot <paths...>',
    'Post-fix UI screenshots or evidence files for Jira'
  )
  .action(
    (
      id: string,
      opts: {
        reproCmd?: string;
        regressionCmd?: string;
        summary?: string;
        files?: string[];
        proofScreenshot?: string[];
      }
    ) => {
      try {
        const res = runVerify(id, {
          reproCmd: opts.reproCmd,
          regressionCmd: opts.regressionCmd,
          summary: opts.summary,
          files: opts.files,
          proofScreenshots: opts.proofScreenshot,
        });
        printVerifyResult(res);
        if (!res.reproPassed || !res.regressionPassed) {
          process.exit(1);
        }
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exit(1);
      }
    }
  );

program
  .command('promote <id>')
  .description('Promote verified reproduction into the permanent regression test suite')
  .option('-d, --dest <dir>', 'Custom regression test directory')
  .action((id: string, opts: { dest?: string }) => {
    try {
      const res = runPromote(id, { destDir: opts.dest });
      printPromoteResult(res);
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('export <id>')
  .description(
    'Export documentation (Markdown, Confluence, Jira Comment, or JSON) including How to Reproduce, RCA & Fix-Proof'
  )
  .option(
    '-f, --format <format>',
    'Target format: markdown | confluence | jira | json',
    'markdown'
  )
  .option('-o, --output <path>', 'Custom output file path')
  .action((id: string, opts: { format?: ExportFormat; output?: string }) => {
    try {
      const res = runExport(id, {
        format: opts.format,
        outputPath: opts.output,
      });
      printExportResult(res);
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('status [id]')
  .description('Display lifecycle status and gate progress for tracked bugs')
  .action((id?: string) => {
    try {
      const bugs = getStatus(id);
      printStatus(bugs);
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  });

program.parse(process.argv);
