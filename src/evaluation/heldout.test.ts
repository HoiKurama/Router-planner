import { describe, expect, it } from 'vitest'
import { analyzePrompt } from '../analyzer/analyze'
import { HELD_OUT, TUNING, type LabelledPrompt } from './heldout'

/** Hit rate, plus how often a prompt lands in a wrong category (worse than the honest fallback). */
function measure(set: readonly LabelledPrompt[], name: string) {
  let wrong = 0
  const misses = set.flatMap(({ text, category }) => {
    const actual = analyzePrompt({ text, revision: 1 }).primaryCategory
    if (actual === category) return []
    if (actual !== null) wrong += 1
    return [`  ${category ?? 'fallback'} ← ${actual ?? 'fallback'}: ${text.replace(/\s+/g, ' ')}`]
  })
  const hitRate = 1 - misses.length / set.length
  console.info(`${name}: ${Math.round(hitRate * 100)} % correct, ${wrong} wrong category (${set.length} prompts)${misses.length ? `\n${misses.join('\n')}` : ''}`)
  return { hitRate, wrong }
}

/**
 * Floors from the last measurement (rules-v2: held-out 38 %). Raise them when the rules genuinely
 * improve; lowering one needs a reason in the commit message.
 */
describe('classification on everyday prompts', () => {
  it('keeps every tuning prompt correct', () => expect(measure(TUNING, 'Tuning set').hitRate).toBe(1))
  it('generalizes to the held-out set', () => {
    const { hitRate, wrong } = measure(HELD_OUT, 'Held-out set')
    expect(hitRate).toBeGreaterThanOrEqual(0.5)
    expect(wrong).toBeLessThanOrEqual(2)
  })
})
