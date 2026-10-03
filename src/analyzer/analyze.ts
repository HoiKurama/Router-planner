import { DEFAULT_ANALYZER_CONFIG, type AnalyzerConfig } from '../data/analysisRules'
import { CATEGORY_WEIGHTS, COMPLEXITY_MINIMUM, MAX_PROMPT_CODEPOINTS } from '../data/policy'
import type {
  CapabilityId, CapabilityNeed, Category, Demand, Evidence, Finding,
  Language, PromptInput, Signal, SkillRating, TaskAnalysis, TaskRequirements, ToolId,
} from '../domain/types'

export function validateInput(text: string): string | null {
  if (!text.trim()) return 'Bitte gib zuerst einen Prompt ein.'
  if (Array.from(text).length > MAX_PROMPT_CODEPOINTS) {
    return `Der Prompt darf höchstens ${new Intl.NumberFormat('de-DE').format(MAX_PROMPT_CODEPOINTS)} Zeichen enthalten.`
  }
  return null
}

function detectLanguage(text: string): Language {
  const de = (text.match(/\b(der|die|das|und|eine?|mit|für|bitte|schreibe|baue|beweise|erkläre|berechne|analysiere|recherchiere|verbessere)\b/giu) ?? []).length
  const en = (text.match(/\b(the|and|an?|with|for|please|write|build|prove|explain|calculate|analyze|research|improve)\b/giu) ?? []).length
  if (!de && !en) return 'unknown'
  if (de && en && Math.min(de, en) / Math.max(de, en) >= 0.6) return 'mixed'
  return de > en ? 'de' : 'en'
}

/** Masking preserves UTF-16 offsets so every evidence range points to the original. */
const blank = (value: string) => value.replace(/[^\r\n]/g, ' ')

/** Quoted text and code blocks are material to work on, not instructions. */
function contextView(text: string): string {
  return text
    .replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g, blank)
    .replace(/"[^"\n]*"|„[^“\n]*“/g, blank)
}

