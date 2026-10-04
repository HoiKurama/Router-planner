export const CAPABILITY_IDS = [
  'coding', 'math', 'reasoning', 'research', 'writing',
  'teaching', 'dataAnalysis', 'planning', 'toolUse',
] as const

export type CapabilityId = (typeof CAPABILITY_IDS)[number]
export type Category = 'coding' | 'math' | 'research' | 'writing' | 'learning' | 'dataAnalysis' | 'reasoning' | 'planning'
export type PriorityMode = 'fast' | 'balanced' | 'best'
export type Language = 'de' | 'en' | 'mixed' | 'unknown'
export type Demand = 'low' | 'medium' | 'high' | 'unknown'
export type TriState = 'yes' | 'no' | 'unknown'
export type SkillRating = 0 | 1 | 2 | 3 | 4
export type ToolId = 'webSearch' | 'webRead' | 'fileRead' | 'fileWrite' | 'codeExecution'
export type WorkflowId = 'chat' | 'research' | 'workspace' | 'workspaceResearch'

export interface Evidence {
  ruleId: string
  start: number
  end: number
}

/** A rule that fired, with the matched excerpt, so the UI can show why a category was chosen. */
export interface Signal {
  ruleId: string
  label: string
  category: Category
  strength: 1 | 2 | 3
  excerpt: string
}

export interface Finding<T> {
  value: T | null
  source: 'explicit' | 'inferred' | 'unknown'
  evidence: Evidence[]
}

export interface PromptInput {
  text: string
  revision: number
}

export interface AnalysisIssue {
  id: string
  message: string
  critical: boolean
}

export interface TaskAnalysis {
  sourceRevision: number
  analysisVersion: string
  language: Language
  goal: Finding<string>
  primaryCategory: Category | null
  categories: Category[]
  categoryScores: Partial<Record<Category, number>>
  constraints: Finding<string>[]
  steps: Finding<string>[]
  complexity: Finding<1 | 2 | 3 | 4 | 5>
  reasoningDemand: Demand
  contextDemand: Demand
  toolDemand: Demand
  speedNeed: Demand
  accuracyNeed: Demand
  multiStep: TriState
  codingTask: TriState
  researchNeeded: TriState
  fileAccessNeeded: TriState
  needsWorkspace: boolean
  needsCurrentInformation: boolean
  forbidsWeb: boolean
  issues: AnalysisIssue[]
  evidence: Evidence[]
  signals: Signal[]
  confidence: 'clear' | 'ambiguous' | 'unknown'
  /** 0–1 from signal strength and the gap to the next category; 0 when nothing was recognized. */
  confidenceScore: number
  /** No category recognized, but the text has content: route to the general fallback profile. */
  fallback: boolean
}

export interface CapabilityNeed {
  id: CapabilityId
  importance: 1 | 2 | 3
  minimum: SkillRating | null
  source: 'explicit' | 'inferred'
}

export interface TaskRequirements {
  sourceRevision: number
  category: Category | null
  capabilityNeeds: CapabilityNeed[]
  requiredTools: ToolId[]
  forbiddenTools: ToolId[]
  contextDemand: Demand
  minContextTokens: number | null
  validationSteps: string[]
  issues: AnalysisIssue[]
  analysisConfidence: TaskAnalysis['confidence']
  confidenceScore: number
  fallback: boolean
  language: Language
  complexity: 1 | 2 | 3 | 4 | 5 | null
}

export type ProviderId = 'anthropic' | 'openai'
export type MetricId = 'intelligence' | 'coding' | 'math' | 'longContext'
/** How precisely the provider documents what a setting costs in the plan's usage limit. */
export type UsageDocumentation = 'ordinal' | 'estimates' | 'none'
export type Availability = 'yes' | 'unclear'
/** chat = conversational app, workspace = agent environment with files and code execution. */
export type PoolKind = 'chat' | 'workspace'

export interface CatalogSource {
  title: string
  url: string
  retrieved: string
}

export interface MetricInfo {
  label: string
  description: string
  aaField: string
  source: string
}

/** One usage allowance, e.g. Claude Pro or ChatGPT Plus Work/Codex. Allowances are not comparable with each other. */
export interface UsagePool {
  id: string
  plan: string
  provider: ProviderId
  kind: PoolKind
  label: string
  appUrl: string
  usageDocumentation: UsageDocumentation
  usageSummary: string
  source: string
}

/** Artificial Analysis values for one model setting; null where AA lists nothing. */
export interface BenchmarkValues {
  slug: string
  intelligence: number | null
  coding: number | null
  math: number | null
  longContext: number | null
  priceInput: number | null
  priceOutput: number | null
  speed: number | null
  estimated?: boolean
}

export interface ModelSetting {
  id: string
  label: string
  /** 0 = no reasoning, 1 = lowest effort … 5 = max. Only compared inside one usage pool. */
  effortRank: number
  availability: Availability
  note?: string
  /** Set when the link between the app setting and the AA variant is an assumption. */
  mapping?: string
  aa: BenchmarkValues
}

export interface ModelFamily {
  id: string
  name: string
  pool: string
  inPlan: boolean
  /** Documented usage order inside the pool: 1 = lightest. */
  weight: number
  planNote?: string
  usage: { text: string; estimate: string | null; source: string }
  contextWindowTokens: number | null
  contextSource?: string
  howTo: string
  settings: ModelSetting[]
}

export interface ModelCatalog {
  version: string
  retrieved: string
  notes: string[]
  sources: Record<string, CatalogSource>
  metrics: Record<MetricId, MetricInfo>
  pools: UsagePool[]
  models: ModelFamily[]
}

export interface WorkflowProfile {
  id: WorkflowId
  label: string
  tools: readonly ToolId[]
}

export interface WorkflowPlan {
  profile: WorkflowProfile
  tools: ToolId[]
  steps: string[]
}

export interface RoutingPreferences {
  mode: PriorityMode
  /** Pools the user has; undefined means all pools in the catalog. */
  enabledPools?: readonly string[]
  preferredProvider?: ProviderId | null
}

export type OptionStatus = 'selected' | 'candidate' | 'dominated' | 'below' | 'excluded'

/** One model setting as seen by the router. */
export interface RouteOption {
  id: string
  family: ModelFamily
  setting: ModelSetting
  pool: UsagePool
  score: number | null
  /** score divided by the best available score, 0–1+. */
  share: number | null
  status: OptionStatus
  notes: string[]
}

export interface RoutingDecision {
  sourceRevision: number
  status: 'recommended' | 'provisional' | 'abstained'
  fallback: boolean
  metric: MetricId | null
  complexity: 1 | 2 | 3 | 4 | 5 | null
  /** Required share of the best score, 0–1. */
  fraction: number | null
  best: number | null
  threshold: number | null
  selected: RouteOption | null
  alternatives: RouteOption[]
  considered: RouteOption[]
  workflow: WorkflowPlan | null
  /** At most two sentences: why this option and what it saves. */
  explanation: string
  details: string[]
  caveats: string[]
  catalogVersion: string
  policyVersion: string
}

export interface SourcePart {
  start: number
  end: number
}

export interface OptimizedPrompt {
  sourceRevision: number
  sourceParts: SourcePart[]
  insertions: { offset: number; text: string; reason: string }[]
  rendered: string
  suggestions: string[]
  preservationPassed: boolean
  changed: boolean
}
