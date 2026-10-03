import type { CapabilityId, Category } from '../domain/types'
import { rx } from '../domain/text'
import { ANALYSIS_VERSION } from './policy'

export interface AnalysisRule {
  id: string
  /** Short German reason shown to the user when the rule fires. */
  label: string
  category: Category
  strength: 1 | 2 | 3
  pattern: RegExp
  exclude?: RegExp
  /**
   * Match against text that still contains negated clauses. Needed where the negation is the
   * signal itself ("startet nicht", "doesn't compile"); every other rule ignores negated clauses.
   */
  includeNegated?: boolean
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

/** Window between a verb and its object, within one clause. A dot inside a word ("Next.js", "data.csv") does not end it. */
const near = (max: number) => `(?:[^.!?\\n]|\\.(?=\\w)){0,${max}}`

const WRITING_ARTIFACTS = String.raw`gedicht\w*|poem\w*|text\w*|brief\w*|letter|e.?mail\w*|essay\w*|aufsatz|artikel|article|story|stories|geschichte\w*|bewerbung\w*|anschreiben|cover letter|lebenslauf|blog\w*|beitrag|posts?|posting|linkedin|tweet\w*|caption|rede|speech|slogans?|mottos?|einladung\w*|invitation|bericht\w*|report|zusammenfassung|summary|absage\w*|zusage|kündigung\w*|beschwerde\w*|entschuldigung\w*|glückwunsch\w*|danksagung|newsletter|produktbeschreibung\w*|werbetext\w*|songtext\w*|lied\w*|song\w*|präsentation\w*|presentation\w*|referat\w*|vortrag\w*|handout\w*`
const EDITABLE = String.raw`${WRITING_ARTIFACTS}|absatz|absätze|paragraph\w*|satz|sätze|sentence\w*|formulierung\w*|wording|cv|resume|rechtschreibung|spelling|grammati\w*`
const DOCUMENTS = String.raw`präsentation\w*|presentation\w*|folien|slides?|slide deck|vortrag\w*|referat\w*|handout\w*|arbeitsblatt\w*|worksheet\w*|gliederung\w*|outline|protokoll\w*|flyer\w*|plakat\w*|poster\w*|broschüre\w*|brochure`
/** Things you build or fix in software. Whole words only: "script" must not match inside "description". */
const CODE_TARGETS = String.raw`\b(?:react(?:\.?js)?|typescript|javascript|python|code|funktion(?:en)?|functions?|apps?|projekts?|projects?|komponente\w*|components?|parser|skript\w*|scripts?|klassen?|class(?:es)?|methoden?|methods?|algorithm\w*|regex|sql|query|queries|abfrage\w*|endpoints?|unit[- ]?tests?|api|datenbank\w*|databases?|backend|frontend|websites?|webseite\w*|server\w*|css|html|bash|shell|docker\w*|kubernetes|git|commits?)\b`
const TECH = String.raw`\b(?:react(?:\.?js)?|typescript|javascript|python|java|kotlin|rust|golang|php|ruby|node(?:\.?js)?|next\.?js|vue|angular|repository|repositories|codebase|software|frontend|backend|code|api|jest|vitest|pytest|git|docker\w*|kubernetes|html|css|postgres\w*|mysql|mongodb|sql|npm)\b|\bc(?:\+\+|#)`
export const FRESH = String.raw`aktuell(?:e|en|er|es)?|neueste(?:n|r|s)?|heut(?:e|ig\w*)|gestern|derzeit\w*|momentan\w*|zurzeit|kürzlich|dieses jahr|diese woche|diesen monat|latest|up.to.date|current(?:ly)?|right now|yesterday|today|this (?:year|week|month)|recent(?:ly)?`

/**
 * Strength 3 = unambiguous signature, 2 = contextual combination, 1 = supporting word.
 * Every rule counts at most once. Patterns run on the instruction view: quoted text, code blocks,
 * material after "Übersetze/Verbessere …:" and negated clauses are blanked out, so they never drive
 * the classification. Write \b as usual: rx() makes it Unicode-aware ("für", "prüfe").
 * Patterns must not use the g or y flag (validateAnalyzerConfig enforces it): stateful regexes
 * would make the analysis depend on previous calls.
 */
export const ANALYSIS_RULES: readonly AnalysisRule[] = [
  { id: 'coding-action', label: 'Programmier-Auftrag', category: 'coding', strength: 3,
    pattern: rx(String.raw`\b(?:baue|erstelle|entwickle|implementiere|programmiere|schreib(?:e|en)?|build|create|implement|develop|write|code|setze|integriere|integrate|füge|add|erweitere|extend|optimiere|optimi[sz]e|konvertiere|convert|portiere|port|verbinde|connect|konfiguriere|configure|deploye?|deploy)\b${near(90)}(?:${CODE_TARGETS})`),
    exclude: rx(String.raw`\b(?:write|schreibe|verfasse|erstelle|create)\s+(?:(?:an?|ein(?:e|en)?)\s+)?(?:[\p{L}-]+\s+)?(?:poem|gedicht|email|e.mail|letter|brief|article|artikel|story|geschichte|essay|aufsatz|text|${DOCUMENTS})\b`) },
  { id: 'coding-help', label: 'Frage zur Umsetzung im Code', category: 'coding', strength: 3,
    pattern: rx(String.raw`\b(?:hilf mir|help me|kannst du mir helfen|can you help(?: me)?|wie kann ich|wie mache ich|how (?:do|can|should) i|how to)\b${near(70)}(?:${CODE_TARGETS})`) },
  { id: 'coding-debug', label: 'Fehlerbeschreibung im Code', category: 'coding', strength: 3, includeNegated: true,
    pattern: rx(String.raw`(?:${CODE_TARGETS}|${TECH}|\b(?:programm\w*|programs?|container)\b)${near(50)}\b(?:funktioniert nicht|läuft nicht|startet nicht|kompiliert nicht|lädt nicht|stürzt ab|wirft|schlägt fehl|throws?|crash\w*|fails?|failing|failed|broken|doesn'?t (?:work|run|start|compile|load)|does not (?:work|run|start|compile|load)|not working|won'?t (?:work|run|start|compile|load)|render\w* (?:twice|two times)|rendert? zweimal)\b`
      // Verb first: "Warum funktioniert mein Skript nicht?", "Why doesn't my app start?"
      + String.raw`|\b(?:funktioniert|läuft|startet|kompiliert|lädt)\b${near(50)}(?:${CODE_TARGETS}|\bprogramm\w*)${near(20)}\bnicht\b`
      + String.raw`|\b(?:doesn'?t|does not|won'?t|isn'?t|is not)\b${near(40)}(?:${CODE_TARGETS}|\bprograms?\b)${near(20)}\b(?:work|run|start|compile|load)\b`) },
  { id: 'coding-repair', label: 'Fehlersuche oder Umbau im Code', category: 'coding', strength: 3,
    pattern: rx(String.raw`\bdebug\w*|\brefactor\w*|\bmigriere|\bmigrate|\b(?:behebe|repariere|fix)\b${near(60)}(?:bug|fehler|error|exception|crash|code)|\b(?:upgrade|update|aktualisiere)\b${near(40)}(?:react|\bapp\b|dependenc|abhängigkeit|packages?|pakete|framework|library|bibliothek|node)`) },
  { id: 'coding-review', label: 'Code-Review', category: 'coding', strength: 3,
    pattern: rx(String.raw`\b(?:review|reviewe|prüfe|überprüfe|check|audit)\b${near(40)}(?:pull request|\bpr\b|merge request|\bcode\b|commit|\bdiff\b)`) },
  { id: 'coding-request', label: 'Wunsch nach Code', category: 'coding', strength: 3,
    pattern: rx(String.raw`\b(?:brauche|need|want|möchte|suche|looking for)\b${near(30)}(?:regex|skript|script|funktion|function|\bsql\b|query|programm|program\b|\bapp\b)`) },
  // Case-sensitive on purpose: "KeyError" is a signal, "terror" is not.
  { id: 'coding-error', label: 'Fehlermeldung aus der Programmierung', category: 'coding', strength: 2,
    pattern: rx(String.raw`\b[A-Z][A-Za-z]*(?:Error|Exception)\b|Traceback|Segmentation fault|[Ss]tack ?[Tt]race|npm ERR!|\bE(?:ACCES|NOENT|ADDRINUSE|CONNREFUSED|PERM)\b|[Ee]xit code \d+|Cannot find module`, 'u') },
  { id: 'coding-artifact', label: 'Technischer Begriff', category: 'coding', strength: 2,
    pattern: rx(String.raw`\bregex\b|regulären? ausdruck|\bsql\b|pull request|\bnpm\b|\bgit\b|\bdocker\w*|\bkubernetes\b|\bjest\b|\bpytest\b`) },
  { id: 'coding-context', label: 'Software-Kontext', category: 'coding', strength: 1,
    pattern: rx(TECH) },

  // A minus sign alone is no evidence: dates (2026-10-02), ranges (10-12 Uhr) and versions (18 - 19) use it.
  // The lookbehind also keeps the scan linear: without it every digit of a long number is a new start.
  { id: 'math-expression', label: 'Rechenausdruck', category: 'math', strength: 3,
    pattern: rx(String.raw`(?<![\d.,/:-])\d+(?:[.,]\d+)?\s*[+*/×÷^]\s*\d+(?:[.,]\d+)?(?![\d/:])`, 'u') },
  { id: 'math-question', label: 'Rechenfrage', category: 'math', strength: 3,
    pattern: rx(String.raw`\b(?:was ist|what is|what's|wie ?viel (?:ist|sind|ergibt|ergeben)|how much is|berechne|calculate|compute|rechne)\s*-?\d+(?:[.,]\d+)?\s*[-+*/×÷^]\s*-?\d`) },
  { id: 'math-percent', label: 'Prozentrechnung', category: 'math', strength: 3,
    pattern: rx(String.raw`(?<![\d.,])\d+(?:[.,]\d+)?\s*(?:%|prozent\b|percent\b)\s*(?:von|of|aus)\s*-?\d`) },
  { id: 'math-bare', label: 'Reiner Rechenausdruck', category: 'math', strength: 3,
    pattern: rx(String.raw`^\s*-?\d+(?:[.,]\d+)?(?:\s*[-+*/×÷^]\s*-?\d+(?:[.,]\d+)?)+\s*[=?]?\s*$`, 'u') },
  { id: 'math-equation', label: 'Gleichung mit Variable', category: 'math', strength: 3,
    pattern: rx(String.raw`(?<![\p{L}\d])\d*[a-z](?![\p{L}])(?:\s*\^\s*\d+|[²³])?\s*[-+*/]\s*[^=\n]{0,40}=\s*-?\d+`) },
  { id: 'math-action', label: 'Mathematischer Auftrag', category: 'math', strength: 3,
    pattern: rx(String.raw`\b(?:berechne|beweise|integriere|differenziere|calculate|prove|integrate|differentiate|(?:solve|löse)\b${near(45)}(?:equation\w*|gleichung\w*|integral\w*|system\w*)|rechne\b${near(30)}\baus\b)`) },
  { id: 'math-quantity', label: 'Gesuchte mathematische Größe', category: 'math', strength: 3,
    pattern: rx(String.raw`\b(?:was ist|what is|what's|wie groß ist|wie hoch ist|berechne|calculate|compute|find|finde|bestimme|determine)\s+(?:the |die |den |das )?(?:derivative|ableitung|integral|limit|grenzwert|area|fläche\w*|volume|volumen|umfang|perimeter|wahrscheinlichkeit|probability|nullstellen?|roots?|steigung|slope)\b`) },
  { id: 'math-domain', label: 'Mathematischer Fachbegriff', category: 'math', strength: 2,
    pattern: rx(String.raw`gleichung|integral|mathemati|theorem|\bsatz von|eigenwert|eigenvalue|algebra|konvergenz|convergence|wahrscheinlichkeit|probability|ableitung|derivative|matrix|matrizen`) },

  { id: 'research-action', label: 'Rechercheauftrag', category: 'research', strength: 3,
    pattern: rx(String.raw`recherchier|\bresearch\b|\blook up\b|fact.?check|faktencheck|\b(?:find|finde|such(?:e)?)\b${near(50)}(?:latest|current|recent|sources|studies|papers|quellen|studien|aktuell)`) },
  { id: 'research-question', label: 'Frage nach aktuellen Fakten', category: 'research', strength: 3,
    pattern: rx(String.raw`(?:^|[.!?]\s+)(?:wer|was|welche[rsn]?|wie (?:viel|hoch|steht|teuer)|wann|who|what|which|how (?:much|high)|when)\b${near(60)}\b(?:${FRESH})\b`) },
  { id: 'research-freshness', label: 'Bedarf an aktuellen Informationen', category: 'research', strength: 2,
    pattern: rx(String.raw`\b(?:${FRESH})\b`) },
  { id: 'research-news', label: 'Nachrichtenbezug', category: 'research', strength: 2,
    pattern: rx(String.raw`\b(?:news|nachrichten|neuigkeiten|schlagzeilen|headlines)\b`) },
  { id: 'research-sources', label: 'Quellenbezug', category: 'research', strength: 1,
    pattern: rx(String.raw`quellen|\bsources\b|\bbelege|citations|nachweise`) },

  { id: 'writing-action', label: 'Schreib- oder Überarbeitungsauftrag', category: 'writing', strength: 3,
    pattern: rx(String.raw`\b(?:verbessere|überarbeite|redigiere|korrigiere|lektoriere|kürze|vereinfache|improve|rewrite|edit|proofread|shorten|simplify|polish)\b${near(55)}\b(?:${EDITABLE})\b|\b(?:schreib(?:e|en)?|write|verfasse|draft|compose|formuliere)\b${near(30)}\b(?:${WRITING_ARTIFACTS})\b|\b(?:${WRITING_ARTIFACTS})\b${near(40)}zu (?:schreiben|verfassen|formulieren)`) },
  { id: 'writing-summary', label: 'Zusammenfassen, Übersetzen oder Umformulieren', category: 'writing', strength: 3,
    pattern: rx(String.raw`\bfasse\b${near(50)}zusammen|summari[sz]e|übersetze|\btranslate|paraphrase|umformulier|rephrase|tl;?dr`) },
  { id: 'writing-request', label: 'Wunsch nach einem Text', category: 'writing', strength: 3,
    pattern: rx(String.raw`\b(?:brauche|need|want|möchte|hätte gern|suche)\b${near(30)}\b(?:${WRITING_ARTIFACTS})\b`) },
  { id: 'writing-ideas', label: 'Ideensammlung', category: 'writing', strength: 3,
    pattern: rx(String.raw`\b(?:ideen|ideas|vorschläge|suggestions|namen|names|titel|titles|mottos?|slogans?)\s+(?:für|for|zu|about|on)\b|\b(?:sammle|brainstorm\w*|gib mir|give me|nenne mir|suggest|schlag\w* vor)\b${near(30)}\b(?:ideen|ideas|vorschläge|namen|names|titel|titles|mottos?|slogans?)\b`) },
  { id: 'writing-document', label: 'Dokument oder Präsentation erstellen', category: 'writing', strength: 3,
    pattern: rx(String.raw`\b(?:erstelle|create|mach(?:e)?|make|entwirf|design|gestalte|bereite|prepare)\b${near(30)}\b(?:${DOCUMENTS})\b`) },

  { id: 'learning-action', label: 'Erklärwunsch', category: 'learning', strength: 3,
    pattern: rx(String.raw`erkläre|erklären|bring mir|teach me|\bexplain|eli5|walk me through|quiz me|frag mich ab|\b(?:help me|hilf mir)\s+(?:to\s+)?(?:understand|verstehen)`) },
  // Concept questions ("Wie funktioniert …?", "What is a …?"); fact questions ("What is the capital …?") stay general.
  { id: 'learning-question', label: 'Verständnisfrage', category: 'learning', strength: 3,
    pattern: rx(String.raw`(?:^|[.!?]\s+)(?:wie funktionier(?:t|en)|warum|wieso|weshalb|was (?:ist|sind) (?:ein|eine|einen)\b|how (?:does|do)\b[^?\n]{0,60}\bwork|why (?:does|do|is|are)\b|what (?:is|are) (?:a|an)\b)`),
    exclude: rx(String.raw`\b(?:mein|meine|meinem|meinen|meiner|my|our|unser\w*)\b${near(25)}(?:${CODE_TARGETS}|\bprogramm\w*)`) },
  { id: 'learning-meaning', label: 'Begriffs- oder Unterschiedsfrage', category: 'learning', strength: 3,
    pattern: rx(String.raw`\bwas bedeute[tn]|\bwhat does\b${near(60)}\bmean\b|\bmeaning of\b|\bbedeutung (?:von|des|der)\b|\bdefiniere\b|\bdefine\b|\bdefinition (?:of|von)\b|\bunterschied\w* zwischen\b|\bdifferences? between\b|\bwas unterscheidet\b`) },
  { id: 'learning-context', label: 'Lernkontext', category: 'learning', strength: 1,
    pattern: rx(String.raw`verstehen|understand|anfänger|beginner|\blernen|learning`) },

  { id: 'data-action', label: 'Datenauswertung', category: 'dataAnalysis', strength: 3,
    pattern: rx(String.raw`\b(?:analysiere|werte|analyze|analyse|inspect)\b${near(75)}(?:datei|file|csv|xlsx|tabelle|table|daten|data|sentiment|stimmung|umfrage|survey|reviews|rezensionen|\blogs?\b|metriken|metrics|kennzahlen|zahlen|numbers)|\b(?:daten|data|csv|xlsx)\b${near(60)}(?:analys|auswert|clean|bereinig)`) },
  { id: 'data-pattern', label: 'Suche nach Mustern in Daten', category: 'dataAnalysis', strength: 3,
    pattern: rx(String.raw`\b(?:welche|what|which|erkenne|identify|find|finde|zeige|show|spot)\b${near(30)}\b(?:trends?|muster|patterns?|ausreißer|outliers?|auffälligkeiten|anomal\w*)\b|\b(?:korrelation|correlation|regression)\b${near(60)}\b(?:datensatz|dataset|daten|data|tabelle|table|spreadsheet|excel|csv)\b`) },
  { id: 'data-context', label: 'Datenkontext', category: 'dataAnalysis', strength: 1,
    pattern: rx(String.raw`datensatz|dataset|statisti|\bcsv\b|xlsx|spreadsheet|pandas|excel|korrelation|correlation|regression|median|verkaufszahlen|umsatz\w*|umsätze|sales figures|revenue`) },

  { id: 'reasoning-action', label: 'Abwägen oder Entscheiden', category: 'reasoning', strength: 3,
    pattern: rx(String.raw`abwäg|\bwäge\b${near(40)}\bab\b|vergleiche|bewerte|entscheide|überlege|\bcompare|\bevaluate|\bdecide|reason through|\bweigh`) },
  { id: 'reasoning-question', label: 'Entscheidungsfrage', category: 'reasoning', strength: 3,
    pattern: rx(String.raw`(?:^|[.!?]\s+)(?:soll(?:te)? ich|should i\b|lohnt (?:es )?sich|is it worth)|pros? (?:and|&) cons?|vor- und nachteile|vorteile und nachteile|\b(?:which|what|was|welche[rsn]?|wer)\s+(?:is|ist|wäre|would be)\s+(?:better|besser|the best choice|die bessere wahl)\b`) },

  { id: 'planning-action', label: 'Planungsauftrag', category: 'planning', strength: 3,
    pattern: rx(String.raw`(?:^|[.!?]\s+|\b(?:bitte|please)\s+)(?:plane|plan|organisiere|organi[sz]e)\s+(?:ein|eine|einen|meine?n?|unsere?n?|a|an|my|our|the)\b|\b(?:help me|hilf mir|let'?s|lass uns)\s+(?:to\s+)?(?:plan|planen|plane|organi[sz]e|organisieren)\b|\b(?:erstelle|create|make|build|entwirf|draft|mach(?:e)?)\b${near(40)}\b(?:plan|pläne|plans|zeitplan|reiseplan|lernplan|trainingsplan|essensplan|speiseplan|wochenplan|meal plan|strategie|strategy|roadmap|konzept|concept|zeitplan|schedule|itinerary|agenda|checkliste|checklist)\b`) },
  { id: 'planning-context', label: 'Planungskontext', category: 'planning', strength: 1,
    pattern: rx(String.raw`\b(?:reise|trip|urlaub|vacation|meilenstein\w*|milestones?|deadline|budget|party|feier|geburtstag\w*|birthday|ausflug|event|veranstaltung|hochzeit|wedding)\b`) },
]

export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  version: ANALYSIS_VERSION,
  rules: ANALYSIS_RULES,
  categoryThreshold: 3,
  ambiguityMargin: 2,
  fallback: { reasoning: 2, writing: 2 },
}
