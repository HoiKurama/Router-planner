import { describe, expect, it } from 'vitest'
import { analyzePrompt } from '../analyzer/analyze'
import { checkPreservation, optimizePrompt } from './optimize'
import { buildVariants } from './variants'

const variants = (text: string) => {
  const input = { text, revision: 1 }
  const analysis = analyzePrompt(input)
  const neutral = optimizePrompt(input, analysis)
  const [claude, middle, chatgpt] = buildVariants(input, analysis, neutral)
  return { input, neutral, claude, middle, chatgpt }
}
const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1

describe('prompt variants', () => {
  it.each([
    'Verbessere diesen Text für eine freundliche E-Mail:\n\n"Hallo, ich komme um 10:30 Uhr."',
    'Erkläre diesen Code unverändert:\n```ts\nconst value = 42 // </aufgabe>\n```',
    'Build a React app with TypeScript and tests for the main flows.',
    'Recherchiere die neuesten Zahlen zur Energiewende mit Quellen. 🧠 Äpfel\r\nund Bücher',
  ])('keeps the original verbatim and in one piece in every variant: %s', (text) => {
    const { input, claude, middle, chatgpt } = variants(text)
    for (const variant of [claude, middle, chatgpt]) {
      expect(occurrences(variant.rendered, text), variant.id).toBe(1)
      expect(checkPreservation(input, variant), variant.id).toBe(true)
    }
  })

  it('frames the task in XML tags for Claude and in Markdown sections for ChatGPT', () => {
    const text = 'Schreibe ein Gedicht über den Herbst in einem ruhigen Ton.'
    const { claude, middle, chatgpt, neutral } = variants(text)
    expect(claude.rendered).toBe(`<aufgabe>\n${text}\n</aufgabe>\n\n<ausgabe>\n- Antworte auf Deutsch.\n- Wenn wichtige Angaben fehlen, frage nach, statt sie anzunehmen.\n- Gib zuerst den fertigen Text aus.\n</ausgabe>`)
    expect(chatgpt.rendered).toBe(`# Aufgabe\n\n${text}\n\n# Ausgabeformat\n- Antworte auf Deutsch.\n- Wenn wichtige Angaben fehlen, frage nach, statt sie anzunehmen.\n- Gib zuerst den fertigen Text aus.`)
    expect(middle.rendered).toBe(neutral.rendered)
    expect([claude.provider, middle.provider, chatgpt.provider]).toEqual(['anthropic', null, 'openai'])
    expect([claude.label, middle.label, chatgpt.label]).toEqual(['Variante 1 · Claude', 'Variante 2 · Neutral', 'Variante 3 · ChatGPT'])
  })

  it('uses English tags and lines for English prompts', () => {
    const { claude, chatgpt } = variants('Explain how photosynthesis works for a beginner.')
    expect(claude.rendered).toMatch(/^<task>\n[\s\S]*\n<\/task>\n\n<output>\n- Answer in English\./)
    expect(chatgpt.rendered).toMatch(/^# Task\n\n[\s\S]*\n\n# Output format\n- Answer in English\./)
  })

  it('leaves short or unrecognized prompts unchanged', () => {
    for (const text of ['2 + 2', '???', 'Berechne 17 * 24.']) {
      const { claude, middle, chatgpt } = variants(text)
      expect([claude.rendered, middle.rendered, chatgpt.rendered], text).toEqual([text, text, text])
      expect(claude.changed || chatgpt.changed, text).toBe(false)
    }
  })

  it('does not wrap a prompt twice', () => {
    const once = variants('Schreibe ein Gedicht über den Herbst in einem ruhigen Ton.')
    const again = variants(once.claude.rendered)
    expect(again.claude.rendered).toBe(once.claude.rendered)
    const structured = variants('# Aufgabe\n\nSchreibe ein Gedicht über den Herbst.\n\n# Ausgabeformat\n- kurz')
    expect(structured.chatgpt.rendered).toBe(structured.input.text)
  })

  it('falls back to the original when a frame would exceed the input limit', () => {
    const text = 'Schreibe einen Text. ' + 'x'.repeat(20_000 - 'Schreibe einen Text. '.length)
    const { claude, chatgpt } = variants(text)
    expect(claude.rendered).toBe(text)
    expect(chatgpt.rendered).toBe(text)
  })
})
