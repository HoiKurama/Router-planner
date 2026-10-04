import {
  CATEGORY_LABELS, DEFAULT_COMPLEXITY, LONG_CONTEXT_SHARE, METRIC_BY_CATEGORY, MODE_FACTOR, POLICY_VERSION, QUALITY_FRACTIONS,
} from '../data/policy'
import type {
  MetricId, ModelCatalog, OptionStatus, PoolKind, RouteOption, RoutingDecision, RoutingPreferences, TaskRequirements,
} from '../domain/types'
import { explainSelection, formatScore, lighterOrEqual, optionLabel, percent, selectionCaveats } from './explain'
import { makeWorkflow } from './workflow'

/** Scores are compared with a tiny tolerance so 0.93 × 0.636 does not fail on floating-point noise. */
const EPSILON = 1e-9
const stableCompare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const STATUS_ORDER: Record<OptionStatus, number> = { selected: 0, candidate: 1, dominated: 2, below: 3, excluded: 4 }

export function metricFor(requirements: TaskRequirements): MetricId {
  return (requirements.category && METRIC_BY_CATEGORY[requirements.category]) || 'intelligence'
}

/** Share of the best score a setting needs, from category, complexity and priority mode. */
export function requiredFraction(requirements: TaskRequirements, mode: RoutingPreferences['mode']) {
  const complexity = requirements.complexity ?? DEFAULT_COMPLEXITY
  if (mode === 'best') return { complexity, fraction: 1 }
  const row = QUALITY_FRACTIONS[requirements.category ?? 'general']
  return { complexity, fraction: row[complexity - 1] * MODE_FACTOR[mode] }
}

/**
 * a uses no more of the same allowance than b and strictly less in model weight or effort.
 * An option of unclear availability never pushes out one that is known to be available.
 */
function dominates(a: RouteOption, b: RouteOption): boolean {
  return lighterOrEqual(a, b) && (a.family.weight < b.family.weight || a.setting.effortRank < b.setting.effortRank)
    && (a.setting.availability === 'yes' || b.setting.availability !== 'yes')
}

function buildOptions(catalog: ModelCatalog, metric: MetricId, enabled: Set<string>): RouteOption[] {
  const pools = new Map(catalog.pools.map((pool) => [pool.id, pool]))
  return catalog.models.flatMap((family) => family.settings.map((setting): RouteOption => {
    const pool = pools.get(family.pool)!
    const notes: string[] = []
    if (!family.inPlan) notes.push(family.planNote ?? 'Nicht im Abo enthalten.')
    if (!enabled.has(pool.id)) notes.push('Kontingent in den Einstellungen abgewählt.')
    const score = setting.aa[metric]
    if (score === null) notes.push(`${catalog.metrics[metric].label}: kein Wert bei Artificial Analysis.`)
    return { id: `${family.id}/${setting.id}`, family, setting, pool, score, share: null, status: notes.length ? 'excluded' : 'candidate', notes }
  }))
}

function excludeWeakLongContext(options: RouteOption[]) {
  const open = options.filter((option) => option.status !== 'excluded')
  const best = Math.max(0, ...open.map((option) => option.setting.aa.longContext ?? 0))
  for (const option of open) {
    const value = option.setting.aa.longContext
    if (value === null || best === 0) { option.status = 'excluded'; option.notes.push('Langer Prompt: kein AA-LCR-Wert.') }
    else if (value < best * LONG_CONTEXT_SHARE - EPSILON) {
      option.status = 'excluded'
      option.notes.push(`Langer Prompt: AA-LCR ${percent(value / best)} des besten Werts, nötig ${percent(LONG_CONTEXT_SHARE)}.`)
    }
  }
}

/** Tasks that edit files or run code belong in an agent workspace; everything else in a chat app. */
export const needsWorkspace = (requirements: TaskRequirements) => requirements.requiredTools.some((tool) => tool === 'fileWrite' || tool === 'codeExecution')

/** Candidate order. Inside a pool, dominance already removed heavier settings; across pools this is a rule of thumb. */
function compareCandidates(preferred: RoutingPreferences['preferredProvider'], kind: PoolKind, maxWeight: Map<string, number>) {
  const rank = (option: RouteOption) => [
    option.setting.availability === 'yes' ? 0 : 1,
    preferred && option.pool.provider !== preferred ? 1 : 0,
    option.pool.kind === kind ? 0 : 1,
    option.pool.usageDocumentation === 'none' ? 1 : 0,
    option.family.weight / (maxWeight.get(option.pool.id) ?? option.family.weight),
    option.setting.effortRank,
    -(option.score ?? 0),
  ]
  return (a: RouteOption, b: RouteOption) => {
    const left = rank(a)
    const right = rank(b)
    for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return left[i] - right[i]
    return stableCompare(a.id, b.id)
  }
}

function sortConsidered(options: RouteOption[]) {
  return [...options].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.score ?? -1) - (a.score ?? -1) || stableCompare(a.id, b.id))
}

