import { MAX_PROMPT_CODEPOINTS } from '../data/policy'
import type { Category, OptimizedPrompt, PromptInput, ProviderId, TaskAnalysis } from '../domain/types'
import { checkPreservation, isStructured, MIN_STRUCTURE_LENGTH, render } from './optimize'

export type VariantId = 'claude' | 'neutral' | 'chatgpt'
export const VARIANT_IDS: readonly VariantId[] = ['claude', 'neutral', 'chatgpt']

export interface PromptVariant extends OptimizedPrompt {
  id: VariantId
  label: string
  target: string
  provider: ProviderId | null
}

const META: Record<VariantId, Pick<PromptVariant, 'label' | 'target' | 'provider'>> = {
  claude: { label: 'Variante 1 · Claude', provider: 'anthropic', target: 'XML-Tags trennen Aufgabe und Antwort-Hinweise, wie Anthropic es empfiehlt.' },
  neutral: { label: 'Variante 2 · Neutral', provider: null, target: 'Für jedes Modell: höchstens eine Überschrift, sonst dein Original.' },
  chatgpt: { label: 'Variante 3 · ChatGPT', provider: 'openai', target: 'Markdown-Abschnitte für Aufgabe und Ausgabeformat, wie OpenAI es empfiehlt.' },
}

/** One safe, generic line per category. They describe how to answer and never add facts or requirements. */
const CATEGORY_LINES: Record<Category, { de: string; en: string }> = {
  coding: { de: 'Nenne deine Annahmen und wie man die Lösung prüfen kann.', en: 'State your assumptions and how to verify the solution.' },
  math: { de: 'Rechne nachvollziehbar Schritt für Schritt und prüfe das Ergebnis.', en: 'Work step by step and check the result.' },
  research: { de: 'Nenne Quellen mit Datum und kennzeichne, was unsicher ist.', en: 'Cite sources with dates and flag anything uncertain.' },
  writing: { de: 'Gib zuerst den fertigen Text aus.', en: 'Give the finished text first.' },
  learning: { de: 'Erkläre Schritt für Schritt und mit einem Beispiel.', en: 'Explain step by step with an example.' },
  dataAnalysis: { de: 'Zeige, wie jede Kennzahl berechnet wurde.', en: 'Show how each metric was calculated.' },
  reasoning: { de: 'Wäge die Möglichkeiten ab und schließe mit einer klaren Empfehlung.', en: 'Weigh the options and end with a clear recommendation.' },
  planning: { de: 'Gliedere den Plan in nummerierte Schritte.', en: 'Structure the plan as numbered steps.' },
}

function guidance(analysis: TaskAnalysis, english: boolean): string[] {
  const lines: string[] = []
  if (analysis.language === 'de') lines.push('Antworte auf Deutsch.')
  if (analysis.language === 'en') lines.push('Answer in English.')
  lines.push(english ? 'If important details are missing, ask before assuming them.' : 'Wenn wichtige Angaben fehlen, frage nach, statt sie anzunehmen.')
  if (analysis.primaryCategory) lines.push(CATEGORY_LINES[analysis.primaryCategory][english ? 'en' : 'de'])
  return lines
}

/** Text before and after the untouched original. Falls back to the original when the result fails the preservation check. */
function frame(input: PromptInput, id: VariantId, prefix: string, suffix: string, reason: string): PromptVariant {
  const insertions = [
    ...(prefix ? [{ offset: 0, text: prefix, reason }] : []),
    ...(suffix ? [{ offset: input.text.length, text: suffix, reason }] : []),
  ]
  const rendered = render(input.text, insertions)
  const variant: PromptVariant = {
    id, ...META[id], sourceRevision: input.revision, sourceParts: [{ start: 0, end: input.text.length }],
    insertions, rendered, suggestions: [], preservationPassed: true, changed: insertions.length > 0,
  }
  if (Array.from(rendered).length > MAX_PROMPT_CODEPOINTS) return { ...variant, insertions: [], rendered: input.text, changed: false }
  if (!checkPreservation(input, variant)) return { ...variant, insertions: [], rendered: input.text, changed: false, preservationPassed: false }
  return variant
}

/**
 * Three ways to send the same prompt. The original text always stays verbatim and in one piece;
 * variants only add a frame around it. Short or unrecognized prompts stay unchanged.
 */
export function buildVariants(input: PromptInput, analysis: TaskAnalysis, neutral: OptimizedPrompt): PromptVariant[] {
  const neutralVariant: PromptVariant = { ...neutral, id: 'neutral', ...META.neutral }
  const worthFraming = (analysis.primaryCategory !== null || analysis.fallback) && input.text.trim().length >= MIN_STRUCTURE_LENGTH
  if (!worthFraming) return [frame(input, 'claude', '', '', ''), neutralVariant, frame(input, 'chatgpt', '', '', '')]

  const english = analysis.language === 'en'
  const lines = guidance(analysis, english)
  const [task, answer] = english ? ['task', 'output'] : ['aufgabe', 'ausgabe']
  const claude = /<\/?(?:aufgabe|task)>/iu.test(input.text)
    ? frame(input, 'claude', '', '', '')
    : frame(input, 'claude', `<${task}>\n`, `\n</${task}>\n\n<${answer}>\n${lines.map((line) => `- ${line}`).join('\n')}\n</${answer}>`,
      'Claude-Variante: Die Aufgabe steht in eigenen XML-Tags, Antwort-Hinweise getrennt davon.')
  const heading = english ? '# Task\n\n' : '# Aufgabe\n\n'
  const formatHeading = english ? '# Output format' : '# Ausgabeformat'
  const hasFormat = /(?:^|\n)\s*#{1,6}\s*(?:ausgabeformat|output format)/iu.test(input.text)
  const chatgpt = frame(input, 'chatgpt', isStructured(input.text) ? '' : heading,
    hasFormat ? '' : `\n\n${formatHeading}\n${lines.map((line) => `- ${line}`).join('\n')}`,
    'ChatGPT-Variante: Markdown-Überschriften trennen Aufgabe und Ausgabeformat.')
  return [claude, neutralVariant, chatgpt]
}
