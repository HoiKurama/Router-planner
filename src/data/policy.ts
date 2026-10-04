import type { CapabilityId, Category, MetricId, PriorityMode, ProviderId, ToolId, WorkflowProfile } from '../domain/types'

export const ANALYSIS_VERSION = 'rules-v2'
export const POLICY_VERSION = 'routing-v3'
export const MAX_PROMPT_CODEPOINTS = 20_000
/** Below this rule confidence (0–1) a recommendation is only provisional. */
export const MIN_CLEAR_CONFIDENCE = 0.5

/** Which Artificial Analysis metric decides "good enough" for a category. Everything else uses the Intelligence Index. */
export const METRIC_BY_CATEGORY: Partial<Record<Category, MetricId>> = {
  coding: 'coding',
  math: 'math',
}

/**
 * Required share of the best available score, by complexity 1–5. These are policy choices, not measurements:
 * a trivial task (1) accepts almost any model, a very hard one (5) needs nearly the top score.
 */
export const QUALITY_FRACTIONS: Record<Category | 'general', readonly [number, number, number, number, number]> = {
  coding: [0.15, 0.45, 0.65, 0.82, 0.93],
  math: [0.15, 0.55, 0.75, 0.88, 0.95],
  reasoning: [0.15, 0.5, 0.7, 0.85, 0.95],
  writing: [0.15, 0.45, 0.6, 0.75, 0.88],
  research: [0.15, 0.5, 0.7, 0.85, 0.93],
  learning: [0.15, 0.45, 0.6, 0.75, 0.88],
  dataAnalysis: [0.15, 0.5, 0.7, 0.85, 0.93],
  planning: [0.15, 0.45, 0.65, 0.8, 0.9],
  general: [0.15, 0.45, 0.6, 0.75, 0.88],
}

/** Complexity assumed when the analysis cannot tell. */
export const DEFAULT_COMPLEXITY = 2
/** Multiplies the required share. "best" ignores usage and asks for the top score. */
export const MODE_FACTOR: Record<PriorityMode, number> = { fast: 0.85, balanced: 1, best: 1 }
/** With a very long prompt only settings close to the best long-context score (AA-LCR) stay eligible. */
export const LONG_CONTEXT_SHARE = 0.9

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
  fast: 'Sparsam', balanced: 'Ausgewogen', best: 'Beste Qualität',
}

export const PROVIDER_LABELS: Record<ProviderId, string> = { anthropic: 'Claude', openai: 'ChatGPT' }

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
