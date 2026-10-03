import { describe, expect, it } from 'vitest'
import { analyzePrompt, deriveRequirements } from '../analyzer/analyze'
import { DEMO_REGISTRY } from '../models/catalog'
import { optimizePrompt, checkPreservation } from '../optimizer/optimize'
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
      const requirements = deriveRequirements(analysis)
      const decision = routeTask(requirements, { mode }, DEMO_REGISTRY)
      const optimized = optimizePrompt(input, analysis)
      total += 1
      const correct = fixture.abstain ? decision.status === 'abstained' && decision.selected === null
        : fixture.accepted[mode].includes(decision.selected?.model.id ?? '')
      if (correct) acceptable += 1
      if (decision.selected?.eligibility !== 'eligible' && decision.selected !== null) hardViolations += 1
      expect(analysis.primaryCategory).toBe(fixture.category)
      if (fixture.complexity) {
        expect(analysis.complexity.value).toBeGreaterThanOrEqual(fixture.complexity[0])
        expect(analysis.complexity.value).toBeLessThanOrEqual(fixture.complexity[1])
      }
      expect(correct, `Chosen: ${decision.selected?.candidateId ?? 'none'}`).toBe(true)
      expect(decision.selected?.eligibility ?? 'eligible').toBe('eligible')
      expect(checkPreservation(input, optimized)).toBe(true)
      expect(analysis.analysisVersion).toBe(BASELINE.analysis)
      expect(decision.registryVersion).toBe(BASELINE.registry)
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
