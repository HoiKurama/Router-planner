import { describe, expect, it } from 'vitest'
import { analyzePrompt, deriveRequirements } from '../analyzer/analyze'
import { CATALOG } from '../models/catalog'
import { validateCatalog } from '../models/validate'
import type { Category, ModelCatalog, PriorityMode, RoutingPreferences, TaskRequirements } from '../domain/types'
import { routeTask } from './route'

const fromText = (text: string) => deriveRequirements(analyzePrompt({ text, revision: 1 }))
const route = (requirements: TaskRequirements, preferences: Partial<RoutingPreferences> = {}, catalog: ModelCatalog = CATALOG) =>
  routeTask(requirements, { mode: 'balanced', ...preferences }, catalog)

/** A clean, clearly recognized task without tools, so only category, complexity and mode matter. */
function task(category: Category | null, complexity: 1 | 2 | 3 | 4 | 5 | null, extra: Partial<TaskRequirements> = {}): TaskRequirements {
  return {
    sourceRevision: 1, category, complexity, capabilityNeeds: [], requiredTools: [], forbiddenTools: [], contextDemand: 'low',
    minContextTokens: null, validationSteps: [], issues: [], analysisConfidence: 'clear', confidenceScore: 0.9,
    fallback: category === null, language: 'de', ...extra,
  }
}
const sentences = (text: string) => text.match(/[.!?](?=\s|$)/g)?.length ?? 0
const categories: Category[] = ['coding', 'math', 'research', 'writing', 'learning', 'dataAnalysis', 'reasoning', 'planning']
const modes: PriorityMode[] = ['fast', 'balanced', 'best']
const levels = [1, 2, 3, 4, 5] as const

describe('recommendation: cheapest setting that is good enough', () => {
  it('sends simple arithmetic to the lightest Claude model instead of a heavy one', () => {
    const decision = route(fromText('Berechne 17 * 24.'))
    expect(decision.selected?.id).toBe('claude-haiku-4-5/extended')
    expect(decision.selected?.family.weight).toBe(1)
    expect(decision.explanation).toMatch(/^Claude Haiku 4\.5 · Extended an reicht für Mathematik mit Komplexität 1\/5/)
    // The Extended-to-effort mapping is an assumption, so the pick must not look certain.
    expect(decision.status).toBe('provisional')
  })

  it('escalates to stronger settings as complexity rises', () => {
    const scores = levels.map((level) => route(task('coding', level)))
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i].threshold!).toBeGreaterThan(scores[i - 1].threshold!)
      expect(scores[i].selected!.score!).toBeGreaterThanOrEqual(scores[i - 1].selected!.score!)
    }
    expect(route(fromText('Migriere die gesamte Codebase eines TypeScript-Projekts auf eine neue Datenzugriffsschicht.')).selected?.id).toBe('claude-sonnet-5-5/max')
  })

  it('always picks a setting at or above the threshold, never a heavier one in the same pool than needed', () => {
    for (const category of categories) for (const level of levels) for (const mode of modes) {
      const decision = route(task(category, level), { mode })
      const selected = decision.selected!
      expect(selected.score!, `${category}/${level}/${mode}`).toBeGreaterThanOrEqual(decision.threshold! - 1e-9)
      const lighterGood = decision.considered.filter((option) => option.pool.id === selected.pool.id && option !== selected && option.status !== 'excluded'
        && option.score! >= decision.threshold! - 1e-9 && option.setting.availability === 'yes'
        && option.family.weight <= selected.family.weight && option.setting.effortRank <= selected.setting.effortRank)
      expect(lighterGood.map((option) => option.id), `${category}/${level}/${mode}`).toEqual([])
    }
  })

  it('in "Beste Qualität" picks the highest available score regardless of usage', () => {
    for (const category of categories) {
      const decision = route(task(category, 2), { mode: 'best' })
      const available = decision.considered.filter((option) => option.status !== 'excluded' && option.setting.availability === 'yes')
      expect(decision.selected!.score).toBe(Math.max(...available.map((option) => option.score!)))
    }
  })

  it('"Sparsam" never demands more than "Ausgewogen"', () => {
    for (const category of categories) for (const level of levels) {
      const fast = route(task(category, level), { mode: 'fast' })
      const balanced = route(task(category, level), { mode: 'balanced' })
      expect(fast.threshold!).toBeLessThan(balanced.threshold!)
      expect(balanced.selected!.score!).toBeGreaterThanOrEqual(fast.threshold!)
    }
  })

  it('keeps the lower effort inside a pool when it is already good enough', () => {
    const decision = route(task('writing', 2))
    expect(decision.selected?.id).toBe('claude-sonnet-5-5/low')
    const medium = decision.considered.find((option) => option.id === 'claude-sonnet-5-5/medium')!
    expect(medium.status).toBe('dominated')
    expect(medium.notes.join(' ')).toMatch(/Claude Sonnet 5\.5 · Effort Low braucht weniger Kontingent/)
  })
})

