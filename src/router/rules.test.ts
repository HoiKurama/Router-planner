import { describe, expect, it } from 'vitest'
import { analyzePrompt, deriveRequirements } from '../analyzer/analyze'
import { validateAnalyzerConfig } from '../analyzer/config'
import { DEFAULT_ANALYZER_CONFIG, type AnalyzerConfig } from '../data/analysisRules'
import { CATALOG } from '../models/catalog'
import type { PriorityMode } from '../domain/types'
import { routeTask } from './route'

const analyze = (text: string, config: AnalyzerConfig = DEFAULT_ANALYZER_CONFIG) => analyzePrompt({ text, revision: 1 }, config)
const route = (text: string, mode: PriorityMode = 'balanced', config: AnalyzerConfig = DEFAULT_ANALYZER_CONFIG) =>
  routeTask(deriveRequirements(analyze(text, config), config), { mode }, CATALOG)

describe('configurable rule set', () => {
  it('accepts the shipped configuration', () => expect(validateAnalyzerConfig(DEFAULT_ANALYZER_CONFIG)).toEqual([]))

  it('rejects rule sets that would misroute silently', () => {
    const [first] = DEFAULT_ANALYZER_CONFIG.rules
    const broken: AnalyzerConfig = { ...DEFAULT_ANALYZER_CONFIG, rules: [
      ...DEFAULT_ANALYZER_CONFIG.rules,
      { ...first },                                                         // duplicate id
      { ...first, id: 'stateful', pattern: /code/giu },                     // g flag: result depends on earlier calls
      { ...first, id: 'matches-everything', pattern: /x*/u },               // fires on every prompt
      { ...first, id: 'unknown', category: 'cooking' as never },           // category without weights
      { id: 'lonely', label: 'x', category: 'math', strength: 1, pattern: /a/u },
    ] }
    const errors = validateAnalyzerConfig(broken).join('\n')
    expect(errors).toMatch(/eindeutig/)
    expect(errors).toMatch(/stateful.*g- und y-Flag/)
    expect(errors).toMatch(/matches-everything.*leeren Text/)
    expect(errors).toMatch(/unbekannte Kategorie "cooking"/)
    expect(validateAnalyzerConfig({ ...DEFAULT_ANALYZER_CONFIG, rules: [{ id: 'weak', label: 'x', category: 'math', strength: 1, pattern: /a/u }] }))
      .toContain('Kategorie math kann die Schwelle 3 nie erreichen.')
  })

  it('classifies with an injected rule set without touching the default', () => {
    const custom: AnalyzerConfig = { ...DEFAULT_ANALYZER_CONFIG, version: 'custom-v1', rules: [
      ...DEFAULT_ANALYZER_CONFIG.rules,
      { id: 'recipe', label: 'Rezeptwunsch', category: 'writing', strength: 3, pattern: /rezept|recipe/iu },
    ] }
    expect(validateAnalyzerConfig(custom)).toEqual([])
    expect(analyze('Ein Rezept für Pfannkuchen, bitte.', custom).primaryCategory).toBe('writing')
    expect(analyze('Ein Rezept für Pfannkuchen, bitte.', custom).analysisVersion).toBe('custom-v1')
    expect(analyze('Ein Rezept für Pfannkuchen, bitte.').primaryCategory).toBeNull()
  })

  it('honours a stricter threshold', () => {
    const strict = { ...DEFAULT_ANALYZER_CONFIG, categoryThreshold: 5 }
    expect(analyze('Erkläre mir die Photosynthese.').primaryCategory).toBe('learning')
    expect(analyze('Erkläre mir die Photosynthese.', strict).primaryCategory).toBeNull()
  })
})

describe('fallback route', () => {
  it('routes an unrecognized but meaningful prompt to the general profile, marked as fallback', () => {
    const decision = route('What is the capital of France?')
    expect(decision.fallback).toBe(true)
    expect(decision.status).toBe('provisional')
    expect(decision.selected).not.toBeNull()
    expect(decision.details[0]).toMatch(/^Fallback: Keine Aufgabenregel greift/)
    expect(decision.metric).toBe('intelligence')
  })

  it('still abstains when there is nothing to route', () => {
    for (const text of ['???', '42', '…!?']) {
      const decision = route(text)
      expect(decision.status, text).toBe('abstained')
      expect(decision.fallback, text).toBe(false)
    }
  })

  it('can be switched off in the config', () => {
    const noFallback = { ...DEFAULT_ANALYZER_CONFIG, fallback: null }
    expect(validateAnalyzerConfig(noFallback)).toEqual([])
    expect(route('What is the capital of France?', 'balanced', noFallback).status).toBe('abstained')
  })

  it('never overrides a contradictory requirement', () => {
    expect(route('Recherchiere aktuelle Nachrichten ohne Websuche.').status).toBe('abstained')
  })

  it('follows the priority mode like any other route', () => {
    const [fast, balanced, best] = (['fast', 'balanced', 'best'] as const).map((mode) => route('hi', mode))
    expect(fast.threshold!).toBeLessThan(balanced.threshold!)
    expect(best.selected!.score!).toBeGreaterThan(balanced.selected!.score!)
    expect(best.selected!.score).toBe(best.best)
  })
})

