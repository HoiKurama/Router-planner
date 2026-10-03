import { useRef, useState, type KeyboardEvent } from 'react'
import { validateInput } from '../analyzer/analyze'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { Icon } from '../components/Icon'
import { Recommendation } from '../components/Recommendation'
import { EXAMPLES } from '../data/examples'
import { CATEGORY_LABELS, MODE_LABELS } from '../data/policy'
import type { PriorityMode, RoutingDecision, TaskAnalysis } from '../domain/types'
import { analyzeOnly, processPrompt, recommend } from './services'
import { useTheme } from './useTheme'

type Result = Awaited<ReturnType<typeof processPrompt>>
const isShortcut = (event: KeyboardEvent) => event.key === 'Enter' && (event.ctrlKey || event.metaKey)
const summary = (analysis: TaskAnalysis, decision: RoutingDecision) => {
  const task = analysis.primaryCategory ? CATEGORY_LABELS[analysis.primaryCategory] : analysis.fallback ? 'Allgemein (Fallback)' : 'Unklare Aufgabe'
  return `Analyse fertig: ${task}. Empfehlung: ${decision.selected?.model.name ?? 'keine'}.`
}
/** On stacked (narrow) layouts the results start below the fold; bring them into view. */
const revealResults = () => requestAnimationFrame(() => {
  if (window.matchMedia?.('(max-width: 960px)')?.matches) document.getElementById('analysis-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
const modeHints: Record<PriorityMode, string> = {
  fast: 'Schnelligkeit und niedrige Kosten im Fokus.',
  balanced: 'Aufgabenqualität und Effizienz im Gleichgewicht.',
  best: 'Maximale fachliche Qualität im Demo-Katalog.',
}

export function App() {
  const [original, setOriginal] = useState('')
  const [mode, setMode] = useState<PriorityMode>('balanced')
  const [result, setResult] = useState<Result | null>(null)
  const [decision, setDecision] = useState<RoutingDecision | null>(null)
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
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { theme, toggleTheme } = useTheme()
  const inputError = original ? validateInput(original) : null

  const changeOriginal = (value: string) => {
    revision.current += 1
    pending.current?.abort()
    setOriginal(value); setResult(null); setDecision(null); setDraft('')
    setEditing(false); setDirty(false); setEdited(false); setError(''); setCopyStatus(''); setAnnouncement(''); setBusy(false)
  }

  const analyze = async () => {
    const invalid = validateInput(original)
    if (invalid) { setError(invalid); return }
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const currentRevision = ++revision.current
    setBusy(true); setError(''); setCopyStatus('')
    try {
      const next = await processPrompt({ text: original, revision: currentRevision }, controller.signal)
      if (currentRevision !== revision.current || controller.signal.aborted) return
      const nextDecision = recommend(next.requirements, { mode })
      setResult(next); setDraft(next.optimized.rendered); setDecision(nextDecision)
      setEdited(false); setDirty(false); setEditing(false)
      setAnnouncement(summary(next.analysis, nextDecision)); revealResults()
    } catch (cause) {
      if (!controller.signal.aborted && currentRevision === revision.current) setError(cause instanceof Error ? cause.message : 'Die Analyse konnte nicht abgeschlossen werden.')
    } finally { if (currentRevision === revision.current) setBusy(false) }
  }

  const changeMode = (next: PriorityMode) => {
    setMode(next)
    if (result && !dirty) setDecision(recommend(result.requirements, { mode: next }))
  }

  const reevaluate = () => {
    const invalid = validateInput(draft)
    if (invalid) { setError(invalid); return }
    try {
      const { analysis, requirements } = analyzeOnly({ text: draft, revision: ++revision.current })
      const nextDecision = recommend(requirements, { mode })
      if (result) setResult({ ...result, analysis, requirements })
      setDecision(nextDecision); setEditing(false); setDirty(false); setEdited(true); setError('')
      setAnnouncement(summary(analysis, nextDecision))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Neubewertung konnte nicht abgeschlossen werden.')
    }
  }

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(draft)
      setCopyStatus('Prompt kopiert.')
    } catch {
      outputRef.current?.focus(); outputRef.current?.select()
      setCopyStatus('Kopieren nicht erlaubt. Der Text ist markiert; nutze Strg+C oder ⌘C.')
    }
  }

  const reset = () => { changeOriginal(''); setMode('balanced'); inputRef.current?.focus() }

  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="#main" aria-label="PromptRouter Start"><span className="brand-mark"><Icon name="spark" size={21} /></span><span>Prompt<span className="brand-light">Router</span><small>LOCAL WORKSPACE</small></span></a><div className="header-actions"><span className="local-badge"><span className="live-dot" /> Lokal</span><button className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'} title="Theme wechseln"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} /></button></div></header>
    <main id="main">
      <section className="hero"><div className="hero-copy"><span className="eyebrow">KLARE PROMPTS. PASSENDE MODELLE.</span><h1>Eine bessere Richtung<br />für deine <span>Ideen.</span></h1><p>Verstehe deine Aufgabe, strukturiere deinen Prompt und finde den passenden KI-Workflow. Alles lokal.</p></div><div className="priority-area"><span className="control-label" id="priority-label">Deine Priorität</span><div className="segmented-control" role="group" aria-labelledby="priority-label">{(['fast', 'balanced', 'best'] as const).map((value) => <button key={value} aria-pressed={mode === value} className={mode === value ? 'active' : ''} disabled={busy} onClick={() => changeMode(value)}>{value === 'fast' && <span className="segment-symbol">↯</span>}{value === 'balanced' && <span className="segment-symbol">◈</span>}{value === 'best' && <Icon name="spark" size={14} />}{MODE_LABELS[value]}</button>)}</div><p>{modeHints[mode]}</p></div></section>
      <div className="workspace-toolbar"><span><span className="live-dot" /> Regelbasierte Analyse <span className="toolbar-separator">/</span> Demo-Modelle</span><button className="text-button" onClick={reset}><Icon name="reset" size={15} /> Zurücksetzen</button></div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
      <div className="workspace">
        <section className="panel input-panel" aria-labelledby="input-title">
          <div className="panel-heading"><div><span className="step-number">01</span><h2 id="input-title">Originalprompt</h2></div><span className="tiny-label">DEIN AUSGANGSPUNKT</span></div>
          <label className="visually-hidden" htmlFor="original-prompt">Originalprompt</label>
          <textarea ref={inputRef} id="original-prompt" className="prompt-input" value={original} onChange={(event) => changeOriginal(event.target.value)} onKeyDown={(event) => { if (isShortcut(event)) { event.preventDefault(); if (!inputError && original.trim() && !busy) void analyze() } }} placeholder={'Was möchtest du erreichen?\n\nSchreib deine Aufgabe so auf, wie sie dir gerade einfällt.'} spellCheck={false} dir="auto" aria-describedby="input-help input-validation" />
          <div className="input-meta"><span id="input-help">Deutsch oder Englisch · Strg+Enter analysiert</span><span className={inputError ? 'text-error' : ''}>{new Intl.NumberFormat('de-DE').format(Array.from(original).length)} / 20.000</span></div>
          <div id="input-validation" className="input-validation" role={inputError ? 'alert' : undefined}>{inputError}</div>
          <div className="input-actions"><button className="primary-button" onClick={() => void analyze()} disabled={!original.trim() || !!inputError || busy}><Icon name="spark" size={17} />{busy ? 'Wird analysiert …' : 'Analysieren'}<Icon name="arrow" size={17} /></button><label className="example-label" htmlFor="example-select">Oder starte mit einem Beispiel</label><select id="example-select" value="" onChange={(event) => { const example = EXAMPLES.find((item) => item.id === event.target.value); if (example) changeOriginal(example.text) }}><option value="" disabled>Beispiel auswählen</option>{EXAMPLES.map((example) => <option key={example.id} value={example.id}>{example.label}</option>)}</select></div>
        </section>
        <AnalysisPanel analysis={result?.analysis ?? null} stale={dirty} edited={edited} />
        <section className="panel output-panel" aria-labelledby="output-title"><div className="panel-heading"><div><span className="step-number">03</span><h2 id="output-title">Optimierter Prompt</h2></div><Icon name="spark" size={16} /></div>
          {!result ? <div className="empty-panel output-empty"><div className="empty-icon"><Icon name="edit" size={26} /></div><h3>Mehr Struktur. Deine Intention.</h3><p>Dein Original bleibt erhalten. Fehlende Angaben werden als Vorschläge sichtbar.</p><span className="preservation-preview"><Icon name="check" size={14} /> Keine erfundenen Anforderungen</span></div> : <>
            <div className={`preservation-label ${edited || dirty ? 'manual' : ''}`}><Icon name={edited || dirty ? 'edit' : 'check'} size={14} />{edited || dirty ? 'Manuell bearbeitet' : result.optimized.preservationPassed ? 'Originaltext vollständig erhalten' : 'Original als sichere Rückgabe'}</div>
            <label className="visually-hidden" htmlFor="optimized-prompt">Optimierter Prompt</label><textarea id="optimized-prompt" ref={outputRef} className={`optimized-text ${editing ? 'is-editing' : ''}`} value={draft} readOnly={!editing} spellCheck={false} dir="auto" onKeyDown={(event) => { if (editing && isShortcut(event)) { event.preventDefault(); reevaluate() } }} onChange={(event) => { revision.current += 1; setDraft(event.target.value); setDirty(true); setDecision(null); setCopyStatus('') }} />
            {!result.optimized.changed && !edited && !dirty && <p className="unchanged-note">Der Prompt braucht keine zusätzliche automatische Gliederung.</p>}
            {editing ? <button className="secondary-button save-button" onClick={reevaluate}>Übernehmen und neu bewerten <Icon name="arrow" size={16} /></button> : <div className="output-actions"><button className="secondary-button" onClick={() => void copy()} disabled={!draft.trim()}><Icon name="copy" size={15} /> Prompt kopieren</button><button className="text-button" onClick={() => { setEditing(true); setTimeout(() => outputRef.current?.focus(), 0) }}><Icon name="edit" size={15} /> Bearbeiten</button></div>}
            <p className="copy-status" role="status">{copyStatus}</p>
            {result.optimized.suggestions.length > 0 && !edited && <details className="suggestions"><summary>Verbesserungsvorschläge <span>{result.optimized.suggestions.length}</span></summary><ul>{result.optimized.suggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}</ul><p>Übernimm passende Angaben über „Bearbeiten“.</p></details>}
          </>}
        </section>
      </div>
      <Recommendation decision={decision} mode={mode} stale={dirty} />
      <footer className="app-footer"><span><Icon name="check" size={13} /> Deine Prompts bleiben in diesem Browser.</span><span>Keine APIs · Keine Aufgabenausführung · Keine Prompt-Speicherung</span></footer>
    </main>
  </div>
}
