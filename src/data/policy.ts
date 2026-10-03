import type { CapabilityId, Category, PriorityMode, ToolId, WorkflowProfile } from '../domain/types'

export const ANALYSIS_VERSION = 'rules-v2'
export const POLICY_VERSION = 'routing-v2'
export const MAX_PROMPT_CODEPOINTS = 20_000
export const NEAR_TIE_POINTS = 5
/** Below this rule confidence (0–1) a recommendation is only provisional. */
export const MIN_CLEAR_CONFIDENCE = 0.5

/** Weights are policy choices, not measured probabilities. */
export const MODE_WEIGHTS: Record<PriorityMode, { quality: number; speed: number; cost: number }> = {
  fast: { quality: 0.4, speed: 0.4, cost: 0.2 },
  balanced: { quality: 0.6, speed: 0.2, cost: 0.2 },
  best: { quality: 1, speed: 0, cost: 0 },
}

/** Importance 1 = supporting, 2 = important, 3 = central. */
export const CATEGORY_WEIGHTS: Record<Category, Partial<Record<CapabilityId, 1 | 2 | 3>>> = {
  coding: { coding: 3, reasoning: 1 },
  math: { math: 3, reasoning: 2 },
  research: { research: 3, reasoning: 1, writing: 1 },
  writing: { writing: 3 },
  learning: { teaching: 3, reasoning: 1 },
  dataAnalysis: { dataAnalysis: 3, reasoning: 2 },
  reasoning: { reasoning: 3 },
  // Writing keeps plans readable; without it a coding profile with strong planning wins trip plans.
  planning: { planning: 3, reasoning: 1, writing: 1 },
}

/** Minimum competence for the main task at complexity levels 1–5. */
export const COMPLEXITY_MINIMUM = [1, 2, 2, 3, 4] as const

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  coding: 'Coding', math: 'Mathematik', reasoning: 'Reasoning',
  research: 'Recherche', writing: 'Schreiben', teaching: 'Lernen',
  dataAnalysis: 'Datenanalyse', planning: 'Planung', toolUse: 'Tool-Nutzung',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  coding: 'Coding', math: 'Mathematik', research: 'Recherche',
  writing: 'Schreiben', learning: 'Lernen', dataAnalysis: 'Datenanalyse',
  reasoning: 'Allgemeines Reasoning', planning: 'Planung',
}

export const MODE_LABELS: Record<PriorityMode, string> = {
  fast: 'Fast', balanced: 'Balanced', best: 'Best',
}

export const WORKFLOWS: readonly WorkflowProfile[] = [
  { id: 'chat', label: 'Chat', tools: [] },
  { id: 'research', label: 'Recherche', tools: ['webSearch', 'webRead'] },
  { id: 'workspace', label: 'Arbeitsumgebung', tools: ['fileRead', 'fileWrite', 'codeExecution'] },
  { id: 'workspaceResearch', label: 'Arbeitsumgebung + Recherche', tools: ['fileRead', 'fileWrite', 'codeExecution', 'webSearch', 'webRead'] },
]

export const TOOL_LABELS: Record<ToolId, string> = {
  webSearch: 'Websuche', webRead: 'Webzugriff', fileRead: 'Dateilesen',
  fileWrite: 'Dateibearbeitung', codeExecution: 'Codeausführung',
}
