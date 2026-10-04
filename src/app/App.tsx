import { useRef, useState } from 'react'
import { validateInput } from '../analyzer/analyze'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { HistoryCard } from '../components/HistoryCard'
import { Icon } from '../components/Icon'
import { PromptCard } from '../components/PromptCard'
import { RecommendationCard } from '../components/RecommendationCard'
import { SettingsCard } from '../components/SettingsCard'
import { UsageCard } from '../components/UsageCard'
import { VariantsCard } from '../components/VariantsCard'
import { CATEGORY_LABELS } from '../data/policy'
import type { PriorityMode, RoutingDecision, RoutingPreferences, TaskAnalysis } from '../domain/types'
import { CATALOG } from '../models/catalog'
import type { VariantId } from '../optimizer/variants'
import { optionLabel } from '../router/explain'
import { createEntry } from './history'
import { analyzeOnly, processPrompt, recommend } from './services'
import { addHistoryEntry, exportState, importState, type HistoryEntry, type Settings } from './storage'
import { usePersistentState } from './usePersistentState'
import { useTheme } from './useTheme'

type Result = Awaited<ReturnType<typeof processPrompt>>
const POOL_IDS = CATALOG.pools.map((pool) => pool.id)
const summary = (analysis: TaskAnalysis, decision: RoutingDecision) => {
  const task = analysis.primaryCategory ? CATEGORY_LABELS[analysis.primaryCategory] : analysis.fallback ? 'Allgemein (Fallback)' : 'Unklare Aufgabe'
  return `Analyse fertig: ${task}. Empfehlung: ${decision.selected ? optionLabel(decision.selected) : 'keine'}.`
}
/** FileReader works everywhere, including test environments without Blob.text(). */
const readText = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsText(file)
})
/** On stacked (narrow) layouts the recommendation starts below the fold; bring it into view. */
const revealResults = () => requestAnimationFrame(() => {
  if (window.matchMedia?.('(max-width: 960px)')?.matches) document.getElementById('recommendation-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

export function App() {
  const { state: stored, update, notice, setNotice } = usePersistentState(POOL_IDS)
  const settings = stored.settings
  const [original, setOriginal] = useState('')
  const [mode, setMode] = useState<PriorityMode>(settings.defaultMode)
  const [result, setResult] = useState<Result | null>(null)
  const [decision, setDecision] = useState<RoutingDecision | null>(null)
  const [variant, setVariant] = useState<VariantId>(stored.lastVariant)
  const [overrides, setOverrides] = useState<Partial<Record<VariantId, string>>>({})
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [edited, setEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const revision = useRef(0)
  const pending = useRef<AbortController | null>(null)
  /** The history entry of the current result, so a new mode or setting updates it instead of adding a duplicate. */
  const entry = useRef<{ id: string; text: string } | null>(null)
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { theme, toggleTheme } = useTheme()
  const inputError = original ? validateInput(original) : null
  const shownText = editing ? draft : overrides[variant] ?? result?.variants.find((item) => item.id === variant)?.rendered ?? ''
  const preferences = (nextMode: PriorityMode = mode, nextSettings: Settings = settings): RoutingPreferences =>
    ({ mode: nextMode, enabledPools: nextSettings.enabledPools, preferredProvider: nextSettings.preferredProvider })

  const remember = (text: string, analysis: TaskAnalysis, nextDecision: RoutingDecision, nextMode: PriorityMode, keepId: boolean, save = settings.saveHistory) => {
    if (!save) return
    const next = createEntry(text, analysis.primaryCategory, analysis.fallback, nextMode, nextDecision, keepId && entry.current ? entry.current.id : undefined)
    entry.current = { id: next.id, text }
    update((state) => addHistoryEntry(state, next))
  }

  const changeOriginal = (value: string) => {
    revision.current += 1
    pending.current?.abort()
    entry.current = null
    setOriginal(value); setResult(null); setDecision(null); setDraft(''); setOverrides({})
    setEditing(false); setDirty(false); setEdited(false); setError(''); setCopyStatus(''); setAnnouncement(''); setBusy(false)
  }

  const analyze = async (text = original, nextMode = mode) => {
    const invalid = validateInput(text)
    if (invalid) { setError(invalid); return }
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const currentRevision = ++revision.current
    setBusy(true); setError(''); setCopyStatus('')
    try {
      const next = await processPrompt({ text, revision: currentRevision }, controller.signal)
      if (currentRevision !== revision.current || controller.signal.aborted) return
      const nextDecision = recommend(next.requirements, preferences(nextMode))
      setResult(next); setDecision(nextDecision); setOverrides({}); setDraft('')
      setEdited(false); setDirty(false); setEditing(false)
      remember(text, next.analysis, nextDecision, nextMode, false)
      setAnnouncement(summary(next.analysis, nextDecision)); revealResults()
    } catch (cause) {
      if (!controller.signal.aborted && currentRevision === revision.current) setError(cause instanceof Error ? cause.message : 'Die Analyse konnte nicht abgeschlossen werden.')
    } finally { if (currentRevision === revision.current) setBusy(false) }
  }

  /** Routes the current result again, e.g. after a new mode or new subscriptions, and updates its history entry. */
  const reroute = (nextMode: PriorityMode, nextSettings: Settings) => {
    if (!result || dirty) return
    const nextDecision = recommend(result.requirements, preferences(nextMode, nextSettings))
    setDecision(nextDecision)
    if (entry.current) remember(entry.current.text, result.analysis, nextDecision, nextMode, true, nextSettings.saveHistory)
  }

  /** Remembers the priority for the next visit without routing again. */
  const storeMode = (next: PriorityMode) => {
    setMode(next)
    update((state) => ({ ...state, settings: { ...state.settings, defaultMode: next } }))
  }

  const changeMode = (next: PriorityMode) => {
    storeMode(next)
    reroute(next, { ...settings, defaultMode: next })
  }

  const changeSettings = (next: Settings) => {
    update((state) => ({ ...state, settings: next }))
    reroute(mode, next)
  }

  const selectVariant = (id: VariantId) => {
    setVariant(id); setCopyStatus('')
    update((state) => ({ ...state, lastVariant: id }))
  }

  const reevaluate = () => {
    const invalid = validateInput(draft)
    if (invalid) { setError(invalid); return }
    try {
      const { analysis, requirements } = analyzeOnly({ text: draft, revision: ++revision.current })
      const nextDecision = recommend(requirements, preferences())
      if (result) setResult({ ...result, analysis, requirements })
      setOverrides((current) => ({ ...current, [variant]: draft }))
      setDecision(nextDecision); setEditing(false); setDirty(false); setEdited(true); setError('')
      remember(draft, analysis, nextDecision, mode, false)
      setAnnouncement(summary(analysis, nextDecision))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Neubewertung konnte nicht abgeschlossen werden.')
    }
  }

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(shownText)
      setCopyStatus('Prompt kopiert.')
    } catch {
      outputRef.current?.focus(); outputRef.current?.select()
      setCopyStatus('Kopieren nicht erlaubt. Der Text ist markiert; nutze Strg+C oder ⌘C.')
    }
  }

  const reuse = (item: HistoryEntry) => {
    changeOriginal(item.prompt)
    storeMode(item.mode)
    inputRef.current?.focus()
    void analyze(item.prompt, item.mode)
  }

  const clearHistory = () => {
    if (!window.confirm('Den gesamten Verlauf löschen? Das lässt sich nicht rückgängig machen.')) return
    entry.current = null
    update((state) => ({ ...state, history: [] }))
  }

  const exportData = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportState(stored)], { type: 'application/json' }))
      const link = Object.assign(document.createElement('a'), { href: url, download: `promptrouter-${new Date().toISOString().slice(0, 10)}.json` })
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Export erstellt: Die JSON-Datei liegt in deinem Download-Ordner.')
    } catch { setNotice('Der Export ist in diesem Browser nicht möglich.') }
  }

  const importData = async (file: File) => {
    let text: string
    try { text = await readText(file) } catch { setNotice('Die Datei konnte nicht gelesen werden.'); return }
    const check = importState(text, stored, POOL_IDS)
    if (!check.state) { setNotice(check.error); return }
    const imported = check.state
    update((state) => importState(text, state, POOL_IDS).state ?? state)
    setMode(imported.settings.defaultMode); setVariant(imported.lastVariant)
    reroute(imported.settings.defaultMode, imported.settings)
    setNotice(`Import fertig: ${check.added === 1 ? '1 neuer Verlaufseintrag' : `${check.added} neue Verlaufseinträge`}, Einstellungen übernommen.`)
  }

  const reset = () => { changeOriginal(''); storeMode('balanced'); inputRef.current?.focus() }

  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="#main" aria-label="PromptRouter Start"><span className="brand-mark"><Icon name="spark" size={21} /></span><span>Prompt<span className="brand-light">Router</span><small>CLAUDE PRO · CHATGPT PLUS</small></span></a>
      <div className="header-actions"><span className="local-badge"><span className="live-dot" /> Lokal</span><button className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'} title="Theme wechseln"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} /></button></div></header>
    <main id="main">
      <section className="intro"><span className="eyebrow">BESTES ERGEBNIS. KLEINSTER VERBRAUCH.</span><h1>Welche KI für <span>diesen Prompt?</span></h1>
        <p>Die App erkennt, was dein Prompt braucht, und empfiehlt aus deinen Abos das sparsamste Modell mit der passenden Reasoning-Stufe, das dafür reicht. Alles läuft lokal im Browser, ohne API.</p></section>
      <div className="workspace-toolbar"><span><span className="live-dot" /> Regelbasierte Analyse <span className="toolbar-separator">/</span> Benchmarks: Artificial Analysis, Stand {CATALOG.retrieved}</span><button className="text-button" onClick={reset}><Icon name="reset" size={15} /> Zurücksetzen</button></div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
      <div className="dashboard">
        <div className="main-column">
          <PromptCard original={original} inputError={inputError} mode={mode} busy={busy} inputRef={inputRef} onChange={changeOriginal} onModeChange={changeMode} onAnalyze={() => void analyze()} />
          <div id="recommendation-anchor"><RecommendationCard decision={decision} catalog={CATALOG} mode={mode} stale={dirty} busy={busy} /></div>
          <div className="result-row">
            <VariantsCard variants={result?.variants ?? null} active={variant} text={shownText} recommendedProvider={decision?.selected?.pool.provider ?? null}
              editing={editing} dirty={dirty} edited={edited} copyStatus={copyStatus} suggestions={result?.optimized.suggestions ?? []} outputRef={outputRef}
              onSelect={selectVariant} onEdit={() => { setDraft(shownText); setEditing(true); setTimeout(() => outputRef.current?.focus(), 0) }}
              onDraft={(text) => { revision.current += 1; setDraft(text); setDirty(true); setDecision(null); setCopyStatus('') }}
              onReevaluate={reevaluate} onCopy={() => void copy()} />
            <AnalysisPanel analysis={result?.analysis ?? null} stale={dirty} edited={edited} />
          </div>
        </div>
        <aside className="side-column" aria-label="Verlauf und Einstellungen">
          <UsageCard entries={stored.history} pools={CATALOG.pools} />
          <HistoryCard entries={stored.history} saving={settings.saveHistory} busy={busy} onReuse={reuse} onClear={clearHistory} />
          <SettingsCard settings={settings} pools={CATALOG.pools} notice={notice} onChange={changeSettings} onExport={exportData} onImport={(file) => void importData(file)} />
        </aside>
      </div>
      <footer className="app-footer"><span><Icon name="check" size={13} /> Verlauf und Einstellungen bleiben in diesem Browser.</span><span>Keine APIs · Keine Aufgabenausführung · Modelldaten aus models.json</span></footer>
    </main>
  </div>
}
