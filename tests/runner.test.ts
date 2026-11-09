import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectProjectRunner, runShellCommand } from '../src/core/runner.js';

describe('Multi-Stack Test Runner Auto-Detection (detectProjectRunner)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfix-runner-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects Vitest in a Node project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^2.0.0' } }),
      'utf-8'
    );
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('node-vitest');
    expect(runner.testCommand).toBe('npx vitest run');
    expect(runner.reproExtension).toBe('.repro.test.ts');
  });

  it('detects Jest in a Node project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
      'utf-8'
    );
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('node-jest');
    expect(runner.testCommand).toBe('npx jest');
    expect(runner.regressionDir).toBe('__tests__/regressions');
  });

  it('detects Playwright in a Node project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { '@playwright/test': '^1.48.0' } }),
      'utf-8'
    );
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('node-playwright');
    expect(runner.testCommand).toBe('npx playwright test');
    expect(runner.reproExtension).toBe('.repro.spec.ts');
  });

  it('falls back to npm test or node --test for generic Node projects', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { test: 'mocha' } }),
      'utf-8'
    );
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('node');
    expect(runner.testCommand).toBe('npm test');
  });

  it('detects Python pytest from pyproject.toml or pytest.ini', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[tool.pytest]', 'utf-8');
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('python-pytest');
    expect(runner.testCommand).toBe('pytest');
    expect(runner.reproExtension).toBe('_repro_test.py');
  });

  it('detects Go from go.mod', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/app', 'utf-8');
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('go');
    expect(runner.testCommand).toBe('go test ./...');
    expect(runner.reproExtension).toBe('_repro_test.go');
  });

  it('detects Rust Cargo from Cargo.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "app"', 'utf-8');
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('rust-cargo');
    expect(runner.testCommand).toBe('cargo test');
    expect(runner.reproExtension).toBe('_repro.rs');
  });

  it('detects Flutter/Dart from pubspec.yaml', () => {
    fs.writeFileSync(path.join(tmpDir, 'pubspec.yaml'), 'name: flutter_app', 'utf-8');
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('flutter-dart');
    expect(runner.testCommand).toBe('flutter test');
    expect(runner.reproExtension).toBe('_repro_test.dart');
  });

  it('detects Kotlin/Gradle from build.gradle.kts', () => {
    fs.writeFileSync(path.join(tmpDir, 'build.gradle.kts'), 'plugins { kotlin("jvm") }', 'utf-8');
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('kotlin-gradle');
    expect(runner.testCommand).toBe('./gradlew test');
    expect(runner.reproExtension).toBe('ReproTest.kt');
  });

  it('handles malformed package.json gracefully and falls back to generic', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ invalid json ', 'utf-8');
    const runner = detectProjectRunner(tmpDir);
    expect(runner.stack).toBe('generic');
  });

  it('executes shell commands and captures exit codes and output via runShellCommand', () => {
    const passRes = runShellCommand('node -e "console.log(\'hello-ok\'); process.exit(0)"', tmpDir);
    expect(passRes.exitCode).toBe(0);
    expect(passRes.combinedOutput).toContain('hello-ok');

    const failRes = runShellCommand('node -e "console.error(\'boom-err\'); process.exit(2)"', tmpDir);
    expect(failRes.exitCode).toBe(2);
    expect(failRes.combinedOutput).toContain('boom-err');
  });
});
