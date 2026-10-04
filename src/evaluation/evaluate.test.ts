import { describe, expect, it } from 'vitest'
import { analyzePrompt, deriveRequirements } from '../analyzer/analyze'
import { CATALOG } from '../models/catalog'
import { optimizePrompt, checkPreservation } from '../optimizer/optimize'
import { buildVariants } from '../optimizer/variants'
import { routeTask } from '../router/route'
import { BASELINE, EVALUATION_CASES } from './cases'

let total = 0
let acceptable = 0
let hardViolations = 0
describe('versioned routing evaluation', () => {
  for (const fixture of EVALUATION_CASES) for (const mode of ['fast', 'balanced', 'best'] as const) {
    it(`${fixture.id} / ${mode}`, () => {
      const input = { text: fixture.text, revision: 1 }
      const analysis = analyzePrompt(input)
      const decision = routeTask(deriveRequirements(analysis), { mode }, CATALOG)
      const optimized = optimizePrompt(input, analysis)
      const selected = decision.selected
      total += 1
      const correct = fixture.abstain ? decision.status === 'abstained' && selected === null
        : fixture.accepted[mode].includes(selected?.id ?? '')
      if (correct) acceptable += 1
      // Hard rules: never below the threshold, never outside the plan, never without a benchmark value.
      const violation = selected !== null && (selected.score === null || !selected.family.inPlan || selected.score < decision.threshold! - 1e-9)
      if (violation) hardViolations += 1
      expect(analysis.primaryCategory).toBe(fixture.category)
      if (fixture.complexity) {
        expect(analysis.complexity.value).toBeGreaterThanOrEqual(fixture.complexity[0])
        expect(analysis.complexity.value).toBeLessThanOrEqual(fixture.complexity[1])
      }
      expect(correct, `Chosen: ${selected?.id ?? 'none'}`).toBe(true)
      expect(violation).toBe(false)
      expect(checkPreservation(input, optimized)).toBe(true)
      for (const variant of buildVariants(input, analysis, optimized)) expect(checkPreservation(input, variant), variant.id).toBe(true)
      expect(analysis.analysisVersion).toBe(BASELINE.analysis)
      expect(decision.catalogVersion).toBe(BASELINE.catalog)
      expect(decision.policyVersion).toBe(BASELINE.policy)
    })
  }
  it('summary: every case acceptable, no hard violations', () => {
    console.info('Routing evaluation:', JSON.stringify({ total, acceptable, hardViolations, baseline: BASELINE }))
    expect(total).toBe(EVALUATION_CASES.length * 3)
    expect(hardViolations).toBe(0)
    expect(acceptable).toBe(total)
  })
})
