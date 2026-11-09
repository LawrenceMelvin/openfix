import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  runExport,
  runInit,
  runNewBug,
  runRca,
  runRepro,
  runTriage,
} from '../src/index.js';

describe('Documentation, REPRO_STEPS.md, Confluence/Jira Exporters & KNOWN_ISSUES Runbook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfix-docs-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates 2-repro/REPRO_STEPS.md on new bug and populates RED proof after repro', () => {
    runInit({ cwd: tmpDir });
    const created = runNewBug('BUG-700', 'Coupon FREE100 crashes checkout', {
      cwd: tmpDir,
      mode: 'unit-fixture',
    });

    expect(fs.existsSync(created.reproStepsPath)).toBe(true);
    const initialSteps = fs.readFileSync(created.reproStepsPath, 'utf-8');
    expect(initialSteps).toContain('How to Reproduce This Issue: BUG-700');
    expect(initialSteps).toContain(
      'Step-by-Step Application / UI Reproduction (For QA & Analysts)'
    );
    expect(initialSteps).toContain('PENDING');

    runTriage('BUG-700', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-700', { cwd: tmpDir });

    const updatedSteps = fs.readFileSync(created.reproStepsPath, 'utf-8');
    expect(updatedSteps).toContain('YES (Verified)');
    expect(updatedSteps).toContain('Recorded Failing Run (RED Proof)');
    expect(updatedSteps).toContain('FAIL [BUG-700]');
  });

  it('auto-updates .openfix/KNOWN_ISSUES.md runbook right after Step 1 Triage and Step 2 Repro', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-701', 'External ERP timeout 504', { cwd: tmpDir });
    const triageRes = runTriage('BUG-701', {
      cwd: tmpDir,
      classify: 'external-server-issue',
    });

    expect(fs.existsSync(triageRes.runbookPath)).toBe(true);
    const runbookAfterTriage = fs.readFileSync(triageRes.runbookPath, 'utf-8');
    expect(runbookAfterTriage).toContain('BUG-701');
    expect(runbookAfterTriage).toContain('external-server-issue');
    expect(runbookAfterTriage).toContain('External Server Outage');

    // Add a second bug that is an internal code bug and reproduce it
    runNewBug('BUG-702', 'Cart badge shows negative count', { cwd: tmpDir });
    runTriage('BUG-702', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-702', { cwd: tmpDir });
    runRca('BUG-702', { cwd: tmpDir, size: 'small' });

    const runbookAfterRca = fs.readFileSync(triageRes.runbookPath, 'utf-8');
    expect(runbookAfterRca).toContain('BUG-702');
    expect(runbookAfterRca).toContain('How to Reproduce (BUG-702)');
    expect(runbookAfterRca).toContain('ANALYZED');
  });

  it('exports Confluence, Jira Comment, Markdown, and JSON formats with How to Reproduce included', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-800', 'PDF invoice blank on Safari', {
      cwd: tmpDir,
      jiraUrl: 'https://jira.company.com/browse/BUG-800',
    });
    runTriage('BUG-800', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-800', { cwd: tmpDir });
    runRca('BUG-800', { cwd: tmpDir, size: 'medium' });

    // 1. Confluence export
    const confluenceRes = runExport('BUG-800', {
      cwd: tmpDir,
      format: 'confluence',
    });
    expect(confluenceRes.reportPath.endsWith('CONFLUENCE_DOC.xml')).toBe(true);
    expect(confluenceRes.reportContent).toContain('<ac:structured-macro');
    expect(confluenceRes.reportContent).toContain(
      '2. How to Reproduce This Issue (QA UI Steps &amp; Technical Probe)'
    );

    // 2. Jira comment export
    const jiraRes = runExport('BUG-800', {
      cwd: tmpDir,
      format: 'jira',
    });
    expect(jiraRes.reportPath.endsWith('JIRA_COMMENT.txt')).toBe(true);
    expect(jiraRes.reportContent).toContain(
      'h3. 2. How to Reproduce & Retest This Issue (QA Guide)'
    );
    expect(jiraRes.reportContent).toContain('YES (Verified)');

    // 3. JSON export (for API / MCP / Webhook sync)
    const jsonRes = runExport('BUG-800', {
      cwd: tmpDir,
      format: 'json',
    });
    expect(jsonRes.reportPath.endsWith('BUG_REPORT.json')).toBe(true);
    const parsed = JSON.parse(jsonRes.reportContent) as {
      id: string;
      howToReproduce: {
        reproducedRed: boolean;
        reproStepsMarkdown: string;
      };
    };
    expect(parsed.id).toBe('BUG-800');
    expect(parsed.howToReproduce.reproducedRed).toBe(true);
    expect(parsed.howToReproduce.reproStepsMarkdown).toContain(
      'Step-by-Step Application / UI Reproduction'
    );

    // 4. Markdown export
    const mdRes = runExport('BUG-800', {
      cwd: tmpDir,
      format: 'markdown',
    });
    expect(mdRes.reportContent).toContain(
      '## 2. How to Reproduce This Issue (UI & Technical Steps)'
    );
  });
});
