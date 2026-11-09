import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export interface DetectedRunner {
  stack: string;
  testCommand: string;
  regressionDir: string;
  reproExtension: string;
}

/**
 * Automatically detects the repository's tech stack and test runner
 * by inspecting project manifest files.
 */
export function detectProjectRunner(cwd: string): DetectedRunner {
  const pkgJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['vitest']) {
        return {
          stack: 'node-vitest',
          testCommand: 'npx vitest run',
          regressionDir: 'tests/regressions',
          reproExtension: '.repro.test.ts',
        };
      }
      if (deps['jest']) {
        return {
          stack: 'node-jest',
          testCommand: 'npx jest',
          regressionDir: '__tests__/regressions',
          reproExtension: '.repro.test.ts',
        };
      }
      if (deps['@playwright/test']) {
        return {
          stack: 'node-playwright',
          testCommand: 'npx playwright test',
          regressionDir: 'e2e/regressions',
          reproExtension: '.repro.spec.ts',
        };
      }
      return {
        stack: 'node',
        testCommand: pkg.scripts?.test ? 'npm test' : 'node --test',
        regressionDir: 'tests/regressions',
        reproExtension: '.repro.mjs',
      };
    } catch {
      // Fallback if package.json is malformed
    }
  }

  if (
    fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
    fs.existsSync(path.join(cwd, 'pytest.ini')) ||
    fs.existsSync(path.join(cwd, 'requirements.txt'))
  ) {
    return {
      stack: 'python-pytest',
      testCommand: 'pytest',
      regressionDir: 'tests/regressions',
      reproExtension: '_repro_test.py',
    };
  }

  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    return {
      stack: 'go',
      testCommand: 'go test ./...',
      regressionDir: 'regressions',
      reproExtension: '_repro_test.go',
    };
  }

  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    return {
      stack: 'rust-cargo',
      testCommand: 'cargo test',
      regressionDir: 'tests',
      reproExtension: '_repro.rs',
    };
  }

  if (fs.existsSync(path.join(cwd, 'pubspec.yaml'))) {
    return {
      stack: 'flutter-dart',
      testCommand: 'flutter test',
      regressionDir: 'test/regressions',
      reproExtension: '_repro_test.dart',
    };
  }

  if (
    fs.existsSync(path.join(cwd, 'build.gradle.kts')) ||
    fs.existsSync(path.join(cwd, 'build.gradle'))
  ) {
    return {
      stack: 'kotlin-gradle',
      testCommand: './gradlew test',
      regressionDir: 'src/test/kotlin/regressions',
      reproExtension: 'ReproTest.kt',
    };
  }

  return {
    stack: 'generic',
    testCommand: 'node',
    regressionDir: 'tests/regressions',
    reproExtension: '.repro.mjs',
  };
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  combinedOutput: string;
}

/**
 * Executes a shell command synchronously and captures exit status and output.
 */
export function runShellCommand(command: string, cwd: string): CommandResult {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const combinedOutput = `${stdout}\n${stderr}`.trim();
  const exitCode = result.status ?? 1;

  return {
    exitCode,
    stdout,
    stderr,
    combinedOutput,
  };
}
