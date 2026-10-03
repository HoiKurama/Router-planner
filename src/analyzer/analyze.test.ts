import { describe, expect, it } from 'vitest'
import { analyzePrompt, deriveRequirements, validateInput } from './analyze'

const analyze = (text: string) => analyzePrompt({ text, revision: 1 })

describe('task analysis', () => {
  it.each([
    ['Berechne 2 + 2.', 'math'], ['Calculate 2 + 2.', 'math'],
    ['Baue eine React-App mit TypeScript.', 'coding'], ['Build a React app with TypeScript.', 'coding'],
    ['Verbessere diesen Text: "Hallo!"', 'writing'], ['Improve this text: "Hello!"', 'writing'],
    ['Recherchiere aktuelle Informationen mit Quellen.', 'research'], ['Research the latest information with sources.', 'research'],
    ['Erkläre mir die Photosynthese.', 'learning'], ['Explain photosynthesis to me.', 'learning'],
    ['Analysiere meine CSV-Datei.', 'dataAnalysis'], ['Analyze my CSV file.', 'dataAnalysis'],
    ['Vergleiche die Optionen und bewerte die Risiken.', 'reasoning'], ['Compare the options and evaluate the risks.', 'reasoning'],
  ])('classifies %s', (text, category) => expect(analyze(text).primaryCategory).toBe(category))

  it('does not force an unknown task into reasoning', () => {
    const result = analyze('???')
    expect(result.primaryCategory).toBeNull()
    expect(result.complexity.value).toBeNull()
    expect(result.confidence).toBe('unknown')
  })
  it('does not treat prompt length as difficulty', () => {
    expect(analyze('Schreibe einen freundlichen Brief. ' + 'Ein Kontextsatz. '.repeat(800)).complexity.value).toBe(2)
    expect(analyze('Berechne 2 + 2.').complexity.value).toBe(1)
  })
  it('finds complex dependent coding work', () => {
    const result = analyze('Migriere die gesamte Codebase. Zuerst analysiere die Abhängigkeiten, dann implementiere die Migration mit Tests und API-Kompatibilität.')
    expect(result.complexity.value).toBe(5)
    expect(result.multiStep).toBe('yes')
    expect(deriveRequirements(result).requiredTools).toContain('codeExecution')
  })
  it('does not elevate keyword repetition', () => {
    expect(analyze('Build a React app.').categoryScores).toEqual(analyze('Build a React app. React React React React').categoryScores)
  })
  it('treats quoted instructions as context', () => {
    const result = analyze('Verbessere diesen Text: "Build a React app. Research current news."')
    expect(result.primaryCategory).toBe('writing')
    expect(result.researchNeeded).toBe('no')
  })
  it('ignores a negated coding instruction', () => {
    expect(analyze('Do not write code. Improve this text: "Hello"').primaryCategory).toBe('writing')
  })
  it('does not match keywords inside other words', () => {
    expect(analyze('Improve this paragraph: "Hi"').complexity.value).toBe(2)
    const concurrent = analyze('Implement a concurrent queue in TypeScript.')
    expect(concurrent.needsCurrentInformation).toBe(false)
    expect(concurrent.categoryScores.research).toBeUndefined()
  })
  it('prefers the task named first when scores tie', () => {
    expect(analyze('Beweise den Satz und erkläre, warum er gilt.').primaryCategory).toBe('math')
    expect(analyze('Erkläre, warum der Satz gilt, und beweise ihn.').primaryCategory).toBe('learning')
  })
  it('preserves accurate evidence offsets', () => {
    const text = '🧠\nBuild a React app.'
    const result = analyze(text)
    const evidence = result.evidence.find((e) => e.ruleId === 'coding-action')!
    expect(text.slice(evidence.start, evidence.end)).toBe('Build a React app')
  })
  it('detects freshness and no-web conflict', () => {
    expect(analyze('Recherchiere aktuelle Nachrichten ohne Websuche.').issues.some((i) => i.critical)).toBe(true)
  })
  it('keeps product offline requirements out of provider restrictions', () => {
    const result = analyze('Baue eine offlinefähige React-App. Speichere alle Daten lokal.')
    expect(result.issues.some((i) => i.id === 'unresolved-execution-constraint')).toBe(false)
  })
  it('does not pretend a referenced file was read', () => {
    const result = analyze('Analysiere meine CSV-Datei.')
    expect(result.fileAccessNeeded).toBe('yes')
    expect(result.issues.some((i) => i.id === 'missing-file')).toBe(true)
  })
  it('keeps exact constraints in the analysis', () => {
    const result = analyze('Baue eine React-App.\nNutze keine APIs und behalte Port 5173.')
    expect(result.constraints[0].value).toBe('Nutze keine APIs und behalte Port 5173.')
  })
  it('validates empty and Unicode boundary inputs without truncation', () => {
    expect(validateInput(' \n\t')).not.toBeNull()
    expect(validateInput('🧠'.repeat(20_000))).toBeNull()
    expect(validateInput('🧠'.repeat(20_001))).not.toBeNull()
    expect(() => analyze('')).toThrow()
  })
})
