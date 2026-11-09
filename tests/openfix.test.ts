import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getStatus,
  runEscalate,
  runExport,
  runInit,
  runNewBug,
  runPromote,
  runRca,
  runRepro,
  runTriage,
  runVerify,
} from '../src/index.js';

describe('OpenFix End-to-End Lifecycle & Gate Enforcement', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfix-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes .openfix config and agent protocol', () => {
    const res = runInit({ cwd: tmpDir });
    expect(fs.existsSync(res.configPath)).toBe(true);
    expect(res.createdAgentRules.length).toBe(1);
    expect(fs.existsSync(res.createdAgentRules[0]!)).toBe(true);
  });

  it('halts on external-server-issue and generates an analyst report without touching code', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-201', 'Payment gateway 502 error on submit', {
      cwd: tmpDir,
      jiraUrl: 'https://jira.example.com/browse/BUG-201',
      screenshots: ['screenshots/payment-502.png'],
      mode: 'api-probe',
    });

    const triaged = runTriage('BUG-201', {
      cwd: tmpDir,
      classify: 'external-server-issue',
    });
    expect(triaged.meta.status).toBe('HALTED_EXTERNAL');

    // Attempting to run repro on a halted external issue should throw
    expect(() => runRepro('BUG-201', { cwd: tmpDir })).toThrow(
      /HALTED_EXTERNAL/
    );

    // Exporting analyst report clearly explains it is an external server issue
    const exported = runExport('BUG-201', { cwd: tmpDir });
    expect(exported.reportContent).toContain(
      'NOT A CODE BUG — EXTERNAL SERVER / THIRD-PARTY ISSUE'
    );
    expect(exported.reportContent).toContain('external-server-issue');
  });

  it('halts on already-in-progress duplicate ticket and links the active ticket', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-202', 'Duplicate tax rounding error', { cwd: tmpDir });

    const triaged = runTriage('BUG-202', {
      cwd: tmpDir,
      classify: 'already-in-progress',
      linkedTicket: 'BUG-100',
    });
    expect(triaged.meta.status).toBe('HALTED_DUPLICATE');
    expect(triaged.meta.linkedTicket).toBe('BUG-100');

    const exported = runExport('BUG-202', { cwd: tmpDir });
    expect(exported.reportContent).toContain('BUG-100');
  });

  it('enforces the Reproduction Gate (blocks RCA and Verify if bug was never reproduced in RED state)', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-301', 'Invoice total shows NaN', { cwd: tmpDir });
    runTriage('BUG-301', { cwd: tmpDir, classify: 'internal-code-bug' });

    // Trying to record RCA or Verify before achieving a failing reproduction must throw
    expect(() =>
      runRca('BUG-301', { cwd: tmpDir, size: 'small' })
    ).toThrow(/Reproduction Gate Violation/);

    expect(() => runVerify('BUG-301', { cwd: tmpDir })).toThrow(
      /Reproduction Gate Violation/
    );
  });

  it('completes the full 5-stage Red-to-Green lifecycle and promotes the regression test', () => {
    runInit({ cwd: tmpDir });

    // Stage 0: Intake
    const created = runNewBug('BUG-404', 'Null crash on empty discount', {
      cwd: tmpDir,
      jiraUrl: 'https://jira.example.com/browse/BUG-404',
      screenshots: ['ui-crash.png'],
      mode: 'unit-fixture',
    });
    expect(fs.existsSync(path.join(created.bugDir, '0-intake.md'))).toBe(true);
    expect(fs.existsSync(path.join(created.bugDir, '1-triage.md'))).toBe(true);
    expect(fs.existsSync(created.reproScriptPath)).toBe(true);

    // Stage 1: Triage
    const triaged = runTriage('BUG-404', {
      cwd: tmpDir,
      classify: 'internal-code-bug',
    });
    expect(triaged.meta.status).toBe('TRIAGED');

    // Stage 2: Reproduction (Starter script fails by default on null sampleField -> achieves RED state)
    const reproRes = runRepro('BUG-404', { cwd: tmpDir });
    expect(reproRes.reproducedRed).toBe(true);
    expect(reproRes.meta.status).toBe('REPRODUCED');

    // Stage 3: RCA & Sizing
    const rcaRes = runRca('BUG-404', { cwd: tmpDir, size: 'small' });
    expect(rcaRes.meta.status).toBe('ANALYZED');
    expect(rcaRes.meta.fixSize).toBe('small');

    // Simulate fixing the bug so the reproduction fixture/check now passes (GREEN state)
    const fixturePath = path.join(created.bugDir, '2-repro', 'fixture.json');
    fs.writeFileSync(
      fixturePath,
      JSON.stringify(
        {
          bugId: 'BUG-404',
          observedInput: { sampleField: 'FIXED_VALUE' },
        },
        null,
        2
      ),
      'utf-8'
    );

    // Stage 4: Verify Red -> Green
    const verifyRes = runVerify('BUG-404', { cwd: tmpDir });
    expect(verifyRes.reproPassed).toBe(true);
    expect(verifyRes.meta.status).toBe('VERIFIED');
    expect(verifyRes.meta.verificationPassed).toBe(true);

    // Stage 5: Promote to permanent regression suite & export Analyst Report
    const promoteRes = runPromote('BUG-404', { cwd: tmpDir });
    expect(promoteRes.meta.status).toBe('CLOSED');
    expect(promoteRes.promotedFiles.length).toBeGreaterThan(0);

    const exported = runExport('BUG-404', { cwd: tmpDir });
    expect(exported.reportContent).toContain(
      'RESOLVED & VERIFIED WITH AUTOMATED REGRESSION TEST'
    );

    const statusList = getStatus('BUG-404', tmpDir);
    expect(statusList[0]?.status).toBe('CLOSED');
  });

  it('escalates big-architectural bugs to OpenSpec proposal, design, and tasks', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-500', 'Cross-service race condition in ledger', {
      cwd: tmpDir,
      mode: 'log-replay',
    });
    runTriage('BUG-500', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-500', { cwd: tmpDir });
    runRca('BUG-500', { cwd: tmpDir, size: 'big-architectural' });

    const escalated = runEscalate('BUG-500', { cwd: tmpDir });
    expect(escalated.meta.status).toBe('ESCALATED_OPENSPEC');
    expect(
      fs.existsSync(path.join(escalated.openspecChangeDir, 'proposal.md'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(escalated.openspecChangeDir, 'design.md'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(escalated.openspecChangeDir, 'tasks.md'))
    ).toBe(true);
  });
});
