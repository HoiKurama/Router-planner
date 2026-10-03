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
export type SkillRatings = Record<CapabilityId, SkillRating | null>
export type ReasoningLevel = 'standard' | 'low' | 'medium' | 'high'
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
}

export interface ModelCapabilities {
  ratings: SkillRatings
  toolCalling: boolean | null
  inputModalities: readonly ('text' | 'image' | 'audio')[]
  contextWindowTokens: number | null
}

export interface ModelVariant {
  id: string
  reasoningLevel: ReasoningLevel
  ratings?: Partial<SkillRatings>
  speed: SkillRating | null
  costEfficiency: SkillRating | null
}

export interface ModelProfile {
  id: string
  name: string
  providerId: string
  status: 'active' | 'disabled'
  provenance: 'illustrative' | 'measured' | 'documented'
  version: string
  capabilities: ModelCapabilities
  variants: readonly ModelVariant[]
}

export interface WorkflowProfile {
  id: WorkflowId
  label: string
  tools: readonly ToolId[]
}

export interface ModelRegistry {
  version: string
  models: readonly ModelProfile[]
  workflows: readonly WorkflowProfile[]
}

export interface RoutingPreferences {
  mode: PriorityMode
  allowedProviderIds?: readonly string[]
  excludedModelIds?: readonly string[]
}

export interface RoutingContext {
  unavailableModelIds?: readonly string[]
}

export interface WorkflowPlan {
  profile: WorkflowProfile
  tools: ToolId[]
  steps: string[]
}

export interface ScoreContribution {
  id: CapabilityId | 'speed' | 'costEfficiency'
  label: string
  weight: number
  rating: SkillRating | null
  lowerPoints: number
  upperPoints: number
}

export interface RoutingScore {
  candidateId: string
  model: ModelProfile
  variant: ModelVariant
  workflow: WorkflowPlan
  eligibility: 'eligible' | 'conditional' | 'excluded'
  exclusions: string[]
  lower: number
  upper: number
  qualityLower: number
  speedLower: number
  costLower: number
  contributions: ScoreContribution[]
}

export interface RoutingDecision {
  sourceRevision: number
  status: 'recommended' | 'provisional' | 'abstained'
  fallback: boolean
  selected: RoutingScore | null
  alternatives: RoutingScore[]
  considered: RoutingScore[]
  reasons: string[]
  caveats: string[]
  registryVersion: string
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
