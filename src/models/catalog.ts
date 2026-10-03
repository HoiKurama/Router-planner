import { CAPABILITY_IDS, type ModelProfile, type ModelRegistry, type SkillRating, type SkillRatings } from '../domain/types'
import { WORKFLOWS } from '../data/policy'

function ratings(values: readonly SkillRating[]): SkillRatings {
  return Object.fromEntries(CAPABILITY_IDS.map((id, i) => [id, values[i]])) as SkillRatings
}

function profile(id: string, name: string, skills: readonly SkillRating[], speed: SkillRating, cost: SkillRating, level: 'standard' | 'medium' = 'standard'): ModelProfile {
  return {
    id: `demo-${id}`, name: `Demo ${name}`, providerId: 'demo',
    status: 'active', provenance: 'illustrative', version: 'demo-v1',
    capabilities: { ratings: ratings(skills), toolCalling: true, inputModalities: ['text'], contextWindowTokens: null },
    variants: [{ id: level, reasoningLevel: level, speed, costEfficiency: cost }],
  }
}

const reasoner = profile('reasoning', 'Reasoning', [3, 3, 3, 2, 3, 3, 3, 3, 3], 2, 2, 'medium')

/** Entirely fictional profiles. These values are not benchmarks of real products. */
export const DEMO_REGISTRY: ModelRegistry = {
  version: 'demo-catalog-v1',
  workflows: WORKFLOWS,
  models: [
    profile('speed', 'Speed', [2, 2, 2, 1, 2, 2, 1, 1, 1], 4, 4),
    profile('balanced', 'Balanced', [3, 3, 3, 2, 3, 3, 2, 3, 3], 3, 3),
    profile('coding', 'Coding', [4, 3, 3, 2, 2, 2, 3, 4, 4], 2, 2, 'medium'),
    { ...reasoner, variants: [
      ...reasoner.variants,
      { id: 'high', reasoningLevel: 'high', ratings: ratings([3, 4, 4, 3, 3, 4, 4, 4, 3]), speed: 1, costEfficiency: 1 },
    ] },
    profile('research', 'Research', [2, 3, 3, 4, 3, 3, 3, 4, 4], 2, 2, 'medium'),
    profile('writing', 'Writing', [1, 2, 2, 2, 4, 3, 1, 2, 1], 3, 3),
    profile('data', 'Data', [2, 3, 3, 2, 2, 2, 4, 3, 4], 2, 2, 'medium'),
  ],
} satisfies ModelRegistry
