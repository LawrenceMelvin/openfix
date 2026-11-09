import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  runExport,
  runImpact,
  runInit,
  runNewBug,
  runRca,
  runRepro,
  runTriage,
  runVerify,
} from '../src/index.js';

describe('Stage 3b: End-to-End Flow, DB Transactions, Caller Blast Radius & Grill Gate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfix-impact-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scaffolds 3b-impact.md with Full Flow, DB Transactions, Callers, Weak vs Effective Fix, and Grill questions', () => {
    runInit({ cwd: tmpDir });
    const created = runNewBug('BUG-900', 'Order submit double-charges card', {
      cwd: tmpDir,
    });

    const impactFile = path.join(created.bugDir, '3b-impact.md');
    expect(fs.existsSync(impactFile)).toBe(true);
    const content = fs.readFileSync(impactFile, 'utf-8');
    expect(content).toContain(
      '1. Full End-to-End Operation Flow & In-Between Connections'
    );
    expect(content).toContain(
      '2. Database Operations & Transaction Boundary Audit'
    );
    expect(content).toContain(
      '3. Organization Repo Blast-Radius & Caller Isolation'
    );
    expect(content).toContain(
      '4. "Weak Fix" (Rejected) vs. "Effective Fix" (Approved)'
    );
    expect(content).toContain(
      '5. "Grill the User" — Clarification Questions Before Coding'
    );
  });

  it('blocks runImpact if the bug has not been reproduced in RED state first', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-901', 'Unreproduced bug', { cwd: tmpDir });
    runTriage('BUG-901', { cwd: tmpDir, classify: 'internal-code-bug' });

    expect(() =>
      runImpact('BUG-901', {
        cwd: tmpDir,
        scope: 'isolated-page-or-endpoint',
        db: 'none',
      })
    ).toThrow(/Reproduction Gate Violation/);
  });

  it('pauses at NEED_CLARIFICATION when grillPending is true and blocks verify until resolved', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-902', 'Ambiguous DB rollback behavior on partial refund', {
      cwd: tmpDir,
    });
    runTriage('BUG-902', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-902', { cwd: tmpDir }); // Achieves RED
    runRca('BUG-902', { cwd: tmpDir, size: 'medium' });

    // Agent identifies ambiguous DB transaction behavior and pauses to grill the user
    const grillRes = runImpact('BUG-902', {
      cwd: tmpDir,
      scope: 'shared-service-module',
      db: 'transactional-write',
      grillPending: true,
    });
    expect(grillRes.meta.status).toBe('NEED_CLARIFICATION');
    expect(grillRes.meta.clarificationsResolved).toBe(false);

    // Attempting to verify a code fix while Grill Gate is pending must throw!
    expect(() =>
      runVerify('BUG-902', {
        cwd: tmpDir,
        reproCmd: 'node -e "process.exit(0)"',
      })
    ).toThrow(/Clarification ("Grill") Gate Violation/);

    // Once user answers the grill questions, re-run impact with grillPending: false
    const resolvedRes = runImpact('BUG-902', {
      cwd: tmpDir,
      scope: 'isolated-page-or-endpoint',
      db: 'transactional-write',
      grillPending: false,
    });
    expect(resolvedRes.meta.status).toBe('IMPACT_REVIEWED');
    expect(resolvedRes.meta.clarificationsResolved).toBe(true);
    expect(resolvedRes.meta.impactReviewed).toBe(true);

    // Now verify succeeds!
    const verifyRes = runVerify('BUG-902', {
      cwd: tmpDir,
      reproCmd: 'node -e "process.exit(0)"',
    });
    expect(verifyRes.meta.status).toBe('VERIFIED');
  });

  it('automatically flags big-architectural escalation when DB schema migration or cross-system scope is selected', () => {
    runInit({ cwd: tmpDir });
    runNewBug('BUG-903', 'Missing unique index causes duplicate ledger rows', {
      cwd: tmpDir,
    });
    runTriage('BUG-903', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-903', { cwd: tmpDir });

    const impactRes = runImpact('BUG-903', {
      cwd: tmpDir,
      scope: 'shared-service-module',
      db: 'schema-or-migration',
    });

    expect(impactRes.requiresEscalation).toBe(true);
    expect(impactRes.meta.fixSize).toBe('big-architectural');

    const exportedJson = runExport('BUG-903', {
      cwd: tmpDir,
      format: 'json',
    });
    const parsed = JSON.parse(exportedJson.reportContent) as {
      fixScope: string;
      dbImpact: string;
      fixSize: string;
    };
    expect(parsed.fixScope).toBe('shared-service-module');
    expect(parsed.dbImpact).toBe('schema-or-migration');
    expect(parsed.fixSize).toBe('big-architectural');
  });
});
