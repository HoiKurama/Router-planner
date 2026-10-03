import type { CapabilityId, Category } from '../domain/types'
import { ANALYSIS_VERSION } from './policy'

export interface AnalysisRule {
  id: string
  /** Short German reason shown to the user when the rule fires. */
  label: string
  category: Category
  strength: 1 | 2 | 3
  pattern: RegExp
  exclude?: RegExp
}

export interface AnalyzerConfig {
  version: string
  rules: readonly AnalysisRule[]
  /** Points a category needs before it counts as recognized. */
  categoryThreshold: number
  /** Below this point gap the top two categories count as ambiguous. */
  ambiguityMargin: number
  /** Capabilities used when no category is recognized; null disables the fallback route. */
  fallback: Partial<Record<CapabilityId, 1 | 2 | 3>> | null
}

const WRITING_ARTIFACTS = 'gedicht|poem|text|brief|letter|e.?mail|essay|aufsatz|artikel|article|story|geschichte|bewerbung|anschreiben|cover letter|lebenslauf|blog\\w*|beitrag|rede|speech|slogan|einladung|invitation|bericht|report|zusammenfassung|summary'
const words = (alternatives: string) => new RegExp(alternatives, 'iu')

/**
 * Strength 3 = unambiguous signature, 2 = contextual combination, 1 = supporting word.
 * Every rule counts at most once. Patterns run on the instruction view: quoted text, code blocks
 * and negated clauses are blanked out, so they never drive the classification.
 * Patterns must not use the g or y flag (validateAnalyzerConfig enforces it): stateful regexes
 * would make the analysis depend on previous calls.
 */
