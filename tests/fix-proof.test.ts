import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  runExport,
  runImpact,
  runInit,
  runNewBug,
  runPromote,
  runRca,
  runRepro,
  runTriage,
  runVerify,
} from '../src/index.js';

describe('Stage 5: Post-Fix Documentation & Proof of Resolution (5-fix-proof.md)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfix-proof-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates 5-fix-proof.md with Before (RED) vs After (GREEN) logs, modified files, and Before/After screenshots', () => {
    runInit({ cwd: tmpDir });

    const created = runNewBug('BUG-950', 'Checkout fails on $0 trial coupon', {
      cwd: tmpDir,
      jiraUrl: 'https://jira.company.com/browse/BUG-950',
      screenshots: ['screenshots/before-broken-toast.png'],
      mode: 'unit-fixture',
    });

    runTriage('BUG-950', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-950', { cwd: tmpDir }); // Captures RED failure output
    runRca('BUG-950', { cwd: tmpDir, size: 'small' });
    runImpact('BUG-950', {
      cwd: tmpDir,
      scope: 'isolated-page-or-endpoint',
      db: 'transactional-write',
    });

    // Simulate fixing the bug so the fixture passes
    fs.writeFileSync(
      path.join(created.bugDir, '2-repro', 'fixture.json'),
      JSON.stringify(
        {
          bugId: 'BUG-950',
          observedInput: { sampleField: 'VALIDATED_ZERO_TRIAL' },
        },
        null,
        2
      ),
      'utf-8'
    );

    const verifyRes = runVerify('BUG-950', {
      cwd: tmpDir,
      summary:
        'Normalized $0 trial coupon in CheckoutController before starting DB transaction',
      files: [
        'src/controllers/CheckoutController.ts',
        'src/pages/CheckoutPage.tsx',
      ],
      proofScreenshots: ['screenshots/after-fixed-order-success.png'],
    });

    expect(verifyRes.reproPassed).toBe(true);
    expect(fs.existsSync(verifyRes.fixProofPath)).toBe(true);

    const proofDoc = fs.readFileSync(verifyRes.fixProofPath, 'utf-8');
    // 1. Check Fix Summary & Modified Files
    expect(proofDoc).toContain(
      'Normalized $0 trial coupon in CheckoutController before starting DB transaction'
    );
    expect(proofDoc).toContain('src/controllers/CheckoutController.ts');
    expect(proofDoc).toContain('src/pages/CheckoutPage.tsx');

    // 2. Check Before (RED) vs After (GREEN) Evidence
    expect(proofDoc).toContain('FAILED (Reproduced)');
    expect(proofDoc).toContain('PASSED (Verified)');
    expect(proofDoc).toContain('FAIL [BUG-950]: Function failed on null sampleField');
    expect(proofDoc).toContain('PASS [BUG-950]: Reproduction test passed!');

    // 3. Check Visual Before vs After Screenshots for Jira
    expect(proofDoc).toContain('screenshots/before-broken-toast.png');
    expect(proofDoc).toContain('screenshots/after-fixed-order-success.png');

    // Promote and verify 5-fix-proof.md updates with promoted path
    runPromote('BUG-950', { cwd: tmpDir });
    const updatedProofDoc = fs.readFileSync(verifyRes.fixProofPath, 'utf-8');
    expect(updatedProofDoc).toContain('Permanent regression test added');
  });

  it('includes Fix-Proof & Before/After evidence in Jira, Confluence, and JSON exports', () => {
    runInit({ cwd: tmpDir });
    const created = runNewBug('BUG-951', 'Tax calculation rounding off by 1 cent', {
      cwd: tmpDir,
      screenshots: ['before-tax-err.png'],
    });
    runTriage('BUG-951', { cwd: tmpDir, classify: 'internal-code-bug' });
    runRepro('BUG-951', { cwd: tmpDir });

    fs.writeFileSync(
      path.join(created.bugDir, '2-repro', 'fixture.json'),
      JSON.stringify({ bugId: 'BUG-951', observedInput: { sampleField: 'OK' } }),
      'utf-8'
    );

    runVerify('BUG-951', {
      cwd: tmpDir,
      summary: 'Used banker rounding in TaxCalculator.roundCents',
      files: ['src/utils/TaxCalculator.ts'],
      proofScreenshots: ['after-tax-fixed.png'],
    });

    // Jira export check
    const jiraExport = runExport('BUG-951', { cwd: tmpDir, format: 'jira' });
    expect(jiraExport.reportContent).toContain(
      'Used banker rounding in TaxCalculator.roundCents'
    );
    expect(jiraExport.reportContent).toContain('src/utils/TaxCalculator.ts');
    expect(jiraExport.reportContent).toContain('before-tax-err.png');
    expect(jiraExport.reportContent).toContain('after-tax-fixed.png');
    expect(jiraExport.reportContent).toContain(
      'h3. 5. Fix Documentation & Proof of Resolution (Before vs. After)'
    );

    // Confluence export check
    const confluenceExport = runExport('BUG-951', {
      cwd: tmpDir,
      format: 'confluence',
    });
    expect(confluenceExport.reportContent).toContain(
      '5. Fix Documentation &amp; Proof of Resolution (Before vs. After)'
    );

    // JSON export check
    const jsonExport = runExport('BUG-951', { cwd: tmpDir, format: 'json' });
    const parsed = JSON.parse(jsonExport.reportContent) as {
      fixProof: {
        verified: boolean;
        fixSummary: string;
        modifiedFiles: string[];
        beforeScreenshots: string[];
        afterProofScreenshots: string[];
        beforeRedRun: { exitCode: number };
        afterGreenRun: { exitCode: number };
      };
    };
    expect(parsed.fixProof.verified).toBe(true);
    expect(parsed.fixProof.fixSummary).toBe(
      'Used banker rounding in TaxCalculator.roundCents'
    );
    expect(parsed.fixProof.modifiedFiles).toEqual([
      'src/utils/TaxCalculator.ts',
    ]);
    expect(parsed.fixProof.beforeScreenshots).toEqual(['before-tax-err.png']);
    expect(parsed.fixProof.afterProofScreenshots).toEqual([
      'after-tax-fixed.png',
    ]);
    expect(parsed.fixProof.beforeRedRun.exitCode).toBe(1);
    expect(parsed.fixProof.afterGreenRun.exitCode).toBe(0);
  });
});
