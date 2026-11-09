export type BugStatus =
  | 'INTAKE'               // 0-intake.md created from Jira/screenshot
  | 'TRIAGED'              // 1-triage.md completed, internal bug confirmed
  | 'NEED_CLARIFICATION'   // Blocked: Jira ticket or Impact Grill lacks info; waiting on user/analyst
  | 'HALTED_EXTERNAL'      // Not a code bug: External server / 3rd-party API outage or issue
  | 'HALTED_DUPLICATE'     // Already known / in-progress fix in another ticket
  | 'HALTED_INVALID'       // Working as intended / config or user error
  | 'REPRODUCED'           // 2-repro/ executed and deterministically FAILED (Red state achieved)
  | 'ANALYZED'             // 3-rca.md completed with root cause & sizing (small vs big)
  | 'IMPACT_REVIEWED'      // 3b-impact.md completed: full flow, DB tx, blast radius & Effective Fix approved
  | 'ESCALATED_OPENSPEC'   // Fix is architectural/big -> handed off to OpenSpec
  | 'VERIFIED'             // Fix applied, repro test turned PASS (Green), regressions pass, 5-fix-proof.md generated
  | 'CLOSED';              // Repro promoted to permanent suite & analyst report exported

export type TriageClassification =
  | 'internal-code-bug'
  | 'external-server-issue'
  | 'already-in-progress'
  | 'environment-or-data'
  | 'working-as-intended'
  | 'need-more-info';

export type ReproMode =
  | 'unit-fixture'         // Mode 1: Extracted data fixture passed into unit/service function
  | 'api-probe'            // Mode 2: HTTP/API contract probe (checks backend + external servers)
  | 'ui-e2e'               // Mode 3: Playwright/Cypress/Widget test mimicking screenshot steps
  | 'log-replay';          // Mode 4: Captured payload/state snapshot replay

export type FixSize = 'small' | 'medium' | 'big-architectural';

export type FixScope =
  | 'isolated-page-or-endpoint' // Scoped strictly to the target UI page or specific API endpoint
  | 'shared-service-module'     // Modifies a shared service/helper used by multiple callers
  | 'cross-system';             // Impacts multiple services, contracts, or architecture

export type DbImpact =
  | 'none'                      // No database interaction in the affected flow
  | 'read-only-query'           // Only SELECT/read queries involved
  | 'transactional-write'       // Inside a DB transaction (INSERT/UPDATE/DELETE, locks, rollback)
  | 'schema-or-migration';      // Requires table/column/index migration

export type ExportFormat = 'markdown' | 'confluence' | 'jira' | 'json';

export interface ReproRecord {
  timestamp: string;
  mode: ReproMode;
  command: string;
  exitCode: number;
  passed: boolean;
  outputSnippet: string;
}

export interface BugMetadata {
  id: string;
  title: string;
  jiraUrl?: string;
  screenshots: string[];
  proofScreenshots?: string[];
  fixSummary?: string;
  modifiedFiles?: string[];
  status: BugStatus;
  classification?: TriageClassification;
  reproMode: ReproMode;
  fixSize?: FixSize;
  fixScope?: FixScope;
  dbImpact?: DbImpact;
  impactReviewed?: boolean;
  clarificationsResolved?: boolean;
  linkedTicket?: string;
  createdAt: string;
  updatedAt: string;
  reproHistory: ReproRecord[];
  verificationPassed: boolean;
  promotedTo?: string;
  escalatedTo?: string;
}

export interface OpenFixConfig {
  version: string;
  bugsDir: string;
  detectedStack: string;
  testCommand: string;
  reproRunnerCommand?: string;
  regressionTestDir: string;
  openspecDir: string;
}
