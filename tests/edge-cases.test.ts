import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getStatus,
  loadConfig,
  runInit,
  runNewBug,
  runPromote,
  runRca,
  runRepro,
  runTriage,
  runVerify,
} from '../src/index.js';
import type { ReproMode } from '../src/types.js';

describe('OpenFix Edge Cases, Negative Gates & All 4 Reproduction Modes', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfix-edge-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws clear error when loadConfig is called in an uninitialized repo', () => {
    expect(() => loadConfig(tmpDir)).toThrow(/OpenFix is not initialized/);
  });

  it('auto-initializes OpenFix if runNewBug is called before runInit', () => {
    const res = runNewBug('BUG-001', 'Auto init test', { cwd: tmpDir });
    expect(fs.existsSync(path.join(tmpDir, '.openfix', 'config.json'))).toBe(true);
    expect(res.meta.id).toBe('BUG-001');
  });

  it('prevents creating duplicate bug workspaces with the same ID and title', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-101', 'Same bug title', { cwd: tmpDir });
    expect(() =>
      runNewBug('BUG-101', 'Same bug title', { cwd: tmpDir })
    ).toThrow(/Bug workspace already exists/);
  });

  it('resolves bug IDs case-insensitively and by prefix', () => {
    runInit({ cwd: tmpDir });
    runNewBug('JIRA-999', 'Complex checkout button freeze', { cwd: tmpDir });

    const triaged = runTriage('jira-999', {
      cwd: tmpDir,
      classify: 'internal-code-bug',
    });
    expect(triaged.meta.id).toBe('JIRA-999');
    expect(triaged.meta.status).toBe('TRIAGED');
  });

  it('throws clear error when looking up a non-existent bug ID', () => {
    runInit({ cwd: tmpDir });
    expect(() =>
      runTriage('DOES-NOT-EXIST', {
        cwd: tmpDir,
        classify: 'internal-code-bug',
      })
    ).toThrow(/not found/);
  });

  it('handles need-more-info, environment-or-data, and working-as-intended classifications and blocks repro', () => {
    runInit({ cwd: tmpDir });

    runNewBug('BUG-INFO', 'Vague screenshot without context', { cwd: tmpDir });
    const infoRes = runTriage('BUG-INFO', {
      cwd: tmpDir,
      classify: 'need-more-info',
    });
    expect(infoRes.meta.status).toBe('NEED_CLARIFICATION');
    expect(() => runRepro('BUG-INFO', { cwd: tmpDir })).toThrow(
      /NEED_CLARIFICATION/
    );

    runNewBug('BUG-ENV', 'Missing staging env var', { cwd: tmpDir });
    const envRes = runTriage('BUG-ENV', {
      cwd: tmpDir,
      classify: 'environment-or-data',
    });
    expect(envRes.meta.status).toBe('HALTED_INVALID');
    expect(() => runRepro('BUG-ENV', { cwd: tmpDir })).toThrow(/HALTED_INVALID/);

    runNewBug('BUG-WAI', 'Button disabled when form is empty', { cwd: tmpDir });
    const waiRes = runTriage('BUG-WAI', {
      cwd: tmpDir,
      classify: 'working-as-intended',
    });
    expect(waiRes.meta.status).toBe('HALTED_INVALID');
  });

  it('executes all 4 reproduction modes (unit-fixture, api-probe, ui-e2e, log-replay) in RED state', () => {
    runInit({ cwd: tmpDir });
    const modes: ReproMode[] = [
      'unit-fixture',
      'api-probe',
      'ui-e2e',
      'log-replay',
    ];

    for (const mode of modes) {
      const bugId = `BUG-${mode.toUpperCase()}`;
      runNewBug(bugId, `Testing ${mode}`, { cwd: tmpDir, mode });
      runTriage(bugId, { cwd: tmpDir, classify: 'internal-code-bug' });

      const reproRes = runRepro(bugId, { cwd: tmpDir });
      expect(reproRes.reproducedRed).toBe(true);
      expect(reproRes.meta.status).toBe('REPRODUCED');
      expect(reproRes.record.mode).toBe(mode);
    }

    const allBugs = getStatus(undefined, tmpDir);
    expect(allBugs.length).toBe(4);
  });

  it('rejects a false-positive reproduction (when Stage 2 script exits 0 / PASS instead of failing)', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-FALSE-POS', 'False positive repro', { cwd: tmpDir });
    runTriage('BUG-FALSE-POS', { cwd: tmpDir, classify: 'internal-code-bug' });

    // Run a command that exits 0 (PASS) during Stage 2 reproduction
    const reproRes = runRepro('BUG-FALSE-POS', {
      cwd: tmpDir,
      cmd: 'node -e "process.exit(0)"',
    });

    expect(reproRes.reproducedRed).toBe(false);
    // Status must remain TRIAGED, not REPRODUCED
    expect(reproRes.meta.status).toBe('TRIAGED');

    // Stage 3 RCA and Stage 4 Verify must still be blocked by the Reproduction Gate
    expect(() =>
      runRca('BUG-FALSE-POS', { cwd: tmpDir, size: 'small' })
    ).toThrow(/Reproduction Gate Violation/);
    expect(() => runVerify('BUG-FALSE-POS', { cwd: tmpDir })).toThrow(
      /Reproduction Gate Violation/
    );
  });

  it('blocks verification and promotion when the bug fix fails (repro still exits non-zero)', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-UNFIXED', 'Still broken after patch', { cwd: tmpDir });
    runTriage('BUG-UNFIXED', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-UNFIXED', { cwd: tmpDir }); // Achieves RED
    runRca('BUG-UNFIXED', { cwd: tmpDir, size: 'small' });

    // Run verify without fixing the bug -> repro script still fails!
    const verifyRes = runVerify('BUG-UNFIXED', { cwd: tmpDir });
    expect(verifyRes.reproPassed).toBe(false);
    expect(verifyRes.meta.verificationPassed).toBe(false);
    expect(verifyRes.meta.status).toBe('ANALYZED');

    // Attempting to promote an unverified fix must throw a Verification Gate Violation
    expect(() => runPromote('BUG-UNFIXED', { cwd: tmpDir })).toThrow(
      /Verification Gate Violation/
    );
  });

  it('rejects verification when reproduction passes (GREEN) but the regression test suite fails', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-REGRESSION', 'Fix breaks existing test', { cwd: tmpDir });
    runTriage('BUG-REGRESSION', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-REGRESSION', { cwd: tmpDir }); // Achieves RED
    runRca('BUG-REGRESSION', { cwd: tmpDir, size: 'medium' });

    // Repro command passes (0), but regression suite fails (1)
    const verifyRes = runVerify('BUG-REGRESSION', {
      cwd: tmpDir,
      reproCmd: 'node -e "process.exit(0)"',
      regressionCmd: 'node -e "console.error(\'Regression broken!\'); process.exit(1)"',
    });

    expect(verifyRes.reproPassed).toBe(true);
    expect(verifyRes.regressionPassed).toBe(false);
    expect(verifyRes.meta.verificationPassed).toBe(false);
    expect(verifyRes.meta.status).toBe('ANALYZED');

    // Cannot promote when regression suite failed
    expect(() => runPromote('BUG-REGRESSION', { cwd: tmpDir })).toThrow(
      /Verification Gate Violation/
    );
  });
});
