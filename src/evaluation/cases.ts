import { EXAMPLES } from '../data/examples'
import type { Category, PriorityMode } from '../domain/types'

export interface EvaluationCase {
  id: string
  text: string
  category: Category | null
  complexity: [number, number] | null
  /** Option ids ("family/setting") a human reviewer accepts for each mode. */
  accepted: Record<PriorityMode, readonly string[]>
  abstain?: boolean
}

/** Hand-labelled baselines. Changes require reviewing policy, models.json and case meaning. */
export const BASELINE = { analysis: 'rules-v3', catalog: '2026-10-04', policy: 'routing-v3' }

// Light everyday answers: the lightest setting per allowance that clears a low bar.
const LIGHT = ['claude-sonnet-5-5/low', 'gpt-5-6-sol-chat/instant', 'gpt-5-6-sol-chat/medium', 'gpt-6-luna/medium']
const TOP_GENERAL = ['claude-opus-5-5/max']
const TOP_CODING = ['claude-sonnet-5-5/max']
const same = (options: readonly string[], best = TOP_GENERAL) => ({ fast: options, balanced: options, best })

const expectations: Omit<EvaluationCase, 'id' | 'text'>[] = [
  // Arithmetic: Haiku is enough; nothing heavier than Sonnet Low.
  { category: 'math', complexity: [1, 1], accepted: same(['claude-haiku-4-5/extended', 'gpt-5-6-sol-chat/instant', 'gpt-6-luna/low']) },
  // A proof needs close to the best maths score: Sonnet at the top effort or Opus at a medium one.
  { category: 'math', complexity: [4, 4], accepted: {
    fast: ['claude-sonnet-5-5/xhigh', 'claude-opus-5-5/low', 'gpt-6-1-sol/low'],
    balanced: ['claude-sonnet-5-5/max', 'claude-opus-5-5/medium'], best: TOP_GENERAL } },
  // A React project with files and tests belongs in an agent workspace at medium effort.
  { category: 'coding', complexity: [3, 3], accepted: { ...same(['gpt-6-1-sol/medium', 'gpt-6-astra/low', 'claude-sonnet-5-5/high'], TOP_CODING) } },
  { category: 'writing', complexity: [2, 2], accepted: same(LIGHT) },
  { category: 'research', complexity: [2, 2], accepted: same(LIGHT) },
  { category: 'dataAnalysis', complexity: [2, 2], accepted: same(['gpt-6-luna/medium', 'gpt-6-1-sol/low', 'claude-sonnet-5-5/low']) },
  // Migrating a whole codebase justifies the strongest coding settings.
  { category: 'coding', complexity: [5, 5], accepted: {
    fast: ['gpt-6-1-sol/high', 'claude-sonnet-5-5/xhigh', 'claude-opus-5-5/medium'],
    balanced: ['claude-sonnet-5-5/max', 'claude-opus-5-5/xhigh'], best: TOP_CODING } },
]
const englishPrompts = [
  'Calculate 17 * 24.',
  'Prove that every continuous function on a compact interval is uniformly continuous. Do not use calculus. Verify the assumptions and explain why compactness is necessary.',
  'Build a React project with TypeScript for a local task list. Users should create, edit and complete tasks. Store tasks in the browser. The interface must be responsive. Add tests for the main interactions.',
  'Improve this text for a friendly professional email. Keep all facts and the time:\n\n"Hello, I will arrive at 10:30 tomorrow. The train is cancelled. Can we move the meeting?"',
  'Research the latest developments in renewable energy in Germany. Compare current figures with the previous year. Use reliable sources and state the date of the data.',
  'Analyze my CSV file with monthly revenue. Identify trends, missing values and outliers. Keep the original data unchanged and provide a brief summary with verifiable metrics.',
  'Migrate the entire codebase of a TypeScript project to a new data access layer. First analyze the dependencies, then implement the migration. Preserve API compatibility, add integration tests and document a rollback. Do not change public interfaces.',
]
const none = { fast: [], balanced: [], best: [] }

export const EVALUATION_CASES: EvaluationCase[] = [
  ...EXAMPLES.map((example, i) => ({ id: `de-${example.id}`, text: example.text, ...expectations[i] })),
  ...englishPrompts.map((text, i) => ({ id: `en-${EXAMPLES[i].id}`, text, ...expectations[i] })),
  { id: 'unknown', text: '???', category: null, complexity: null, accepted: none, abstain: true },
  { id: 'web-conflict', text: 'Recherchiere aktuelle Informationen ohne Websuche.', category: 'research', complexity: [2, 2], accepted: none, abstain: true },
  { id: 'poem-python', text: 'Write a poem about Python in a friendly tone.', category: 'writing', complexity: [2, 2], accepted: same(LIGHT) },
  { id: 'quoted-code', text: 'Improve this text in a professional tone: "Build a React app. Research the latest news."', category: 'writing', complexity: [2, 2], accepted: same(LIGHT) },
  { id: 'de-function', text: 'Schreibe eine Funktion in Python, die Primzahlen findet.', category: 'coding', complexity: [2, 2], accepted: same(['claude-sonnet-5-5/medium', 'claude-opus-5-5/low', 'gpt-6-1-sol/low'], TOP_CODING) },
  { id: 'en-news', text: 'What are the latest news about the EU AI Act?', category: 'research', complexity: [2, 2], accepted: same(LIGHT) },
  { id: 'de-poem', text: 'Ich brauche ein Gedicht über den Herbst.', category: 'writing', complexity: [2, 2], accepted: same(LIGHT) },
  { id: 'en-trip', text: 'Plan a 3-day trip to Rome.', category: 'planning', complexity: [2, 2], accepted: same(LIGHT) },
  { id: 'de-concept', text: 'Wie funktioniert ein Transformator?', category: 'learning', complexity: [2, 2], accepted: same(LIGHT) },
  { id: 'en-fallback', text: 'What is the capital of France?', category: null, complexity: null, accepted: same(LIGHT) },
]
