import { describe, expect, it } from 'vitest'
import { filterHistory, summarizeUsage } from './history'
import { CATALOG } from '../models/catalog'
import {
  addHistoryEntry, BACKUP_KEY, defaultState, exportState, HISTORY_LIMIT, importState, loadState, saveState, STORAGE_KEY, type HistoryEntry,
} from './storage'

const POOLS = CATALOG.pools.map((pool) => pool.id)

/** A tiny in-memory Storage that can be told to fail. */
function memoryStorage(initial: Record<string, string> = {}, fail: { read?: boolean; write?: boolean } = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => { if (fail.read) throw new Error('blocked'); return data.get(key) ?? null },
    setItem: (key, value) => { if (fail.write) throw new Error('QuotaExceededError'); data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
  }
}

function entry(id: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id, createdAt: '2026-10-04T10:00:00.000Z', prompt: `Prompt ${id}`, category: 'writing', fallback: false, complexity: 2, mode: 'balanced',
    status: 'recommended', provider: 'anthropic', poolId: 'claude-pro', optionId: 'claude-sonnet-5-5/low', modelName: 'Claude Sonnet 5.5', settingLabel: 'Effort Low',
    ...overrides,
  }
}

describe('versioned local storage', () => {
  it('starts with defaults when nothing is stored', () => {
    expect(loadState(POOLS, memoryStorage())).toEqual({ state: defaultState(POOLS), problem: null })
    expect(defaultState(POOLS).settings.enabledPools).toEqual(['claude-pro', 'chatgpt-plus-chat', 'chatgpt-plus-work'])
  })

  it('round-trips history, settings and the last variant under one versioned key', () => {
    const storage = memoryStorage()
    const state = { ...addHistoryEntry(defaultState(POOLS), entry('a')), lastVariant: 'claude' as const }
    state.settings = { ...state.settings, preferredProvider: 'openai', enabledPools: ['claude-pro'], defaultMode: 'fast' }
    expect(saveState(state, storage)).toBeNull()
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(1)
    expect(loadState(POOLS, storage).state).toEqual(state)
  })

  it('falls back to defaults with a notice when the data is corrupt or from another version, keeping a backup', () => {
    const corrupt = loadState(POOLS, memoryStorage({ [STORAGE_KEY]: '{"version":1,"history":[' }))
    expect(corrupt.state).toEqual(defaultState(POOLS))
    expect(corrupt.problem).toMatch(/beschädigt.*Kopie/)
    const newer = JSON.stringify({ version: 2, history: [] })
    const storage = memoryStorage({ [STORAGE_KEY]: newer })
    const future = loadState(POOLS, storage)
    expect(future.state).toEqual(defaultState(POOLS))
    expect(future.problem).toMatch(/anderen Version/)
    saveState(future.state, storage)
    expect(storage.getItem(BACKUP_KEY)).toBe(newer)
    // Without room for the backup the app still starts, it just cannot promise a copy.
    expect(loadState(POOLS, memoryStorage({ [STORAGE_KEY]: '{' }, { write: true })).problem).not.toMatch(/Kopie/)
  })

  it('keeps valid parts and drops invalid ones instead of failing as a whole', () => {
    const raw = { version: 1, lastVariant: 'nonsense', history: [entry('ok'), { id: 'no-prompt' }, entry('bad-date', { createdAt: 'yesterday' }), entry('ok')],
      settings: { enabledPools: ['claude-pro', 'deleted-pool'], preferredProvider: 'gemini', defaultMode: 'turbo', saveHistory: 'yes' } }
    const { state, problem } = loadState(POOLS, memoryStorage({ [STORAGE_KEY]: JSON.stringify(raw) }))
    expect(problem).toBeNull()
    expect(state.history.map((item) => item.id)).toEqual(['ok'])
    expect(state.settings).toEqual({ enabledPools: ['claude-pro'], preferredProvider: null, defaultMode: 'balanced', saveHistory: true })
    expect(state.lastVariant).toBe('neutral')
  })

  it('survives a storage that throws on read or write', () => {
    expect(loadState(POOLS, memoryStorage({}, { read: true })).problem).toMatch(/nicht lesbar/)
    expect(loadState(POOLS, null).problem).toMatch(/erlaubt keinen lokalen Speicher/)
    expect(saveState(defaultState(POOLS), memoryStorage({}, { write: true }))).toMatch(/Speichern fehlgeschlagen/)
  })

  it('caps the history and moves a repeated prompt to the top', () => {
    let state = defaultState(POOLS)
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) state = addHistoryEntry(state, entry(String(i)))
    expect(state.history).toHaveLength(HISTORY_LIMIT)
    state = addHistoryEntry(state, entry('again', { prompt: 'Prompt 50' }))
    expect(state.history[0].id).toBe('again')
    expect(state.history.filter((item) => item.prompt === 'Prompt 50')).toHaveLength(1)
  })
})

describe('export and import', () => {
  it('merges imported history by id and takes over the imported settings', () => {
    const current = addHistoryEntry(addHistoryEntry(defaultState(POOLS), entry('a')), entry('b', { createdAt: '2026-10-04T11:00:00.000Z' }))
    const other = { ...addHistoryEntry(addHistoryEntry(defaultState(POOLS), entry('b')), entry('c', { createdAt: '2026-10-04T12:00:00.000Z' })) }
    other.settings = { ...other.settings, preferredProvider: 'anthropic' }
    const result = importState(exportState(other), current, POOLS)
    expect(result.error).toBeNull()
    expect(result.added).toBe(1)
    expect(result.state!.history.map((item) => item.id)).toEqual(['c', 'b', 'a'])
    expect(result.state!.settings.preferredProvider).toBe('anthropic')
  })

  it('rejects files that are not a PromptRouter export', () => {
    const current = defaultState(POOLS)
    expect(importState('not json', current, POOLS).error).toMatch(/kein gültiges JSON/)
    expect(importState('{"version":1}', current, POOLS).error).toMatch(/kein PromptRouter-Export/)
    expect(importState('[1,2]', current, POOLS).state).toBeNull()
  })
})

describe('history search and usage overview', () => {
  const entries = [
    entry('1', { prompt: 'Gedicht über den Herbst' }),
    entry('2', { prompt: 'React-App bauen', category: 'coding', provider: 'openai', poolId: 'chatgpt-plus-work', modelName: 'GPT-6.1 Sol', settingLabel: 'Reasoning Medium' }),
    entry('3', { prompt: '???', category: null, provider: null, poolId: null, modelName: null, settingLabel: null, status: 'abstained' }),
  ]

  it('filters by text, provider and category', () => {
    expect(filterHistory(entries, 'herbst', 'all', 'all').map((item) => item.id)).toEqual(['1'])
    expect(filterHistory(entries, 'gpt-6.1', 'all', 'all').map((item) => item.id)).toEqual(['2'])
    expect(filterHistory(entries, '', 'openai', 'all').map((item) => item.id)).toEqual(['2'])
    expect(filterHistory(entries, '', 'none', 'all').map((item) => item.id)).toEqual(['3'])
    expect(filterHistory(entries, '', 'all', 'writing').map((item) => item.id)).toEqual(['1'])
  })

  it('counts how often each provider and pool was recommended', () => {
    const usage = summarizeUsage(entries, CATALOG.pools)
    expect([usage.total, usage.anthropic, usage.openai, usage.none]).toEqual([3, 1, 1, 1])
    expect(usage.pools.map(({ pool, count }) => [pool.id, count])).toEqual([['claude-pro', 1], ['chatgpt-plus-chat', 0], ['chatgpt-plus-work', 1]])
  })
})