export const ANALYSIS_RULES: readonly AnalysisRule[] = [
  { id: 'coding-action', label: 'Programmier-Auftrag', category: 'coding', strength: 3,
    pattern: /(?:baue|erstelle|entwickle|implementiere|programmiere|schreib(?:e|en)?|build|create|implement|develop|write|code)\b[^.!?\n]{0,90}(?:react|typescript|javascript|python|\bcode\b|funktion|function|\bapp\b|projekts?\b|project\b|komponente|component|parser|skript|script|klasse\b|class\b|methode|method\b|algorithm|regex|\bsql\b|query|abfrage|endpoint|unit[- ]?tests?)/iu,
    exclude: /(?:write|schreibe|verfasse)\s+(?:(?:an?|ein(?:e|en)?)\s+)?(?:poem|gedicht|email|e.mail|letter|brief|article|artikel|story|geschichte|essay|aufsatz|text)\b/iu },
  { id: 'coding-repair', label: 'Fehlersuche oder Umbau im Code', category: 'coding', strength: 3,
    pattern: /debug(?:ge|ging)?|refactor(?:ing|e)?|migriere|migrate|(?:behebe|repariere|fix)[^.!?\n]{0,60}(?:bug|fehler|error|exception|crash|code)|(?:upgrade|update|aktualisiere)[^.!?\n]{0,40}(?:react|\bapp\b|dependenc|abhängigkeit|packages?|pakete|framework|library|bibliothek|node)/iu },
  { id: 'coding-review', label: 'Code-Review', category: 'coding', strength: 3,
    pattern: /(?:review|reviewe|prüfe|überprüfe|check|audit)[^.!?\n]{0,40}(?:pull request|\bpr\b|merge request|\bcode\b|commit|\bdiff\b)/iu },
  { id: 'coding-request', label: 'Wunsch nach Code', category: 'coding', strength: 3,
    pattern: /(?:brauche|need|want|möchte|suche|looking for)[^.!?\n]{0,30}(?:regex|skript|script|funktion|function|\bsql\b|query|programm|program\b|\bapp\b)/iu },
  { id: 'coding-artifact', label: 'Technischer Begriff', category: 'coding', strength: 2,
    pattern: /\bregex\b|regulären? ausdruck|\bsql\b|stack ?trace|\w+(?:error|exception):|pull request|\bnpm\b|\bgit\b|\bdocker\b/iu },
  { id: 'coding-context', label: 'Software-Kontext', category: 'coding', strength: 1,
    pattern: /react|typescript|javascript|python|repository|codebase|software|frontend|backend|\bcode\b/iu },

  // A minus sign alone is no evidence: dates (2026-10-02), ranges (10-12 Uhr) and versions (18 - 19) use it.
  { id: 'math-expression', label: 'Rechenausdruck', category: 'math', strength: 3,
    pattern: /(?<![\d.,/:-])\d+(?:[.,]\d+)?\s*[+*/×÷^]\s*\d+(?:[.,]\d+)?(?![\d/:])/u },
  { id: 'math-question', label: 'Rechenfrage', category: 'math', strength: 3,
    pattern: /(?:was ist|what is|what's|wie ?viel (?:ist|sind|ergibt)|how much is|berechne|calculate|compute|rechne)\s*-?\d+(?:[.,]\d+)?\s*[-+*/×÷^]\s*-?\d/iu },
  { id: 'math-bare', label: 'Reiner Rechenausdruck', category: 'math', strength: 3,
    pattern: /^\s*-?\d+(?:[.,]\d+)?(?:\s*[-+*/×÷^]\s*-?\d+(?:[.,]\d+)?)+\s*[=?]?\s*$/u },
  { id: 'math-equation', label: 'Gleichung mit Variable', category: 'math', strength: 3,
    pattern: /(?<![a-z])\d*[a-z](?![a-z])(?:\s*\^\s*\d+|[²³])?\s*[-+*/]\s*[^=\n]{0,40}=\s*-?\d+/iu },
  { id: 'math-action', label: 'Mathematischer Auftrag', category: 'math', strength: 3,
    pattern: /\b(?:berechne|beweise|integriere|differenziere|calculate|prove|integrate|differentiate|(?:solve|löse)[^.!?\n]{0,45}(?:equation|gleichung|integral|system))/iu },
  { id: 'math-domain', label: 'Mathematischer Fachbegriff', category: 'math', strength: 2,
    pattern: /gleichung|integral|mathemati|theorem|satz von|eigenwert|eigenvalue|algebra|konvergenz|convergence|wahrscheinlichkeit|probability|ableitung|derivative|matrix|matrizen/iu },

  { id: 'research-action', label: 'Rechercheauftrag', category: 'research', strength: 3,
    pattern: /recherchier|research\b|look up|fact.?check|faktencheck|(?:find|finde|such(?:e)?)[^.!?\n]{0,50}(?:latest|current|sources|studies|papers|quellen|studien|aktuell)/iu },
  { id: 'research-freshness', label: 'Bedarf an aktuellen Informationen', category: 'research', strength: 2,
    pattern: /aktuell(?:e|en|er|es)?|neueste(?:n|r)?|heut(?:e|ig)|latest|up.to.date|\bcurrent(?:ly)?/iu },
  { id: 'research-news', label: 'Nachrichtenbezug', category: 'research', strength: 2,
    pattern: /\b(?:news|nachrichten|neuigkeiten|schlagzeilen|headlines)\b/iu },
  { id: 'research-sources', label: 'Quellenbezug', category: 'research', strength: 1,
    pattern: /quellen|sources|belege|citations|nachweise/iu },

  { id: 'writing-action', label: 'Schreib- oder Überarbeitungsauftrag', category: 'writing', strength: 3,
    pattern: words(`(?:verbessere|überarbeite|redigiere|korrigiere|improve|rewrite|edit|proofread)[^.!?\\n]{0,55}(?:text|absatz|paragraph|email|e.mail|essay)|(?:schreib(?:e|en)?|write|verfasse|draft|compose|formuliere)\\b[^.!?\\n]{0,30}(?:${WRITING_ARTIFACTS})|(?:${WRITING_ARTIFACTS})[^.!?\\n]{0,40}zu (?:schreiben|verfassen|formulieren)`) },
  { id: 'writing-summary', label: 'Zusammenfassen, Übersetzen oder Umformulieren', category: 'writing', strength: 3,
    pattern: /fasse[^.!?\n]{0,50}zusammen|summari[sz]e|übersetze|translate|paraphrase|umformulier|rephrase|tl;?dr/iu },
  { id: 'writing-request', label: 'Wunsch nach einem Text', category: 'writing', strength: 3,
    pattern: words(`(?:brauche|need|want|möchte|hätte gern|suche)[^.!?\\n]{0,30}(?:${WRITING_ARTIFACTS})`) },

  { id: 'learning-action', label: 'Erklärwunsch', category: 'learning', strength: 3,
    pattern: /erkläre|bring mir|teach me|explain|eli5|walk me through|quiz me/iu },
  // Concept questions ("Wie funktioniert …?", "What is a …?"); fact questions ("What is the capital …?") stay general.
  { id: 'learning-question', label: 'Verständnisfrage', category: 'learning', strength: 3,
    pattern: /(?:^|[.!?]\s+)(?:wie funktionier(?:t|en)|warum|wieso|weshalb|was (?:ist|sind|bedeutet) (?:ein|eine|einen)\b|how (?:does|do)\b[^?\n]{0,60}\bwork|why (?:does|do|is|are)\b|what (?:is|are) (?:a|an)\b)/iu },
  { id: 'learning-context', label: 'Lernkontext', category: 'learning', strength: 1,
    pattern: /verstehen|understand|anfänger|beginner|lernen|learning/iu },

  { id: 'data-action', label: 'Datenauswertung', category: 'dataAnalysis', strength: 3,
    pattern: /(?:analysiere|werte|analyze|analyse|inspect)[^.!?\n]{0,75}(?:datei|file|csv|xlsx|tabelle|table|daten|data|sentiment|stimmung|umfrage|survey|reviews|rezensionen|\blogs?\b|metriken|metrics|kennzahlen|zahlen|numbers)|(?:daten|data|csv|xlsx)[^.!?\n]{0,60}(?:analys|auswert|clean|bereinig)/iu },
  { id: 'data-context', label: 'Datenkontext', category: 'dataAnalysis', strength: 1,
    pattern: /datensatz|dataset|statisti|csv|xlsx|spreadsheet|pandas|excel|korrelation|correlation|regression|median/iu },

  { id: 'reasoning-action', label: 'Abwägen oder Entscheiden', category: 'reasoning', strength: 3,
    pattern: /abwäge|vergleiche|bewerte|entscheide|überlege|compare|evaluate|decide|reason through|weigh/iu },
  { id: 'reasoning-question', label: 'Entscheidungsfrage', category: 'reasoning', strength: 3,
    pattern: /(?:^|[.!?]\s+)(?:soll(?:te)? ich|should i\b|lohnt (?:es )?sich|is it worth)|pros? (?:and|&) cons?|vor- und nachteile|vorteile und nachteile/iu },

  { id: 'planning-action', label: 'Planungsauftrag', category: 'planning', strength: 3,
    pattern: /(?:^|[.!?]\s+|\b(?:bitte|please)\s+)(?:plane|plan)\s+(?:ein|eine|einen|meine?n?|unsere?n?|a|an|my|our|the)\b|(?:erstelle|create|make|build|entwirf|draft|mach(?:e)?)[^.!?\n]{0,40}\b(?:plan|pläne|plans|strategie|strategy|roadmap|konzept|concept|zeitplan|schedule|itinerary|reiseplan|lernplan|trainingsplan|agenda|checkliste|checklist)\b/iu },
  { id: 'planning-context', label: 'Planungskontext', category: 'planning', strength: 1,
    pattern: /\b(?:reise|trip|urlaub|vacation|meilenstein|milestone|deadline|budget)\b/iu },
]

export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  version: ANALYSIS_VERSION,
  rules: ANALYSIS_RULES,
  categoryThreshold: 3,
  ambiguityMargin: 2,
  fallback: { reasoning: 2, writing: 2 },
}
