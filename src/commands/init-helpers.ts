import path from 'node:path';
import type { OpenFixConfig } from '../types.js';
import {
  createDefaultConfig,
  isInitialized,
  loadConfig,
  saveConfig,
} from '../core/config.js';

export { createDefaultConfig, isInitialized, loadConfig, saveConfig };

export function getBugsPathFromConfig(
  config: OpenFixConfig,
  cwd: string = process.cwd()
): string {
  return path.resolve(cwd, config.bugsDir);
}