describe('subscriptions and preferences', () => {
  it('measures the threshold against the enabled pools only when Claude is switched off', () => {
    const decision = route(task('reasoning', 3), { enabledPools: ['chatgpt-plus-chat', 'chatgpt-plus-work'] })
    expect(decision.selected?.pool.provider).toBe('openai')
    const openai = decision.considered.filter((option) => option.pool.provider === 'openai' && option.status !== 'excluded' && option.setting.availability === 'yes')
    expect(decision.best).toBe(Math.max(...openai.map((option) => option.score!)))
    expect(decision.considered.filter((option) => option.pool.provider === 'anthropic').every((option) => option.status === 'excluded')).toBe(true)
  })

  it('abstains when no subscription is enabled', () => {
    const decision = route(task('writing', 2), { enabledPools: [] })
    expect(decision.status).toBe('abstained')
    expect(decision.selected).toBeNull()
    expect(decision.explanation).toMatch(/Kein Abo ausgewählt/)
  })

  it('uses the preferred provider when both are good enough', () => {
    const decision = route(fromText('Berechne 17 * 24.'), { preferredProvider: 'openai' })
    expect(decision.selected?.id).toBe('gpt-5-6-sol-chat/instant')
    // Chat usage is undocumented: the recommendation must say so instead of looking certain.
    expect(decision.status).toBe('provisional')
    expect(decision.caveats.join(' ')).toMatch(/Verbrauch unklar/)
  })

  it('prefers the agent workspace when the task edits files or runs code', () => {
    const decision = route(task('coding', 3, { requiredTools: ['fileRead', 'fileWrite', 'codeExecution'] }))
    expect(decision.selected?.pool.kind).toBe('workspace')
    expect(route(task('coding', 3)).selected?.pool.kind).toBe('chat')
  })

  it('marks a pick from a model that is still rolling out as provisional', () => {
    const decision = route(task('coding', 3, { requiredTools: ['fileRead', 'fileWrite', 'codeExecution'] }))
    expect(decision.selected?.family.id).toBe('gpt-6-1-sol')
    expect(decision.status).toBe('provisional')
    expect(decision.caveats).toContain(decision.selected!.family.planNote)
  })
})

