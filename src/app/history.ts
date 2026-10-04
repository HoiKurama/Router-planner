import type { Category, PriorityMode, ProviderId, RoutingDecision, UsagePool } from '../domain/types'
import type { HistoryEntry } from './storage'

export type ProviderFilter = 'all' | ProviderId | 'none'

const newId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export function createEntry(prompt: string, category: Category | null, fallback: boolean, mode: PriorityMode, decision: RoutingDecision, id = newId()): HistoryEntry {
  const selected = decision.selected
  return {
    id, createdAt: new Date().toISOString(), prompt, category, fallback, complexity: decision.complexity, mode, status: decision.status,
    provider: selected?.pool.provider ?? null, poolId: selected?.pool.id ?? null, optionId: selected?.id ?? null,
    modelName: selected?.family.name ?? null, settingLabel: selected?.setting.label ?? null,
  }
}

export function filterHistory(entries: readonly HistoryEntry[], query: string, provider: ProviderFilter, category: Category | 'all'): HistoryEntry[] {
  const needle = query.trim().toLocaleLowerCase('de-DE')
  return entries.filter((entry) => {
    if (provider === 'none' ? entry.provider !== null : provider !== 'all' && entry.provider !== provider) return false
    if (category !== 'all' && entry.category !== category) return false
    if (!needle) return true
    return [entry.prompt, entry.modelName ?? '', entry.settingLabel ?? ''].some((text) => text.toLocaleLowerCase('de-DE').includes(needle))
  })
}

export interface UsageSummary {
  total: number
  anthropic: number
  openai: number
  none: number
  pools: { pool: UsagePool; count: number }[]
}

/** How often each provider and allowance was recommended. Counts recommendations, not real usage. */
export function summarizeUsage(entries: readonly HistoryEntry[], pools: readonly UsagePool[]): UsageSummary {
  const count = (test: (entry: HistoryEntry) => boolean) => entries.filter(test).length
  return {
    total: entries.length,
    anthropic: count((entry) => entry.provider === 'anthropic'),
    openai: count((entry) => entry.provider === 'openai'),
    none: count((entry) => entry.provider === null),
    pools: pools.map((pool) => ({ pool, count: count((entry) => entry.poolId === pool.id) })),
  }
}
