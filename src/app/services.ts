import { analyzePrompt, deriveRequirements } from '../analyzer/analyze'
import { validateAnalyzerConfig } from '../analyzer/config'
import { DEFAULT_ANALYZER_CONFIG } from '../data/analysisRules'
import { optimizePrompt } from '../optimizer/optimize'
import { routeTask } from '../router/route'
import { DEMO_REGISTRY } from '../models/catalog'
import { validateRegistry } from '../models/registry'
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

const registryErrors = validateRegistry(DEMO_REGISTRY)
export function recommend(requirements: TaskRequirements, preferences: RoutingPreferences): RoutingDecision {
  if (registryErrors.length) return {
    sourceRevision: requirements.sourceRevision, status: 'abstained', fallback: requirements.fallback, selected: null,
    alternatives: [], considered: [], reasons: ['Der Modellkatalog ist ungültig.'],
    caveats: registryErrors, registryVersion: DEMO_REGISTRY.version, policyVersion: 'invalid-registry',
  }
  return routeTask(requirements, preferences, DEMO_REGISTRY)
}

export async function processPrompt(input: PromptInput, signal?: AbortSignal) {
  const analysis = await localAnalyzer.analyze(input, signal)
  const requirements = deriveRequirements(analysis, DEFAULT_ANALYZER_CONFIG)
  const optimized = await localOptimizer.optimize(input, analysis, signal)
  return { analysis, requirements, optimized }
}