describe('honesty about missing data', () => {
  it('never selects a model that is not in the plan', () => {
    for (const category of categories) for (const level of levels) for (const mode of modes) {
      expect(route(task(category, level), { mode }).selected?.family.inPlan, `${category}/${level}/${mode}`).toBe(true)
    }
    const fable = route(task('math', 5), { mode: 'best' }).considered.find((option) => option.family.id === 'claude-fable-5-1')!
    expect(fable.status).toBe('excluded')
    expect(fable.notes[0]).toMatch(/Nicht im Pro-Kontingent/)
  })

  it('never selects a setting without a benchmark value for the deciding metric', () => {
    for (const level of levels) for (const mode of modes) {
      const decision = route(task('coding', level), { mode })
      expect(decision.selected?.score).not.toBeNull()
      const instant = decision.considered.find((option) => option.id === 'gpt-5-6-sol-chat/instant')!
      expect(instant.status).toBe('excluded')
      expect(instant.notes.join(' ')).toMatch(/kein Wert bei Artificial Analysis/)
    }
  })

  it('does not pick a setting of unclear availability while a known one is good enough', () => {
    const catalog = structuredClone(CATALOG)
    catalog.models.find((family) => family.id === 'claude-haiku-4-5')!.settings.find((setting) => setting.id === 'extended')!.availability = 'unclear'
    const decision = route(fromText('Berechne 17 * 24.'), {}, catalog)
    expect(decision.selected?.setting.availability).toBe('yes')
    expect(decision.considered.find((option) => option.id === 'claude-haiku-4-5/extended')?.status).toBe('candidate')
  })

  it('abstains on empty or contradictory tasks and marks the fallback as provisional', () => {
    for (const text of ['???', 'Recherchiere aktuelle Informationen ohne Websuche.']) {
      const decision = route(fromText(text))
      expect(decision.status, text).toBe('abstained')
      expect(decision.selected, text).toBeNull()
    }
    const fallback = route(fromText('What is the capital of France?'))
    expect(fallback.fallback).toBe(true)
    expect(fallback.status).toBe('provisional')
    expect(fallback.metric).toBe('intelligence')
    expect(fallback.caveats.join(' ')).toMatch(/Komplexität wurde nicht erkannt/)
  })

  it('keeps only strong long-context settings for very long prompts', () => {
    const decision = route(task('writing', 2, { contextDemand: 'high' }))
    const best = Math.max(...decision.considered.filter((option) => option.setting.aa.longContext !== null && option.family.inPlan).map((option) => option.setting.aa.longContext!))
    expect(decision.selected!.setting.aa.longContext!).toBeGreaterThanOrEqual(best * 0.9)
    expect(decision.considered.find((option) => option.id === 'claude-sonnet-5-5/low')?.status).toBe('excluded')
  })
})

describe('explanations and stability', () => {
  it('explains every pick in at most two sentences that name the model', () => {
    for (const category of categories) for (const level of levels) for (const mode of modes) {
      const decision = route(task(category, level), { mode })
      expect(sentences(decision.explanation), decision.explanation).toBeLessThanOrEqual(2)
      expect(decision.explanation).toContain(decision.selected!.family.name)
    }
  })

  it('names the documented saving inside the pool', () => {
    expect(route(task('writing', 2)).explanation).toMatch(/weil Anthropic das leichtere Modell und die niedrigere Stufe als sparsamer einstuft\.$/)
    const work = route(task('dataAnalysis', 2, { requiredTools: ['fileRead', 'codeExecution'] }))
    expect(work.selected?.family.id).toBe('gpt-6-luna')
    expect(work.explanation).toMatch(/OpenAI schätzt für GPT-6 Luna 350–3\.000 Nachrichten pro 5 Stunden, für GPT-6 Astra 5–45/)
  })

  it('does not depend on the order of models and settings in models.json', () => {
    const shuffled = structuredClone(CATALOG)
    shuffled.models.reverse()
    for (const family of shuffled.models) family.settings.reverse()
    shuffled.pools.reverse()
    for (const category of categories) for (const level of levels) for (const mode of modes) {
      expect(route(task(category, level), { mode }, shuffled).selected?.id).toBe(route(task(category, level), { mode }).selected?.id)
    }
  })
})

describe('models.json validation', () => {
  it('accepts the shipped catalog', () => expect(validateCatalog(CATALOG)).toEqual([]))

  it('rejects broken entries with readable messages', () => {
    const broken = structuredClone(CATALOG) as unknown as Record<string, unknown> & ModelCatalog
    broken.pools.push({ ...broken.pools[0] })
    broken.models[0].pool = 'unknown-pool'
    broken.models[1].settings[0].aa.coding = 1.5
    broken.models[2].settings[0].availability = 'maybe' as never
    broken.models[3].usage.source = 'missing-source'
    broken.sources['aa-models'].url = 'http://insecure.example'
    const errors = validateCatalog(broken).join('\n')
    expect(errors).toMatch(/Kontingent "claude-pro" ist doppelt/)
    expect(errors).toMatch(/unbekanntes Kontingent "unknown-pool"/)
    expect(errors).toMatch(/aa\.coding muss 0–1 oder null sein/)
    expect(errors).toMatch(/availability muss yes oder unclear sein/)
    expect(errors).toMatch(/usage braucht text, estimate .* bekannte Quelle/)
    expect(errors).toMatch(/Quelle "aa-models"/)
    expect(validateCatalog({ models: [] })).toHaveLength(1)
  })
})
