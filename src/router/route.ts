import { CAPABILITY_LABELS, CATEGORY_LABELS, MIN_CLEAR_CONFIDENCE, MODE_LABELS, MODE_WEIGHTS, NEAR_TIE_POINTS, POLICY_VERSION, TOOL_LABELS } from '../data/policy'
import type {
  ModelProfile, ModelRegistry, ModelVariant, RoutingContext, RoutingDecision,
  RoutingPreferences, RoutingScore, ScoreContribution, TaskRequirements, WorkflowPlan,
} from '../domain/types'

const round = (value: number) => Math.round(value * 100) / 100
const stableCompare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

function makeWorkflow(requirements: TaskRequirements, registry: ModelRegistry): WorkflowPlan | null {
  const profile = [...registry.workflows]
    .filter((workflow) => requirements.requiredTools.every((tool) => workflow.tools.includes(tool)))
    .sort((a, b) => a.tools.length - b.tools.length || stableCompare(a.id, b.id))[0]
  if (!profile) return null
  const steps: string[] = []
  if (requirements.requiredTools.includes('fileRead')) steps.push('Dateikontext bereitstellen und lesen')
  if (requirements.requiredTools.includes('webSearch')) steps.push('Aktuelle Quellen recherchieren')
  if (requirements.capabilityNeeds.some((need) => need.id === 'planning')) steps.push('Arbeitsschritte planen')
  steps.push(requirements.category === 'coding' ? 'Lösung implementieren' : requirements.category === 'writing' ? 'Text bearbeiten'
    : requirements.category === 'learning' ? 'Erklärung erarbeiten' : requirements.category === 'dataAnalysis' ? 'Daten auswerten'
      : requirements.category === 'planning' ? 'Plan ausarbeiten' : 'Aufgabe bearbeiten')
  steps.push(...requirements.validationSteps)
  return { profile, tools: requirements.requiredTools, steps }
}

export function scoreCandidate(
  requirements: TaskRequirements, preferences: RoutingPreferences, model: ModelProfile,
  variant: ModelVariant, workflow: WorkflowPlan, context: RoutingContext = {},
): RoutingScore {
  const exclusions: string[] = []
  let conditional = false
  if (model.status !== 'active') exclusions.push('Modell im Katalog deaktiviert')
  if (context.unavailableModelIds?.includes(model.id)) exclusions.push('Modell derzeit nicht verfügbar')
  if (preferences.excludedModelIds?.includes(model.id)) exclusions.push('Modell ausdrücklich ausgeschlossen')
  if (preferences.allowedProviderIds && !preferences.allowedProviderIds.includes(model.providerId)) exclusions.push('Provider nicht zugelassen')
  if (!model.capabilities.inputModalities.includes('text')) exclusions.push('Texteingabe nicht unterstützt')
  if (requirements.requiredTools.length) {
    if (model.capabilities.toolCalling === false) exclusions.push('Benötigte Tool-Unterstützung fehlt')
    if (model.capabilities.toolCalling === null) { conditional = true; exclusions.push('Tool-Unterstützung unbekannt') }
  }
  for (const tool of requirements.requiredTools) {
    if (!workflow.profile.tools.includes(tool)) exclusions.push(`${TOOL_LABELS[tool]} fehlt im Workflow`)
    if (requirements.forbiddenTools.includes(tool)) exclusions.push(`${TOOL_LABELS[tool]} ist verboten`)
  }
  if (requirements.minContextTokens !== null) {
    const capacity = model.capabilities.contextWindowTokens
    if (capacity === null) { conditional = true; exclusions.push('Erforderliches Kontextfenster ungeprüft') }
    else if (capacity < requirements.minContextTokens) exclusions.push('Kontextfenster zu klein')
  }
  const ratings = { ...model.capabilities.ratings, ...variant.ratings }
  const totalImportance = requirements.capabilityNeeds.reduce((sum, need) => sum + need.importance, 0)
  const mode = MODE_WEIGHTS[preferences.mode]
  const contributions: ScoreContribution[] = []
  let qualityLower = 0
  let qualityUpper = 0
  let hardFailure = exclusions.some((reason) => !reason.includes('unbekannt') && !reason.includes('ungeprüft'))
  for (const need of requirements.capabilityNeeds) {
    const value = ratings[need.id]
    const weight = totalImportance ? need.importance / totalImportance : 0
    if (need.minimum !== null) {
      if (value === null) { conditional = true; exclusions.push(`${CAPABILITY_LABELS[need.id]}: Mindestfähigkeit unbekannt`) }
      else if (value < need.minimum) { hardFailure = true; exclusions.push(`${CAPABILITY_LABELS[need.id]}: ${value}/4 unter Mindeststufe ${need.minimum}/4`) }
    }
    qualityLower += weight * ((value ?? 0) / 4)
    qualityUpper += weight * (value === null ? 1 : value / 4)
    contributions.push({ id: need.id, label: CAPABILITY_LABELS[need.id], rating: value,
      weight: weight * mode.quality, lowerPoints: 100 * weight * mode.quality * ((value ?? 0) / 4),
      upperPoints: 100 * weight * mode.quality * (value === null ? 1 : value / 4) })
  }
  const speedLower = (variant.speed ?? 0) / 4
  const costLower = (variant.costEfficiency ?? 0) / 4
  for (const [id, label, rating, weight] of [
    ['speed', 'Geschwindigkeit', variant.speed, mode.speed],
    ['costEfficiency', 'Kosteneffizienz', variant.costEfficiency, mode.cost],
  ] as const) contributions.push({ id, label, rating, weight, lowerPoints: 100 * weight * ((rating ?? 0) / 4), upperPoints: 100 * weight * (rating === null ? 1 : rating / 4) })
  return {
    candidateId: `${model.id}/${variant.id}/${workflow.profile.id}`, model, variant, workflow,
    eligibility: hardFailure ? 'excluded' : conditional ? 'conditional' : 'eligible', exclusions,
    lower: round(100 * (mode.quality * qualityLower + mode.speed * speedLower + mode.cost * costLower)),
    upper: round(100 * (mode.quality * qualityUpper + mode.speed * (variant.speed === null ? 1 : speedLower) + mode.cost * (variant.costEfficiency === null ? 1 : costLower))),
    qualityLower, speedLower, costLower, contributions,
  }
}