/** Additionally hides negated clauses ("do not write code"), which must not drive the category. */
function instructionView(context: string): string {
  return context.replace(/(?:\bdo not\b|\bdon't\b|\bkeine?\b|\bnicht\b)[^.!?\n,;]*/giu, blank)
}

function finding<T>(value: T, evidence: Evidence[], source: 'explicit' | 'inferred' = 'inferred'): Finding<T> {
  return { value, evidence, source }
}

function extractLines(text: string, pattern: RegExp, ruleId: string): Finding<string>[] {
  return [...text.matchAll(/[^\r\n]+/g)].filter((m) => pattern.test(m[0])).map((m) => (
    finding(m[0], [{ ruleId, start: m.index, end: m.index + m[0].length }], 'explicit')
  ))
}

const excerpt = (text: string, start: number, end: number) => {
  const value = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return value.length > 60 ? `${value.slice(0, 57)}…` : value
}

/** Signal strength (how much evidence) and separation (gap to the runner-up), capped below certainty. */
function confidenceScore(scores: Partial<Record<Category, number>>, primary: Category | null, threshold: number): number {
  if (!primary) return 0
  const top = scores[primary]!
  const runnerUp = Math.max(0, ...Object.entries(scores).filter(([c]) => c !== primary).map(([, s]) => s!))
  const strength = Math.min(1, top / (2 * threshold))
  const separation = (top - runnerUp) / top
  return Math.round(Math.min(0.95, 0.5 * strength + 0.5 * separation) * 100) / 100
}

export function analyzePrompt(input: PromptInput, config: AnalyzerConfig = DEFAULT_ANALYZER_CONFIG): TaskAnalysis {
  const error = validateInput(input.text)
  if (error) throw new Error(error)
  const text = input.text
  const context = contextView(text)
  const view = instructionView(context)
  const evidence: Evidence[] = []
  const signals: Signal[] = []
  const scores: Partial<Record<Category, number>> = {}
  const ruleCounts: Partial<Record<Category, number>> = {}
  const firstMatch: Partial<Record<Category, number>> = {}
  const signatures = new Set<Category>()

  for (const rule of config.rules) {
    if (rule.exclude?.test(view)) continue
    const match = rule.pattern.exec(view)
    if (!match) continue
    const start = match.index
    const end = match.index + match[0].length
    scores[rule.category] = (scores[rule.category] ?? 0) + rule.strength
    ruleCounts[rule.category] = (ruleCounts[rule.category] ?? 0) + 1
    if (rule.strength === 3) signatures.add(rule.category)
    firstMatch[rule.category] = Math.min(firstMatch[rule.category] ?? Infinity, start)
    evidence.push({ ruleId: rule.id, start, end })
    signals.push({ ruleId: rule.id, label: rule.label, category: rule.category, strength: rule.strength, excerpt: excerpt(text, start, end) })
  }

  const categories = (Object.keys(scores) as Category[])
    .filter((c) => scores[c]! >= config.categoryThreshold)
    // On equal scores the task mentioned first is usually the main one ("Prove X … and explain why").
    .sort((a, b) => scores[b]! - scores[a]! || firstMatch[a]! - firstMatch[b]! || (a < b ? -1 : 1))
  const primaryCategory = categories[0] ?? null
  const multiStep = /zuerst[^.!?]{0,250}(?:dann|anschließend|danach)|first[^.!?]{0,250}(?:then|next)|mehrstufig|multi.step|migration[^.!?]{0,180}(?:tests?|rollback|kompatib)|migriere[^.!?]{0,180}(?:tests?|kompatib)/iu.test(view)
  const explicitMix = /(?:und|and)[^.!?\n]{0,20}(?:schreibe|write|analysiere|analyze|recherchiere|research|implementiere|implement)/iu.test(view)
  const ambiguity = categories.length > 1 && scores[categories[0]]! - scores[categories[1]]! < config.ambiguityMargin && !explicitMix
  const confidence = !primaryCategory ? 'unknown' : ambiguity ? 'ambiguous'
    : signatures.has(primaryCategory) || (ruleCounts[primaryCategory] ?? 0) >= 2 ? 'clear' : 'ambiguous'
  // Pure punctuation or digits is not a task; anything with words gets the general fallback route.
  const fallback = !primaryCategory && config.fallback !== null && /\p{L}{2,}/u.test(context)

  const arithmetic = /^\s*(?:berechne|calculate|was ist|what is)?\s*\d+(?:[.,]\d+)?\s*[+*/−-]\s*\d+(?:[.,]\d+)?\s*[?.]?\s*$/iu.test(text)
  let level: 1 | 2 | 3 | 4 | 5 = arithmetic ? 1 : 2
  const difficultyEvidence: Evidence[] = []
  const difficultyRules = [
    { level: 3 as const, pattern: /projekt|project|mehrstufig|multi.step|integration|mehrere|multiple/iu },
    { level: 4 as const, pattern: /\bbeweise|\bprove|migration|migriere|migrate|architektur|architecture|nebenläufig|concurren|kompatib|compatib/iu },
    { level: 5 as const, pattern: /(?:verteilte|distributed)[^.!?\n]{0,35}(?:system|architektur)|(?:gesamte|entire|large)[^.!?\n]{0,25}(?:codebase|monorepo|repository)|formal[^.!?\n]{0,30}(?:verifiz|verif)/iu },
  ]
  for (const rule of difficultyRules) {
    const match = rule.pattern.exec(view)
    if (match) {
      if (rule.level > level) level = rule.level
      difficultyEvidence.push({ ruleId: `difficulty-${rule.level}`, start: match.index, end: match.index + match[0].length })
    }
  }
  if (multiStep && level < 3) level = 3
  const needsCurrentInformation = /aktuell|neueste|heut|latest|\bcurrent|up.to.date/iu.test(view)
  // Uses the context view (negations kept, quotes hidden): a quoted "ohne Internet" is no instruction.
  const forbidsWeb = /(?:ohne|keine?|nicht|without|no|do not|don't)\s+(?:eine?\s+|use\s+)?(?:web(?:suche|zugriff)?|recherche|browsing|internet|research)|recherchiere\s+nicht/iu.test(context)
  const researchNeeded = primaryCategory === 'research' || (needsCurrentInformation && (scores.research ?? 0) >= config.categoryThreshold)
  const fileAccessNeeded = /(?:analysiere|analyze|analyse|inspect|öffne|open|lies|read)[^.!?\n]{0,65}(?:datei|file|csv|xlsx|pdf|repository|codebase)|(?:meine|diese|angehängte|attached|this|my)\s+(?:datei|file|csv|xlsx|repository)|(?:migriere|migrate|refactor)[^.!?\n]{0,60}(?:repository|projekt|project|codebase)/iu.test(view)
  const needsWorkspace = primaryCategory === 'coding' && /projekt|project|repository|codebase|migration|migriere|migrate/iu.test(view)
  const reasoningDemand: Demand = !primaryCategory ? 'unknown' : arithmetic ? 'low'
    : level >= 4 && ['math', 'coding', 'reasoning', 'dataAnalysis'].includes(primaryCategory) ? 'high'
      : ['math', 'coding', 'reasoning', 'dataAnalysis'].includes(primaryCategory) || multiStep ? 'medium' : 'low'
  const accuracyNeed: Demand = /exakt|genau|fehlerfrei|korrekt|prüfe|überprüfe|exact|accurate|verify|correct|tests?|quellen|sources/iu.test(view)
    ? 'high' : primaryCategory ? 'medium' : 'unknown'
  const issues: TaskAnalysis['issues'] = []
  if (fallback) issues.push({ id: 'unclear-goal', message: 'Keine Aufgabenregel greift. Die Empfehlung nutzt das allgemeine Fallback-Profil; ein konkretes Verb (z. B. „schreibe“, „erkläre“, „berechne“) macht sie gezielter.', critical: false })
  else if (!primaryCategory) issues.push({ id: 'unclear-goal', message: 'Beschreibe die konkrete Aufgabe und das gewünschte Ergebnis.', critical: false })
  if (ambiguity) issues.push({ id: 'ambiguous-task', message: 'Mehrere Aufgabenarten sind ähnlich stark vertreten. Benenne die Hauptaufgabe.', critical: false })
  if (fileAccessNeeded) issues.push({ id: 'missing-file', message: 'Stelle die erwähnte Datei im späteren Workflow bereit; hier werden keine Dateien gelesen.', critical: false })
  if (researchNeeded && needsCurrentInformation && forbidsWeb) issues.push({ id: 'freshness-conflict', message: 'Aktuelle Informationen und ein Verbot von Webzugriff widersprechen sich ohne bereitgestellte aktuelle Quellen.', critical: true })
  if (/(?:ki.modell|ai model|model execution)[^.!?\n]{0,65}(?:budget|maximal|max\b|kosten|cost)|(?:nutze|verwende|use)\s+(?:ausschließlich|nur|only|exclusively)\s+(?:das\s+modell\s+)?(?:gpt|claude|gemini|llama)/iu.test(view)) {
    issues.push({ id: 'unresolved-execution-constraint', message: 'Die strikte Modell- oder Budgetvorgabe lässt sich mit dem Demo-Katalog nicht verlässlich prüfen.', critical: true })
  }
  if (primaryCategory === 'writing' && /verbessere|überarbeite|improve|rewrite/iu.test(view) && !/[\n:"„]/u.test(text)) {
    issues.push({ id: 'missing-text', message: 'Füge den Text hinzu, den du verbessern möchtest.', critical: false })
  }

  // The goal is the first line that is an instruction, not a pasted code block or quote.
  const goalLine = /\S[^\r\n]*/u.exec(context) ?? /\S[^\r\n]*/u.exec(text)!
  const goalEnd = text.indexOf('\n', goalLine.index)
  const goalText = text.slice(goalLine.index, goalEnd < 0 ? text.length : goalEnd).trimEnd()
  const goalEvidence = [{ ruleId: 'goal-excerpt', start: goalLine.index, end: goalLine.index + goalText.length }]
  return {
    sourceRevision: input.revision, analysisVersion: config.version,
    language: detectLanguage(view), goal: primaryCategory || fallback ? finding(goalText, goalEvidence, 'explicit') : { value: null, source: 'unknown', evidence: [] },
    primaryCategory, categories, categoryScores: scores,
    constraints: extractLines(text, /muss|soll|nur|ohne|nicht|behalte|erhalte|must|should|only|without|do not|preserve|keep|format|maximal/iu, 'constraint-line'),
    steps: extractLines(text, /zuerst|dann|anschließend|danach|first|then|next|^\s*\d+[.)]/iu, 'step-line'),
    complexity: primaryCategory ? finding(level, difficultyEvidence.length ? difficultyEvidence : evidence) : { value: null, source: 'unknown', evidence: [] },
    reasoningDemand,
    contextDemand: text.length > 12_000 ? 'high' : fileAccessNeeded || needsWorkspace ? 'medium' : primaryCategory ? 'low' : 'unknown',
    toolDemand: researchNeeded || fileAccessNeeded || needsWorkspace ? 'high' : primaryCategory ? 'low' : 'unknown',
    speedNeed: /schnell|kurz|sofort|quick|fast|urgent|brief/iu.test(view) ? 'high' : primaryCategory ? 'medium' : 'unknown',
    accuracyNeed, multiStep: primaryCategory ? multiStep ? 'yes' : 'no' : 'unknown',
    codingTask: primaryCategory ? categories.includes('coding') ? 'yes' : 'no' : 'unknown',
    researchNeeded: primaryCategory ? researchNeeded ? 'yes' : 'no' : 'unknown',
    fileAccessNeeded: primaryCategory ? fileAccessNeeded || needsWorkspace ? 'yes' : 'no' : 'unknown',
    needsWorkspace, needsCurrentInformation, forbidsWeb, issues,
    evidence: [...evidence, ...difficultyEvidence], signals, confidence,
    confidenceScore: confidenceScore(scores, primaryCategory, config.categoryThreshold), fallback,
  }
}

export function deriveRequirements(analysis: TaskAnalysis, config: AnalyzerConfig = DEFAULT_ANALYZER_CONFIG): TaskRequirements {
  const needs = new Map<CapabilityId, CapabilityNeed>()
  const add = (id: CapabilityId, importance: 1 | 2 | 3, minimum: SkillRating | null = null) => {
    const existing = needs.get(id)
    needs.set(id, { id, importance: Math.max(existing?.importance ?? 0, importance) as 1 | 2 | 3,
      minimum: existing?.minimum != null ? Math.max(existing.minimum, minimum ?? 0) as SkillRating : minimum, source: 'inferred' })
  }
  const primary = analysis.primaryCategory
  if (primary) {
    const weights = Object.entries(CATEGORY_WEIGHTS[primary]) as [CapabilityId, 1 | 2 | 3][]
    for (const [id, weight] of weights) add(id, weight)
    const [main] = weights.reduce((best, entry) => entry[1] > best[1] ? entry : best)
    add(main, 3, COMPLEXITY_MINIMUM[(analysis.complexity.value ?? 2) - 1])
    for (const category of analysis.categories.filter((c) => c !== primary)) {
      for (const id of Object.keys(CATEGORY_WEIGHTS[category])) add(id as CapabilityId, 1)
    }
  } else if (analysis.fallback && config.fallback) {
    // No minimum: the fallback must stay reachable for every general-purpose model.
    for (const [id, weight] of Object.entries(config.fallback)) add(id as CapabilityId, weight)
  }
  const demandImportance = { low: 1, medium: 2, high: 3 } as const
  if (analysis.reasoningDemand !== 'unknown') {
    const need = demandImportance[analysis.reasoningDemand]
    add('reasoning', need, need)
  }
  if (analysis.multiStep === 'yes') {
    const need = (analysis.complexity.value ?? 2) >= 4 ? 3 : 2
    add('planning', need, need)
  }
  const requiredTools: ToolId[] = []
  if (analysis.researchNeeded === 'yes' && !analysis.forbidsWeb) requiredTools.push('webSearch', 'webRead')
  if (analysis.fileAccessNeeded === 'yes') requiredTools.push('fileRead')
  if (analysis.needsWorkspace) requiredTools.push('fileWrite', 'codeExecution')
  if (analysis.primaryCategory === 'dataAnalysis' && analysis.fileAccessNeeded === 'yes') requiredTools.push('codeExecution')
  if (requiredTools.length) add('toolUse', 3, 2)
  const validationSteps = analysis.accuracyNeed === 'high' || analysis.multiStep === 'yes'
    ? [primary === 'coding' ? 'Tests und Anforderungen prüfen' : primary === 'research' ? 'Quellen und Aktualität prüfen' : primary === 'math' ? 'Ergebnis und Randfälle prüfen' : 'Ergebnis gegen die Anforderungen prüfen'] : []
  return {
    sourceRevision: analysis.sourceRevision, category: primary,
    capabilityNeeds: [...needs.values()], requiredTools: [...new Set(requiredTools)],
    forbiddenTools: analysis.forbidsWeb ? ['webSearch', 'webRead'] : [],
    contextDemand: analysis.contextDemand, minContextTokens: null,
    validationSteps, issues: analysis.issues, analysisConfidence: analysis.confidence,
    confidenceScore: analysis.confidenceScore, fallback: analysis.fallback, language: analysis.language,
  }
}
