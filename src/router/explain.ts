import { CATEGORY_LABELS, MIN_CLEAR_CONFIDENCE } from '../data/policy'
import type { MetricId, ModelCatalog, PriorityMode, ProviderId, RouteOption, TaskRequirements } from '../domain/types'

const COMPANY: Record<ProviderId, string> = { anthropic: 'Anthropic', openai: 'OpenAI' }
const number = (value: number, digits = 1) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(value)

export const percent = (value: number) => `${Math.round(value * 100)} %`
export const optionLabel = (option: RouteOption) => `${option.family.name} · ${option.setting.label}`

/** Intelligence Index is 0–100; the other AA metrics are shares 0–1 and read better as percent. */
export function formatScore(metric: MetricId, value: number | null): string {
  if (value === null) return 'kein Wert'
  return metric === 'intelligence' ? number(value) : `${number(value * 100)} %`
}

/** a needs no more usage than b according to the documented order inside one pool. */
export function lighterOrEqual(a: RouteOption, b: RouteOption): boolean {
  return a.pool.id === b.pool.id && a.family.weight <= b.family.weight && a.setting.effortRank <= b.setting.effortRank
}

export interface ExplainContext {
  requirements: TaskRequirements
  catalog: ModelCatalog
  metric: MetricId
  mode: PriorityMode
  fraction: number
  complexity: number
  considered: RouteOption[]
}

function taskPhrase({ requirements, complexity }: ExplainContext): string {
  if (!requirements.category) return 'diese allgemeine Frage'
  return `${CATEGORY_LABELS[requirements.category]} mit Komplexität ${complexity}/5`
}

/** Exactly two sentences: why this setting is good enough, and what it saves inside its own allowance. */
export function explainSelection(selected: RouteOption, context: ExplainContext): string {
  const metricLabel = context.catalog.metrics[context.metric].label
  const why = context.mode === 'best'
    ? `${optionLabel(selected)} hat in deinen Abos den höchsten Wert bei ${metricLabel} (${formatScore(context.metric, selected.score)}).`
    : `${optionLabel(selected)} reicht für ${taskPhrase(context)}: ${metricLabel} ${percent(selected.share ?? 0)} des besten Werts, nötig sind ${percent(context.fraction)}.`
  return `${why} ${savings(selected, context)}`
}

function savings(selected: RouteOption, { considered, mode }: ExplainContext): string {
  const { pool, family } = selected
  const company = COMPANY[pool.provider]
  if (mode === 'best') return `Zum Verbrauch: ${family.usage.text}${family.usage.estimate ? ` (${family.usage.estimate})` : ''}.`
  const samePool = considered.filter((option) => option !== selected && option.pool.id === pool.id && option.status !== 'excluded' && option.score !== null)
  const top = [...samePool].sort((a, b) => b.score! - a.score! || b.family.weight - a.family.weight || b.setting.effortRank - a.setting.effortRank)[0]
  if (!top || top.score! <= selected.score!) {
    return samePool.some((option) => lighterOrEqual(option, selected))
      ? `Sparsamere Einstellungen in ${pool.label} erreichen die Schwelle nicht.`
      : `Eine sparsamere Einstellung gibt es in ${pool.label} nicht.`
  }
  if (!lighterOrEqual(selected, top)) return `Ob das weniger Kontingent braucht als ${optionLabel(top)}, ist nicht dokumentiert.`
  const lighterModel = family.weight < top.family.weight
  const lowerEffort = selected.setting.effortRank < top.setting.effortRank
  if (pool.usageDocumentation === 'none') return `Ob das im Kontingent ${pool.label} weniger verbraucht als ${optionLabel(top)}, dokumentiert ${company} nicht.`
  if (pool.usageDocumentation === 'estimates' && lighterModel && family.usage.estimate && top.family.usage.estimate) {
    return `${company} schätzt für ${family.name} ${family.usage.estimate}, für ${top.family.name} ${top.family.usage.estimate}.`
  }
  const what = lighterModel && lowerEffort ? 'das leichtere Modell und die niedrigere Stufe' : lighterModel ? 'das leichtere Modell' : 'die niedrigere Stufe'
  return `Gegenüber ${optionLabel(top)} schont das dein Kontingent, weil ${company} ${what} als sparsamer einstuft.`
}

/** Everything the user should know before trusting the pick; also decides whether it is only provisional. */
export function selectionCaveats(selected: RouteOption, alternatives: RouteOption[], requirements: TaskRequirements): { caveats: string[]; provisional: boolean } {
  const caveats = requirements.issues.map((issue) => issue.message)
  let provisional = requirements.issues.length > 0 || requirements.fallback || requirements.analysisConfidence !== 'clear'
  if (requirements.category && requirements.confidenceScore < MIN_CLEAR_CONFIDENCE) {
    caveats.push(`Die Kategorie ist nur unsicher erkannt (${percent(requirements.confidenceScore)} Regel-Sicherheit).`)
    provisional = true
  }
  if (requirements.complexity === null) {
    caveats.push('Die Komplexität wurde nicht erkannt; die App rechnet mit Stufe 2 von 5.')
    provisional = true
  }
  const { pool, family, setting } = selected
  if (pool.usageDocumentation === 'none') { caveats.push(`Verbrauch unklar: ${pool.usageSummary}`); provisional = true }
  if (setting.availability !== 'yes') { caveats.push(setting.note ?? 'Ob diese Einstellung in deinem Abo verfügbar ist, ist unklar.'); provisional = true }
  if (family.planNote) { caveats.push(family.planNote); provisional = true }
  if (setting.mapping) { caveats.push(`${setting.mapping}.`); provisional = true }
  else if (setting.aa.estimated) { caveats.push('Artificial Analysis gibt für diese Einstellung nur einen geschätzten Wert an.'); provisional = true }
  for (const other of alternatives.filter((option) => option.pool.id === pool.id)) {
    caveats.push(`Ebenfalls ausreichend: ${optionLabel(other)}. Welche der beiden Einstellungen weniger verbraucht, dokumentiert ${COMPANY[pool.provider]} nicht.`)
  }
  if (alternatives.some((option) => option.pool.id !== pool.id)) {
    caveats.push('Die Kontingente der Abos sind getrennt; welches insgesamt sparsamer ist, lässt sich aus den offiziellen Angaben nicht ableiten.')
  }
  if (requirements.contextDemand === 'high') caveats.push('Sehr langer Prompt: Es kommen nur Einstellungen mit starkem Langkontext-Wert (AA-LCR) infrage.')
  return { caveats, provisional }
}
