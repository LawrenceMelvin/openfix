import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runShellCommand } from '../src/core/runner.js';

describe('OpenFix CLI Binary Subprocess Integration (dist/cli.js)', () => {
  let tmpDir: string;
  const cliPath = path.resolve(process.cwd(), 'dist', 'cli.js');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfix-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs CLI commands end-to-end and returns proper exit codes', () => {
    // 1. openfix init
    const initCmd = runShellCommand(`node "${cliPath}" init`, tmpDir);
    expect(initCmd.exitCode).toBe(0);
    expect(initCmd.combinedOutput).toContain('OpenFix initialized successfully');

    // 2. openfix new
    const newCmd = runShellCommand(
      `node "${cliPath}" new CLI-100 "Button click fails" --mode api-probe`,
      tmpDir
    );
    expect(newCmd.exitCode).toBe(0);
    expect(newCmd.combinedOutput).toContain('CLI-100');

    // 3. openfix triage
    const triageCmd = runShellCommand(
      `node "${cliPath}" triage CLI-100 --classify internal-code-bug`,
      tmpDir
    );
    expect(triageCmd.exitCode).toBe(0);
    expect(triageCmd.combinedOutput).toContain('TRIAGED');

    // 4. openfix repro (returns 0 when RED state is achieved, returns 1 if script unexpectedly passes)
    const falseReproCmd = runShellCommand(
      `node "${cliPath}" repro CLI-100 --cmd "node -e process.exit(0)"`,
      tmpDir
    );
    expect(falseReproCmd.exitCode).toBe(1);

    const validReproCmd = runShellCommand(
      `node "${cliPath}" repro CLI-100`,
      tmpDir
    );
    expect(validReproCmd.exitCode).toBe(0);
    expect(validReproCmd.combinedOutput).toContain('RED STATE ACHIEVED');

    // 5. openfix rca
    const rcaCmd = runShellCommand(
      `node "${cliPath}" rca CLI-100 --size small`,
      tmpDir
    );
    expect(rcaCmd.exitCode).toBe(0);

    // 6. openfix verify (returns 1 when still failing, returns 0 when passing)
    const failedVerifyCmd = runShellCommand(
      `node "${cliPath}" verify CLI-100`,
      tmpDir
    );
    expect(failedVerifyCmd.exitCode).toBe(1);

    const passedVerifyCmd = runShellCommand(
      `node "${cliPath}" verify CLI-100 --repro-cmd "node -e process.exit(0)"`,
      tmpDir
    );
    expect(passedVerifyCmd.exitCode).toBe(0);
    expect(passedVerifyCmd.combinedOutput).toContain('GREEN STATE ACHIEVED');

    // 7. openfix promote & export & status
    const promoteCmd = runShellCommand(
      `node "${cliPath}" promote CLI-100`,
      tmpDir
    );
    expect(promoteCmd.exitCode).toBe(0);

    const exportCmd = runShellCommand(
      `node "${cliPath}" export CLI-100`,
      tmpDir
    );
    expect(exportCmd.exitCode).toBe(0);

    const statusCmd = runShellCommand(
      `node "${cliPath}" status CLI-100`,
      tmpDir
    );
    expect(statusCmd.exitCode).toBe(0);
    expect(statusCmd.combinedOutput).toContain('CLOSED');
  });
});
