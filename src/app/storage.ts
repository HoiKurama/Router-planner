import type { Category, PriorityMode, ProviderId, RoutingDecision } from '../domain/types'
import { VARIANT_IDS, type VariantId } from '../optimizer/variants'

/** Bump the number when the stored shape changes incompatibly; old data then falls back to defaults. */
export const STORAGE_KEY = 'promptrouter:v1'
export const STORAGE_VERSION = 1
export const HISTORY_LIMIT = 100

export interface HistoryEntry {
  id: string
  createdAt: string
  prompt: string
  category: Category | null
  fallback: boolean
  complexity: number | null
  mode: PriorityMode
  status: RoutingDecision['status']
  provider: ProviderId | null
  poolId: string | null
  optionId: string | null
  modelName: string | null
  settingLabel: string | null
}

export interface Settings {
  enabledPools: string[]
  preferredProvider: ProviderId | null
  defaultMode: PriorityMode
  saveHistory: boolean
}

export interface StoredState {
  version: typeof STORAGE_VERSION
  history: HistoryEntry[]
  settings: Settings
  lastVariant: VariantId
}

const CATEGORIES = ['coding', 'math', 'research', 'writing', 'learning', 'dataAnalysis', 'reasoning', 'planning']
const MODES = ['fast', 'balanced', 'best']
const STATUSES = ['recommended', 'provisional', 'abstained']
const PROVIDERS = ['anthropic', 'openai']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const textOrNull = (value: unknown) => typeof value === 'string' ? value : null
const oneOf = <T extends string>(value: unknown, allowed: readonly string[], fallback: T): T => allowed.includes(value as string) ? value as T : fallback

export function defaultState(poolIds: readonly string[]): StoredState {
  return {
    version: STORAGE_VERSION, history: [], lastVariant: 'neutral',
    settings: { enabledPools: [...poolIds], preferredProvider: null, defaultMode: 'balanced', saveHistory: true },
  }
}

function sanitizeEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.prompt !== 'string' || !value.prompt.trim()) return null
  if (typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))) return null
  return {
    id: value.id, createdAt: value.createdAt, prompt: value.prompt,
    category: CATEGORIES.includes(value.category as string) ? value.category as Category : null,
    fallback: value.fallback === true,
    complexity: Number.isInteger(value.complexity) && (value.complexity as number) >= 1 && (value.complexity as number) <= 5 ? value.complexity as number : null,
    mode: oneOf(value.mode, MODES, 'balanced'),
    status: oneOf(value.status, STATUSES, 'abstained'),
    provider: PROVIDERS.includes(value.provider as string) ? value.provider as ProviderId : null,
    poolId: textOrNull(value.poolId), optionId: textOrNull(value.optionId),
    modelName: textOrNull(value.modelName), settingLabel: textOrNull(value.settingLabel),
  }
}

const newestFirst = (a: HistoryEntry, b: HistoryEntry) => Date.parse(b.createdAt) - Date.parse(a.createdAt)

/** Keeps every valid part of unknown data and replaces the rest with defaults. Never throws. */
export function sanitizeState(value: unknown, poolIds: readonly string[]): StoredState {
  const defaults = defaultState(poolIds)
  if (!isRecord(value)) return defaults
  const seen = new Set<string>()
  const history = (Array.isArray(value.history) ? value.history : [])
    .map(sanitizeEntry)
    .filter((entry): entry is HistoryEntry => entry !== null && !seen.has(entry.id) && Boolean(seen.add(entry.id)))
    .sort(newestFirst)
    .slice(0, HISTORY_LIMIT)
  const raw = isRecord(value.settings) ? value.settings : {}
  const settings: Settings = {
    enabledPools: Array.isArray(raw.enabledPools) ? poolIds.filter((id) => (raw.enabledPools as unknown[]).includes(id)) : defaults.settings.enabledPools,
    preferredProvider: PROVIDERS.includes(raw.preferredProvider as string) ? raw.preferredProvider as ProviderId : null,
    defaultMode: oneOf(raw.defaultMode, MODES, 'balanced'),
    saveHistory: typeof raw.saveHistory === 'boolean' ? raw.saveHistory : true,
  }
  return { version: STORAGE_VERSION, history, settings, lastVariant: oneOf(value.lastVariant, VARIANT_IDS, 'neutral') }
}

/** localStorage can be missing or throw on access (private mode, blocked site data). */
export function browserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

export interface LoadResult { state: StoredState; problem: string | null }

/** Unreadable data is copied here before the next save replaces it, so nothing is lost silently. */
export const BACKUP_KEY = 'promptrouter:backup'

function backUp(storage: Storage, text: string) {
  try { storage.setItem(BACKUP_KEY, text); return ` Eine Kopie liegt im lokalen Speicher unter „${BACKUP_KEY}“.` } catch { return '' }
}

export function loadState(poolIds: readonly string[], storage: Storage | null = browserStorage()): LoadResult {
  const defaults = defaultState(poolIds)
  if (!storage) return { state: defaults, problem: 'Der Browser erlaubt keinen lokalen Speicher. Verlauf und Einstellungen gelten nur bis zum Neuladen.' }
  let text: string | null
  try { text = storage.getItem(STORAGE_KEY) } catch { return { state: defaults, problem: 'Der lokale Speicher ist nicht lesbar. Verlauf und Einstellungen gelten nur bis zum Neuladen.' } }
  if (text === null) return { state: defaults, problem: null }
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch {
    return { state: defaults, problem: `Die gespeicherten Daten waren beschädigt und wurden durch Standardwerte ersetzt.${backUp(storage, text)}` }
  }
  if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) {
    return { state: defaults, problem: `Die gespeicherten Daten stammen aus einer anderen Version und wurden nicht geladen.${backUp(storage, text)}` }
  }
  return { state: sanitizeState(parsed, poolIds), problem: null }
}

/** Returns an error message for the UI, or null when the state was written. */
export function saveState(state: StoredState, storage: Storage | null = browserStorage()): string | null {
  if (!storage) return 'Speichern ist in diesem Browser nicht möglich.'
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return null }
  catch { return 'Speichern fehlgeschlagen, vermutlich ist der lokale Speicher voll oder gesperrt.' }
}

/** Newest first. The same prompt appears only once: analysing it again moves it to the top. */
export function addHistoryEntry(state: StoredState, entry: HistoryEntry): StoredState {
  const rest = state.history.filter((item) => item.id !== entry.id && item.prompt !== entry.prompt)
  return { ...state, history: [entry, ...rest].slice(0, HISTORY_LIMIT) }
}

export function exportState(state: StoredState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'PromptRouter' }, null, 2)
}

export interface ImportResult { state: StoredState | null; added: number; error: string | null }

/** Imported settings replace the current ones; history entries are merged by id, newest first. */
export function importState(text: string, current: StoredState, poolIds: readonly string[]): ImportResult {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { state: null, added: 0, error: 'Die Datei ist kein gültiges JSON.' } }
  if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.history)) {
    return { state: null, added: 0, error: 'Die Datei ist kein PromptRouter-Export dieser Version.' }
  }
  const imported = sanitizeState(parsed, poolIds)
  const known = new Set(current.history.map((entry) => entry.id))
  const added = imported.history.filter((entry) => !known.has(entry.id)).length
  const history = [...current.history, ...imported.history.filter((entry) => !known.has(entry.id))].sort(newestFirst).slice(0, HISTORY_LIMIT)
  return { state: { ...imported, history }, added, error: null }
}