describe('confidence score', () => {
  it('is high for a clear single-category prompt and capped below certainty', () => {
    const score = analyze('Berechne 17 * 24.').confidenceScore
    expect(score).toBeGreaterThanOrEqual(0.9)
    expect(score).toBeLessThan(1)
  })

  it('drops for a mixed prompt and makes the recommendation provisional', () => {
    const analysis = analyze('Explain how React hooks work and write an example component.')
    expect(analysis.confidenceScore).toBeLessThan(0.5)
    expect(route('Explain how React hooks work and write an example component.').status).toBe('provisional')
  })

  it('is zero when nothing was recognized', () => expect(analyze('Hallo zusammen').confidenceScore).toBe(0))

  it('is stated in the first reason of a routed decision', () => {
    expect(route('Analysiere meine CSV-Datei mit Umsätzen.').details[0]).toMatch(/^Erkannt als Datenanalyse mit \d+ % Regel-Sicherheit, Komplexität \d\/5\.$/)
  })
})

describe('classification quality', () => {
  it.each([
    ['Schreibe eine Funktion in Python, die Primzahlen findet.', 'coding'],
    ['I need a regex that matches German postal codes.', 'coding'],
    ['Review my pull request for security problems.', 'coding'],
    ['Fix this bug: TypeError: Cannot read properties of undefined', 'coding'],
    ['Upgrade our React app from version 18 - 19.', 'coding'],
    ['Ich brauche ein Gedicht über den Herbst.', 'writing'],
    ['Hilf mir, eine Bewerbung als Werkstudent zu schreiben.', 'writing'],
    ['What are the latest news about the EU AI Act?', 'research'],
    ['Wie funktioniert ein Transformator?', 'learning'],
    ['Solve x^2 - 5x + 6 = 0', 'math'],
    ['Was ist 17 - 4?', 'math'],
    ['Analyze the sentiment of these 5 reviews.', 'dataAnalysis'],
    ['Sollte ich Vue oder React lernen?', 'reasoning'],
    ['Plan a 3-day trip to Rome.', 'planning'],
    ['Erstelle einen Lernplan für die Abiturprüfung.', 'planning'],
  ])('recognizes %s', (text, category) => expect(analyze(text).primaryCategory).toBe(category))

  it.each([
    'Schreibe eine E-Mail: Das Meeting ist am 2026-10-02 von 10-12 Uhr.',
    'Write a Python script that processes logs from 2024-2025.',
    'Fasse den Bericht vom 10/02/2026 zusammen.',
  ])('does not read dates or ranges as arithmetic: %s', (text) => expect(analyze(text).categoryScores.math).toBeUndefined())

  it('keeps a coding migration plan out of the planning category', () => {
    expect(analyze('Migriere die Codebase. Erstelle zuerst einen Migrationsplan, dann implementiere ihn.').categories).not.toContain('planning')
  })

  it('treats quoted text as material, not as a web restriction', () => {
    expect(analyze('Verbessere diesen Text: "Wir arbeiten ohne Internet."').forbidsWeb).toBe(false)
    expect(analyze('Erkläre die Relativitätstheorie ohne Websuche.').forbidsWeb).toBe(true)
  })

  it('takes the goal from the instruction, not from a leading code block', () => {
    expect(analyze('```ts\nconst x = 1\n```\nErkläre diesen Code.').goal.value).toBe('Erkläre diesen Code.')
  })
})

describe('explanation', () => {
  it('lists signals that add up exactly to the category scores', () => {
    const analysis = analyze('Recherchiere die neuesten Nachrichten zur Energiewende mit Quellen.')
    const sums: Record<string, number> = {}
    for (const signal of analysis.signals) sums[signal.category] = (sums[signal.category] ?? 0) + signal.strength
    expect(sums).toEqual(analysis.categoryScores)
    expect(analysis.signals.map((s) => s.ruleId)).toEqual(['research-action', 'research-freshness', 'research-news', 'research-sources'])
  })

  it('quotes the original wording, including Unicode, in each signal', () => {
    const text = '🧠 Bitte erkläre mir Photosynthese.'
    const [signal] = analyze(text).signals
    expect(signal).toMatchObject({ ruleId: 'learning-action', label: 'Erklärwunsch', excerpt: 'erkläre' })
    expect(text).toContain(signal.excerpt)
  })
})
