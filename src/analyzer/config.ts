import type { AnalyzerConfig } from '../data/analysisRules'
import { CATEGORY_WEIGHTS } from '../data/policy'
import { CAPABILITY_IDS, type Category } from '../domain/types'

/** Checks a rule set before use. Returns readable errors; an empty list means the config is usable. */
export function validateAnalyzerConfig(config: AnalyzerConfig): string[] {
  const errors: string[] = []
  if (!config.version.trim()) errors.push('Die Regelversion fehlt.')
  if (!(config.categoryThreshold > 0)) errors.push('categoryThreshold muss größer als 0 sein.')
  if (!(config.ambiguityMargin >= 0)) errors.push('ambiguityMargin darf nicht negativ sein.')
  const ids = new Set<string>()
  for (const rule of config.rules) {
    if (!rule.id.trim() || ids.has(rule.id)) errors.push(`Regel-IDs müssen eindeutig sein: "${rule.id}"`)
    ids.add(rule.id)
    if (!rule.label.trim()) errors.push(`Regel ${rule.id}: Beschriftung fehlt.`)
    if (!(rule.category in CATEGORY_WEIGHTS)) errors.push(`Regel ${rule.id}: unbekannte Kategorie "${rule.category}".`)
    if (![1, 2, 3].includes(rule.strength)) errors.push(`Regel ${rule.id}: Stärke muss 1, 2 oder 3 sein.`)
    for (const regex of [rule.pattern, rule.exclude]) {
      if (regex && (regex.global || regex.sticky)) errors.push(`Regel ${rule.id}: g- und y-Flag machen die Analyse zustandsabhängig.`)
      if (regex?.test('')) errors.push(`Regel ${rule.id}: Muster passt auf leeren Text.`)
    }
  }
  // A category only becomes reachable once its signals can add up to the threshold.
  const reachable = new Map<Category, number>()
  for (const rule of config.rules) reachable.set(rule.category, (reachable.get(rule.category) ?? 0) + rule.strength)
  for (const [category, points] of reachable) {
    if (points < config.categoryThreshold) errors.push(`Kategorie ${category} kann die Schwelle ${config.categoryThreshold} nie erreichen.`)
  }
  for (const [id, weight] of Object.entries(config.fallback ?? {})) {
    if (!(CAPABILITY_IDS as readonly string[]).includes(id) || ![1, 2, 3].includes(weight)) errors.push(`Ungültige Fallback-Fähigkeit: ${id}`)
  }
  if (config.fallback && !Object.keys(config.fallback).length) errors.push('Der Fallback braucht mindestens eine Fähigkeit oder null.')
  return errors
}
