import { MAX_PROMPT_CODEPOINTS } from '../data/policy'
import type { OptimizedPrompt, PromptInput, TaskAnalysis } from '../domain/types'

function render(text: string, insertions: OptimizedPrompt['insertions']): string {
  let cursor = 0
  let result = ''
  for (const insertion of [...insertions].sort((a, b) => a.offset - b.offset)) {
    result += text.slice(cursor, insertion.offset) + insertion.text
    cursor = insertion.offset
  }
  return result + text.slice(cursor)
}

export function checkPreservation(input: PromptInput, output: OptimizedPrompt): boolean {
  if (input.revision !== output.sourceRevision) return false
  let cursor = 0
  for (const part of output.sourceParts) {
    if (part.start !== cursor || part.end < part.start || part.end > input.text.length) return false
    cursor = part.end
  }
  if (cursor !== input.text.length) return false
  const protectedRanges = [...input.text.matchAll(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|"[^"\n]*"|„[^“\n]*“/g)]
  for (const insertion of output.insertions) {
    if (!Number.isInteger(insertion.offset) || insertion.offset < 0 || insertion.offset > input.text.length) return false
    if (protectedRanges.some((match) => insertion.offset > match.index && insertion.offset < match.index + match[0].length)) return false
  }
  return output.rendered === render(input.text, output.insertions)
}

export function optimizePrompt(input: PromptInput, analysis: TaskAnalysis): OptimizedPrompt {
  if (input.revision !== analysis.sourceRevision) throw new Error('Analyse und Prompt stammen aus unterschiedlichen Eingaben.')
  const english = analysis.language === 'en'
  const suggestions = analysis.issues.map((issue) => issue.message)
  if (analysis.primaryCategory === 'coding' && !/anforderungen|requirements|tests?|akzeptanz|acceptance/iu.test(input.text)) {
    suggestions.push(english ? 'Specify the expected behavior and acceptance criteria.' : 'Nenne das erwartete Verhalten und überprüfbare Erfolgskriterien.')
  }
  if (analysis.primaryCategory === 'writing' && !/ton|tone|zielgruppe|audience|professionell|professional|freundlich|friendly|kurz|concise/iu.test(input.text)) {
    suggestions.push(english ? 'Specify the audience and desired tone if relevant.' : 'Ergänze bei Bedarf Zielgruppe und gewünschten Ton.')
  }
  if (analysis.primaryCategory === 'learning' && !/anfänger|beginner|vorwissen|knowledge|eli5/iu.test(input.text)) {
    suggestions.push(english ? 'State your prior knowledge so the explanation can match your level.' : 'Nenne dein Vorwissen, damit die Erklärung dazu passt.')
  }
  const structured = /(?:^|\n)\s*(?:#{1,6}\s|(?:ziel|aufgabe|kontext|anforderungen|ausgabe|task|goal|context|requirements|output):)/iu.test(input.text)
  const shouldStructure = !structured && input.text.length >= 25 && analysis.primaryCategory !== null
    && (analysis.language === 'de' || analysis.language === 'en')
  let insertions: OptimizedPrompt['insertions'] = shouldStructure
    ? [{ offset: 0, text: english ? '# Task\n\n' : '# Aufgabe\n\n', reason: 'Die Aufgabe erhält eine klare Abschnittsüberschrift.' }] : []
  let rendered = render(input.text, insertions)
  if (Array.from(rendered).length > MAX_PROMPT_CODEPOINTS) { insertions = []; rendered = input.text }
  const output: OptimizedPrompt = {
    sourceRevision: input.revision, sourceParts: [{ start: 0, end: input.text.length }],
    insertions, rendered, suggestions: [...new Set(suggestions)].slice(0, 3),
    changed: insertions.length > 0, preservationPassed: true,
  }
  if (!checkPreservation(input, output)) return {
    ...output, insertions: [], rendered: input.text, changed: false, preservationPassed: false,
    suggestions: ['Die Strukturierung konnte nicht sicher geprüft werden. Das Original wurde erhalten.'],
  }
  return output
}