export function routeTask(requirements: TaskRequirements, preferences: RoutingPreferences, catalog: ModelCatalog): RoutingDecision {
  const metric = metricFor(requirements)
  const { complexity, fraction } = requiredFraction(requirements, preferences.mode)
  const base = {
    sourceRevision: requirements.sourceRevision, fallback: requirements.fallback, catalogVersion: catalog.version, policyVersion: POLICY_VERSION,
    metric, complexity: requirements.complexity, fraction: null, best: null, threshold: null, selected: null, alternatives: [],
  }
  const abstain = (explanation: string, considered: RouteOption[] = [], details: string[] = []): RoutingDecision => ({
    ...base, status: 'abstained', considered: sortConsidered(considered), workflow: null, explanation, details,
    caveats: requirements.issues.map((issue) => issue.message),
  })
  if (requirements.category === null && !requirements.fallback) return abstain('Die Eingabe enthält keine auswertbare Aufgabe.')
  if (requirements.issues.some((issue) => issue.critical)) return abstain('Eine entscheidende Anforderung ist ungeklärt oder widersprüchlich.')
  const enabled = new Set(preferences.enabledPools ?? catalog.pools.map((pool) => pool.id))
  if (!catalog.pools.some((pool) => enabled.has(pool.id))) return abstain('Kein Abo ausgewählt. Wähle in den Einstellungen mindestens ein Kontingent aus.')

  const metricInfo = catalog.metrics[metric]
  const options = buildOptions(catalog, metric, enabled)
  if (requirements.contextDemand === 'high') excludeWeakLongContext(options)
  const open = options.filter((option) => option.status !== 'excluded')
  const sure = open.filter((option) => option.setting.availability === 'yes')
  const best = Math.max(0, ...(sure.length ? sure : open).map((option) => option.score!))
  if (!open.length || best <= 0) return abstain(`In deinen Abos hat keine Einstellung einen verwertbaren Wert bei ${metricInfo.label}.`, options)

  const threshold = best * fraction
  for (const option of open) {
    option.share = option.score! / best
    if (option.score! < threshold - EPSILON) {
      option.status = 'below'
      option.notes.push(`${percent(option.share)} des besten Werts, nötig ${percent(fraction)}.`)
    }
  }
  const good = open.filter((option) => option.status === 'candidate')
  for (const option of good) {
    const lighter = good.find((other) => other !== option && dominates(other, option))
    if (lighter) { option.status = 'dominated'; option.notes.push(`Reicht auch, aber ${optionLabel(lighter)} braucht weniger Kontingent.`) }
  }
  const maxWeight = new Map<string, number>()
  for (const family of catalog.models) if (family.inPlan) maxWeight.set(family.pool, Math.max(maxWeight.get(family.pool) ?? 0, family.weight))
  const candidates = good.filter((option) => option.status === 'candidate').sort(compareCandidates(preferences.preferredProvider, needsWorkspace(requirements) ? 'workspace' : 'chat', maxWeight))
  const selected = candidates[0]
  selected.status = 'selected'

  const seenPools = new Set<string>()
  const alternatives = candidates.slice(1).filter((option) => !seenPools.has(option.pool.id) && seenPools.add(option.pool.id)).slice(0, 3)
  const considered = sortConsidered(options)
  const context = { requirements, catalog, metric, mode: preferences.mode, fraction, complexity, considered }
  const { caveats, provisional } = selectionCaveats(selected, alternatives, requirements)
  const task = requirements.category ? CATEGORY_LABELS[requirements.category] : null
  const details = [
    task ? `Erkannt als ${task} mit ${percent(requirements.confidenceScore)} Regel-Sicherheit, Komplexität ${requirements.complexity ?? `unklar (angenommen ${complexity})`}/5.`
      : 'Fallback: Keine Aufgabenregel greift, deshalb zählt der allgemeine Intelligence Index.',
    `Maßstab: ${metricInfo.label} – ${metricInfo.description}.`,
    preferences.mode === 'best'
      ? `Beste Qualität: Gewählt wird der höchste Wert (${formatScore(metric, best)}), unabhängig vom Verbrauch.`
      : `Schwelle: ${percent(fraction)} des besten verfügbaren Werts (${formatScore(metric, best)}), also mindestens ${formatScore(metric, threshold)}.`,
    `Von den ausreichenden Einstellungen bleibt je Kontingent die sparsamste. Zwischen getrennten Kontingenten entscheidet eine Faustregel: sicher verfügbar, dein bevorzugter Anbieter, passende Umgebung (${needsWorkspace(requirements) ? 'Arbeitsumgebung, weil die Aufgabe Dateien bearbeitet oder Code ausführt' : 'Chat'}), dokumentierter Verbrauch, dann das relativ leichtere Modell im eigenen Abo.`,
  ]
  return {
    ...base, status: provisional ? 'provisional' : 'recommended', fraction, best, threshold, selected, alternatives, considered,
    workflow: makeWorkflow(requirements), explanation: explainSelection(selected, context), details, caveats,
  }
}
