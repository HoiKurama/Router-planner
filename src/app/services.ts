import { analyzePrompt, deriveRequirements } from '../analyzer/analyze'
import { validateAnalyzerConfig } from '../analyzer/config'
import { DEFAULT_ANALYZER_CONFIG } from '../data/analysisRules'
import { optimizePrompt } from '../optimizer/optimize'
import { buildVariants } from '../optimizer/variants'
import { routeTask } from '../router/route'
import { CATALOG, CATALOG_ERRORS } from '../models/catalog'
import { POLICY_VERSION } from '../data/policy'
import type { OptimizedPrompt, PromptInput, RoutingDecision, RoutingPreferences, TaskAnalysis, TaskRequirements } from '../domain/types'

export interface AnalyzerPort {
  analyze(input: PromptInput, signal?: AbortSignal): Promise<TaskAnalysis>
}
export interface OptimizerPort {
  optimize(input: PromptInput, analysis: TaskAnalysis, signal?: AbortSignal): Promise<OptimizedPrompt>
}

const configErrors = validateAnalyzerConfig(DEFAULT_ANALYZER_CONFIG)

/** Analysis without the optimizer, e.g. for a manually edited prompt. Throws on invalid input or rules. */
export function analyzeOnly(input: PromptInput) {
  if (configErrors.length) throw new Error(`Die Analyseregeln sind ungültig: ${configErrors.join(' ')}`)
  const analysis = analyzePrompt(input, DEFAULT_ANALYZER_CONFIG)
  return { analysis, requirements: deriveRequirements(analysis, DEFAULT_ANALYZER_CONFIG) }
}

export const localAnalyzer: AnalyzerPort = {
  async analyze(input, signal) { signal?.throwIfAborted(); return analyzeOnly(input).analysis },
}
export const localOptimizer: OptimizerPort = {
  async optimize(input, analysis, signal) { signal?.throwIfAborted(); return optimizePrompt(input, analysis) },
}

export function recommend(requirements: TaskRequirements, preferences: RoutingPreferences): RoutingDecision {
  if (CATALOG_ERRORS.length) return {
    sourceRevision: requirements.sourceRevision, status: 'abstained', fallback: requirements.fallback, metric: null,
    complexity: requirements.complexity, fraction: null, best: null, threshold: null, selected: null, alternatives: [],
    considered: [], workflow: null, explanation: 'models.json ist ungültig, deshalb gibt es keine Empfehlung.', details: [],
    caveats: CATALOG_ERRORS, catalogVersion: String(CATALOG.version), policyVersion: POLICY_VERSION,
  }
  return routeTask(requirements, preferences, CATALOG)
}

export async function processPrompt(input: PromptInput, signal?: AbortSignal) {
  const analysis = await localAnalyzer.analyze(input, signal)
  const requirements = deriveRequirements(analysis, DEFAULT_ANALYZER_CONFIG)
  const optimized = await localOptimizer.optimize(input, analysis, signal)
  return { analysis, requirements, optimized, variants: buildVariants(input, analysis, optimized) }
}
