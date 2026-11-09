import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import {
  createDefaultConfig,
  getBugsPathFromConfig,
  isInitialized,
  loadConfig,
  saveConfig,
} from './init-helpers.js';

export interface InitOptions {
  cwd?: string;
  force?: boolean;
  agents?: boolean;
}

export function runInit(options: InitOptions = {}): {
  configPath: string;
  detectedStack: string;
  createdAgentRules: string[];
} {
  const cwd = options.cwd ?? process.cwd();

  if (isInitialized(cwd) && !options.force) {
    const existing = loadConfig(cwd);
    return {
      configPath: path.join(cwd, '.openfix', 'config.json'),
      detectedStack: existing.detectedStack,
      createdAgentRules: [],
    };
  }

  const config = createDefaultConfig(cwd);
  saveConfig(config, cwd);

  const bugsDir = getBugsPathFromConfig(config, cwd);
  fs.mkdirSync(bugsDir, { recursive: true });

  const createdAgentRules: string[] = [];
  if (options.agents !== false) {
    const agentRulesPath = path.join(cwd, '.openfix', 'AGENT_PROTOCOL.md');
    fs.writeFileSync(agentRulesPath, getAgentProtocolContent(), 'utf-8');
    createdAgentRules.push(agentRulesPath);
  }

  return {
    configPath: path.join(cwd, '.openfix', 'config.json'),
    detectedStack: config.detectedStack,
    createdAgentRules,
  };
}

export function printInitResult(result: ReturnType<typeof runInit>): void {
  console.log(pc.green('✔ OpenFix initialized successfully!'));
  console.log(`  Config:         ${pc.cyan(result.configPath)}`);
  console.log(`  Detected Stack: ${pc.yellow(result.detectedStack)}`);
  if (result.createdAgentRules.length > 0) {
    console.log(`  Agent Protocol: ${pc.cyan(result.createdAgentRules.join(', '))}`);
  }
}

function getAgentProtocolContent(): string {
  return `# OpenFix Agent Protocol (Strict TDBF Lifecycle)

When investigating or fixing any bug in this repository, you MUST follow the 5-stage OpenFix workflow:

1. **Stage 0: Intake (\`0-intake.md\`)**
   - Extract all visual clues from the Jira ticket and UI screenshots (page title, URL, error banner text, button clicked, visible data).
2. **Stage 1: Triage & Reverse Trace (\`1-triage.md\`)**
   - Search the codebase for the UI strings extracted in Stage 0.
   - Trace the call chain: \`UI Component -> API Endpoint -> Controller/Service -> Database / External Server\`.
   - Classify the issue via \`openfix triage <id> --classify <type>\`.
   - **STOP IMMEDIATELY** if classified as \`external-server-issue\`, \`already-in-progress\`, or \`need-more-info\`. Do NOT touch source code.
3. **Stage 2: Reproduction Gate (\`2-repro/\`)**
   - **STRICT RULE:** You are FORBIDDEN from modifying application source code until \`openfix repro <id>\` has executed and recorded a deterministic failure (\`FAIL\` / Red state).
4. **Stage 3: Root Cause Analysis & Sizing (\`3-rca.md\`)**
   - Document the exact root cause, the exact trigger condition, and other areas/scenarios that might cause or experience this issue.
   - Size the fix via \`openfix rca <id> --size <small|medium|big-architectural>\`.
   - If \`big-architectural\`, run \`openfix escalate <id>\` to hand off to OpenSpec.
5. **Stage 4: Minimal Fix, Verify & Promote (\`4-tasks.md\`)**
   - Apply the minimal fix.
   - Run \`openfix verify <id>\` to prove \`2-repro/\` turned from Red to Green.
   - Run \`openfix promote <id>\` and \`openfix export <id>\` to generate the Analyst Report.
`;
}
