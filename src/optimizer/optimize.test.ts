import { describe, expect, it } from 'vitest'
import { analyzePrompt } from '../analyzer/analyze'
import { checkPreservation, optimizePrompt } from './optimize'

const optimize = (text: string, revision = 1) => {
  const input = { text, revision }
  return { input, output: optimizePrompt(input, analyzePrompt(input)) }
}

describe('source-preserving optimizer', () => {
  it.each([
    'Baue eine React-App. Nutze keine APIs. Behalte Port 5173.',
    'Improve this text, keep 10:30 and https://example.com:\n"Hello, €12.50"',
    'Erkläre diesen Code unverändert:\n```ts\nconst value = 42\n```',
    'Verbessere diesen Text:\r\n\r\n"Äpfel 🧠\t und Bücher"',
  ])('preserves every source character: %s', (text) => {
    const { input, output } = optimize(text)
    expect(output.sourceParts.map((p) => text.slice(p.start, p.end)).join('')).toBe(text)
    expect(output.rendered).toContain(text)
    expect(checkPreservation(input, output)).toBe(true)
  })
  it('structures without inventing acceptance criteria', () => {
    const { output } = optimize('Build a React app for my project.')
    expect(output.rendered).toBe('# Task\n\nBuild a React app for my project.')
    expect(output.rendered).not.toContain('acceptance criteria')
    expect(output.suggestions.some((s) => s.includes('acceptance criteria'))).toBe(true)
  })
  it('does not duplicate structure', () => {
    const first = optimize('Baue eine React-App mit TypeScript.').output
    const second = optimize(first.rendered, 2).output
    expect(second.rendered).toBe(first.rendered)
    expect(second.changed).toBe(false)
  })
  it('leaves concise arithmetic unchanged', () => expect(optimize('2 + 2').output.rendered).toBe('2 + 2'))
  it('leaves unknown language unchanged', () => expect(optimize('???').output.rendered).toBe('???'))
  it('rejects loss, duplication and edits inside protected content', () => {
    const { input, output } = optimize('Verbessere diesen Text: "Nutze keine APIs."')
    expect(checkPreservation(input, { ...output, sourceParts: [{ start: 1, end: input.text.length }] })).toBe(false)
    expect(checkPreservation(input, { ...output, rendered: output.rendered.replace('keine', 'viele') })).toBe(false)
    expect(checkPreservation(input, { ...output, insertions: [{ offset: 26, text: 'oops', reason: '' }] })).toBe(false)
  })
  it('never exceeds the input limit by adding headings', () => {
    const text = 'Baue eine React-App. ' + 'x'.repeat(20_000 - 'Baue eine React-App. '.length)
    expect(optimize(text).output.rendered).toBe(text)
  })
  it('rejects analysis from a different revision', () => {
    expect(() => optimizePrompt({ text: '2+2', revision: 2 }, analyzePrompt({ text: '2+2', revision: 1 }))).toThrow()
  })
})