export function compareCandidates(a: RoutingScore, b: RoutingScore): number {
  return b.lower - a.lower || b.qualityLower - a.qualityLower || b.speedLower - a.speedLower || b.costLower - a.costLower
    || a.workflow.tools.length - b.workflow.tools.length || stableCompare(a.candidateId, b.candidateId)
}

function distinctAlternatives(candidates: RoutingScore[], selected: RoutingScore | null): RoutingScore[] {
  const seen = new Set(selected ? [selected.model.id] : [])
  return candidates.filter((candidate) => {
    if (seen.has(candidate.model.id)) return false
    seen.add(candidate.model.id)
    return true
  }).slice(0, 2)
}

const percent = (value: number) => `${Math.round(value * 100)} %`

export function routeTask(
  requirements: TaskRequirements, preferences: RoutingPreferences, registry: ModelRegistry, context: RoutingContext = {},
): RoutingDecision {
  const base = { sourceRevision: requirements.sourceRevision, registryVersion: registry.version, policyVersion: POLICY_VERSION, fallback: requirements.fallback }
  const workflow = makeWorkflow(requirements, registry)
  const caveats = requirements.issues.map((issue) => issue.message)
  const routable = requirements.category !== null || requirements.fallback
  if (!routable || !workflow || requirements.issues.some((issue) => issue.critical)) {
    return { ...base, status: 'abstained', selected: null, alternatives: [], considered: [],
      reasons: [!routable ? 'Die Eingabe enthält keine auswertbare Aufgabe.' : !workflow ? 'Keine Zielumgebung stellt die erforderlichen Tools bereit.' : 'Eine entscheidende Anforderung ist ungeklärt oder widersprüchlich.'], caveats }
  }
  const considered = registry.models.flatMap((model) => model.variants.map((variant) => scoreCandidate(requirements, preferences, model, variant, workflow, context))).sort(compareCandidates)
  const eligible = considered.filter((candidate) => candidate.eligibility === 'eligible')
  const selected = eligible[0] ?? null
  if (!selected || selected.upper - selected.lower >= 99.99) {
    return { ...base, status: 'abstained', selected: null, considered,
      alternatives: distinctAlternatives(considered.filter((c) => c.eligibility === 'conditional'), null),
      reasons: ['Kein Kandidat erfüllt die Anforderungen nachweislich mit ausreichend Bewertungsdaten.'], caveats }
  }
  const runners = eligible.filter((candidate) => candidate.model.id !== selected.model.id)
  const nearTie = runners.length > 0 && selected.lower - runners[0].lower <= NEAR_TIE_POINTS
  const overlap = eligible.some((candidate) => candidate !== selected && candidate.upper > selected.lower && candidate.upper > candidate.lower)
  const missingRatings = selected.upper > selected.lower
  const unsure = requirements.fallback || requirements.analysisConfidence !== 'clear' || requirements.confidenceScore < MIN_CLEAR_CONFIDENCE
  if (nearTie) caveats.push(`Mehrere Modelle liegen höchstens ${NEAR_TIE_POINTS} Punkte auseinander; die Reihenfolge ist knapp.`)
  if (overlap || missingRatings) caveats.push('Unbekannte Bewertungen lassen keine eindeutige Rangfolge zu.')
  const provisional = nearTie || overlap || missingRatings || unsure || requirements.issues.length > 0
  const strongest = selected.contributions.filter((c) => c.id !== 'speed' && c.id !== 'costEfficiency')
    .sort((a, b) => b.weight - a.weight).slice(0, 2)
  const task = requirements.category ? CATEGORY_LABELS[requirements.category] : 'allgemeine Aufgaben'
  const reasons = [
    requirements.fallback
      ? `Fallback-Route: Keine Aufgabenregel greift, deshalb zählt das allgemeine Profil (${strongest.map((c) => c.label).join(' + ')}).`
      : `Erkannt als ${task} mit ${percent(requirements.confidenceScore)} Regel-Sicherheit.`,
    `${selected.model.name} erfüllt die geschätzten Mindestfähigkeiten für ${task}: ${strongest.map((c) => `${c.label} ${c.rating ?? 'unbekannt'}/4`).join(' · ')}.`,
    `${MODE_LABELS[preferences.mode]} gewichtet Qualität mit ${MODE_WEIGHTS[preferences.mode].quality * 100} %, Geschwindigkeit mit ${MODE_WEIGHTS[preferences.mode].speed * 100} % und Kosteneffizienz mit ${MODE_WEIGHTS[preferences.mode].cost * 100} %.`,
  ]
  return { ...base, status: provisional ? 'provisional' : 'recommended', selected,
    alternatives: distinctAlternatives(runners, selected), considered, reasons, caveats }
}
