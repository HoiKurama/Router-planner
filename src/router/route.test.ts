import { describe, expect, it } from 'vitest'
import { analyzePrompt, deriveRequirements } from '../analyzer/analyze'
import { DEMO_REGISTRY } from '../models/catalog'
import { validateRegistry } from '../models/registry'
import type { ModelRegistry, PriorityMode } from '../domain/types'
import { routeTask, scoreCandidate } from './route'

const requirements = (text = '2 + 2') => deriveRequirements(analyzePrompt({ text, revision: 1 }))
const route = (mode: PriorityMode = 'balanced', registry: ModelRegistry = DEMO_REGISTRY) => routeTask(requirements(), { mode }, registry)

describe('routing policy', () => {
  it.each([['fast', 'demo-speed'], ['balanced', 'demo-balanced'], ['best', 'demo-reasoning']] as const)('routes simple math in %s', (mode, id) => expect(route(mode).selected?.model.id).toBe(id))
  it('matches the independent score reference', () => {
    const expected = { fast: [80, 75, 55], balanced: [70, 75, 70], best: [50, 75, 100] }
    for (const mode of ['fast', 'balanced', 'best'] as const) {
      const candidates = route(mode).considered
      const actual = [['demo-speed', 'standard'], ['demo-balanced', 'standard'], ['demo-reasoning', 'high']].map(([model, variant]) => candidates.find((c) => c.model.id === model && c.variant.id === variant)!.lower)
      expect(actual).toEqual(expected[mode])
    }
  })
  it('keeps the decision invariant under catalog order and display names', () => {
    const altered = { ...DEMO_REGISTRY, models: [...DEMO_REGISTRY.models].reverse().map((model) => ({ ...model, name: 'Renamed' })) }
    expect(route('balanced', altered).selected?.candidateId).toBe(route().selected?.candidateId)
  })
  it('does not change existing scores when a model is added', () => {
    const model = { ...DEMO_REGISTRY.models[0], id: 'extra-model' }
    const expanded = { ...DEMO_REGISTRY, models: [...DEMO_REGISTRY.models, model] }
    const original = route().considered
    for (const score of route('balanced', expanded).considered.filter((c) => c.model.id !== model.id)) expect(score.lower).toBe(original.find((c) => c.candidateId === score.candidateId)!.lower)
  })
  it('never lets a mode bypass minimum capability', () => {
    const req = requirements('Migriere die gesamte Codebase mit Tests und API-Kompatibilität.')
    for (const mode of ['fast', 'balanced', 'best'] as const) {
      const result = routeTask(req, { mode }, DEMO_REGISTRY)
      expect(result.selected?.model.id).toBe('demo-coding')
      expect(result.selected?.variant.reasoningLevel).toBe('medium')
    }
  })
  it('uses unknown intervals instead of imputing a middle score', () => {
    const registry = structuredClone(DEMO_REGISTRY)
    registry.models[0].variants[0].speed = null
    const result = route('balanced', { ...registry, models: [registry.models[0]] })
    expect(result.selected?.lower).toBe(50)
    expect(result.selected?.upper).toBe(70)
    expect(result.status).toBe('provisional')
  })
  it('does not recommend unverified minimum capability', () => {
    const registry = structuredClone(DEMO_REGISTRY)
    registry.models[0].capabilities.ratings.math = null
    const result = route('fast', { ...registry, models: [registry.models[0]] })
    expect(result.selected).toBeNull()
    expect(result.status).toBe('abstained')
    expect(result.alternatives[0].eligibility).toBe('conditional')
  })
  it('excludes missing tools, insufficient context and unavailable models', () => {
    const req = { ...requirements(), requiredTools: ['webSearch' as const], minContextTokens: 10_000 }
    const registry = structuredClone(DEMO_REGISTRY)
    for (const model of registry.models) { model.capabilities.toolCalling = false; model.capabilities.contextWindowTokens = 100 }
    expect(routeTask(req, { mode: 'best' }, registry).selected).toBeNull()
    expect(routeTask(requirements(), { mode: 'best' }, DEMO_REGISTRY, { unavailableModelIds: DEMO_REGISTRY.models.map((m) => m.id) }).selected).toBeNull()
  })
  it('respects structured provider restrictions', () => expect(routeTask(requirements(), { mode: 'best', allowedProviderIds: ['unknown-provider'] }, DEMO_REGISTRY).status).toBe('abstained'))
  it('abstains on unknown tasks and contradictory requirements', () => {
    for (const text of ['???', 'Recherchiere aktuelle Informationen ohne Websuche.']) expect(routeTask(requirements(text), { mode: 'best' }, DEMO_REGISTRY).selected).toBeNull()
  })
  it('provides reproducible contributions and monotonic ratings', () => {
    const base = route().selected!
    expect(base.contributions.reduce((sum, c) => sum + c.lowerPoints, 0)).toBeCloseTo(base.lower)
    const variant = { ...base.variant, ratings: { math: 4 as const } }
    const improved = scoreCandidate(requirements(), { mode: 'balanced' }, base.model, variant, base.workflow)
    expect(improved.lower).toBeGreaterThanOrEqual(base.lower)
  })
  it('validates the catalog and rejects duplicate or invalid values', () => {
    expect(validateRegistry(DEMO_REGISTRY)).toEqual([])
    expect(validateRegistry({ ...DEMO_REGISTRY, models: [...DEMO_REGISTRY.models, DEMO_REGISTRY.models[0]] }).length).toBeGreaterThan(0)
    const broken = structuredClone(DEMO_REGISTRY)
    broken.models[0].capabilities.ratings.math = 5 as never
    expect(validateRegistry(broken).some((error) => error.includes('math'))).toBe(true)
  })
})
