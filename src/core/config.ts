import fs from 'node:fs';
import path from 'node:path';
import type { OpenFixConfig } from '../types.js';
import { detectProjectRunner } from './runner.js';

export const OPENFIX_DIR = '.openfix';
export const CONFIG_FILENAME = 'config.json';

export function getOpenFixRoot(cwd: string = process.cwd()): string {
  return path.join(cwd, OPENFIX_DIR);
}

export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(getOpenFixRoot(cwd), CONFIG_FILENAME);
}

export function isInitialized(cwd: string = process.cwd()): boolean {
  return fs.existsSync(getConfigPath(cwd));
}

export function createDefaultConfig(cwd: string = process.cwd()): OpenFixConfig {
  const detected = detectProjectRunner(cwd);
  return {
    version: '0.1.0',
    bugsDir: '.openfix/bugs',
    detectedStack: detected.stack,
    testCommand: detected.testCommand,
    regressionTestDir: detected.regressionDir,
    openspecDir: 'openspec/changes',
  };
}

export function loadConfig(cwd: string = process.cwd()): OpenFixConfig {
  const configPath = getConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `OpenFix is not initialized in ${cwd}. Run "openfix init" first.`
    );
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as OpenFixConfig;
}

export function saveConfig(
  config: OpenFixConfig,
  cwd: string = process.cwd()
): void {
  const root = getOpenFixRoot(cwd);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    getConfigPath(cwd),
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );
}
