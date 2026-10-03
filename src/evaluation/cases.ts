import { EXAMPLES } from '../data/examples'
import type { Category, PriorityMode } from '../domain/types'

export interface EvaluationCase {
  id: string
  text: string
  category: Category | null
  complexity: [number, number] | null
  accepted: Record<PriorityMode, readonly string[]>
  abstain?: boolean
}

/** Hand-labelled baselines. Changes require reviewing policy and case meaning. */
export const BASELINE = { analysis: 'rules-v2', registry: 'demo-catalog-v1', policy: 'routing-v2' }
const expectations: Omit<EvaluationCase, 'id' | 'text'>[] = [
  { category: 'math', complexity: [1, 1], accepted: { fast: ['demo-speed'], balanced: ['demo-balanced'], best: ['demo-reasoning'] } },
  { category: 'math', complexity: [4, 4], accepted: { fast: ['demo-balanced'], balanced: ['demo-balanced'], best: ['demo-reasoning'] } },
  { category: 'coding', complexity: [3, 3], accepted: { fast: ['demo-balanced'], balanced: ['demo-coding'], best: ['demo-coding'] } },
  { category: 'writing', complexity: [2, 2], accepted: { fast: ['demo-writing'], balanced: ['demo-writing'], best: ['demo-writing'] } },
  { category: 'research', complexity: [2, 2], accepted: { fast: ['demo-balanced'], balanced: ['demo-research'], best: ['demo-research'] } },
  { category: 'dataAnalysis', complexity: [2, 2], accepted: { fast: ['demo-balanced'], balanced: ['demo-data'], best: ['demo-data'] } },
  { category: 'coding', complexity: [5, 5], accepted: { fast: ['demo-coding'], balanced: ['demo-coding'], best: ['demo-coding'] } },
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

export const EVALUATION_CASES: EvaluationCase[] = [
  ...EXAMPLES.map((example, i) => ({ id: `de-${example.id}`, text: example.text, ...expectations[i] })),
  ...englishPrompts.map((text, i) => ({ id: `en-${EXAMPLES[i].id}`, text, ...expectations[i] })),
  { id: 'unknown', text: '???', category: null, complexity: null, accepted: { fast: [], balanced: [], best: [] }, abstain: true },
  { id: 'web-conflict', text: 'Recherchiere aktuelle Informationen ohne Websuche.', category: 'research', complexity: [2, 2], accepted: { fast: [], balanced: [], best: [] }, abstain: true },
  { id: 'poem-python', text: 'Write a poem about Python in a friendly tone.', category: 'writing', complexity: [2, 2], accepted: { fast: ['demo-writing'], balanced: ['demo-writing'], best: ['demo-writing'] } },
  { id: 'quoted-code', text: 'Improve this text in a professional tone: "Build a React app. Research the latest news."', category: 'writing', complexity: [2, 2], accepted: { fast: ['demo-writing'], balanced: ['demo-writing'], best: ['demo-writing'] } },
  // rules-v2: everyday prompts that v1 left without any recommendation.
  { id: 'de-function', text: 'Schreibe eine Funktion in Python, die Primzahlen findet.', category: 'coding', complexity: [2, 2], accepted: { fast: ['demo-speed', 'demo-balanced'], balanced: ['demo-balanced', 'demo-coding'], best: ['demo-coding'] } },
  { id: 'en-news', text: 'What are the latest news about the EU AI Act?', category: 'research', complexity: [2, 2], accepted: { fast: ['demo-balanced', 'demo-research'], balanced: ['demo-research'], best: ['demo-research'] } },
  { id: 'de-poem', text: 'Ich brauche ein Gedicht über den Herbst.', category: 'writing', complexity: [2, 2], accepted: { fast: ['demo-writing'], balanced: ['demo-writing'], best: ['demo-writing'] } },
  { id: 'en-trip', text: 'Plan a 3-day trip to Rome.', category: 'planning', complexity: [2, 2], accepted: { fast: ['demo-speed', 'demo-balanced'], balanced: ['demo-balanced', 'demo-research'], best: ['demo-reasoning', 'demo-research'] } },
  { id: 'de-concept', text: 'Wie funktioniert ein Transformator?', category: 'learning', complexity: [2, 2], accepted: { fast: ['demo-speed', 'demo-balanced'], balanced: ['demo-balanced'], best: ['demo-reasoning'] } },
  { id: 'en-fallback', text: 'What is the capital of France?', category: null, complexity: null, accepted: { fast: ['demo-speed', 'demo-balanced'], balanced: ['demo-balanced'], best: ['demo-reasoning', 'demo-balanced'] } },
]
