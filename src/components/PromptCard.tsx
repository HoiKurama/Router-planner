import type { KeyboardEvent, RefObject } from 'react'
import { EXAMPLES } from '../data/examples'
import { MAX_PROMPT_CODEPOINTS, MODE_LABELS } from '../data/policy'
import type { PriorityMode } from '../domain/types'
import { Icon } from './Icon'

const MODES: readonly PriorityMode[] = ['fast', 'balanced', 'best']
const MODE_HINTS: Record<PriorityMode, string> = {
  fast: 'Niedrigere Qualitätsschwelle: spart Kontingent, wo es vertretbar ist.',
  balanced: 'Die sparsamste Einstellung, die für die Aufgabe reicht.',
  best: 'Der höchste Benchmarkwert in deinen Abos, egal wie viel er verbraucht.',
}
const isShortcut = (event: KeyboardEvent) => event.key === 'Enter' && (event.ctrlKey || event.metaKey)
const count = (value: number) => new Intl.NumberFormat('de-DE').format(value)

interface Props {
  original: string
  inputError: string | null
  mode: PriorityMode
  busy: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
  onChange(value: string): void
  onModeChange(mode: PriorityMode): void
  onAnalyze(): void
}

export function PromptCard({ original, inputError, mode, busy, inputRef, onChange, onModeChange, onAnalyze }: Props) {
  const canAnalyze = Boolean(original.trim()) && !inputError && !busy
  return <section className="card prompt-card" aria-labelledby="input-title">
    <div className="card-heading"><div><span className="step-number">01</span><h2 id="input-title">Originalprompt</h2></div><span className="tiny-label">DEIN AUSGANGSPUNKT</span></div>
    <label className="visually-hidden" htmlFor="original-prompt">Originalprompt</label>
    <textarea ref={inputRef} id="original-prompt" className="prompt-input" value={original} dir="auto" spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => { if (isShortcut(event)) { event.preventDefault(); if (canAnalyze) onAnalyze() } }}
      placeholder={'Was möchtest du erreichen?\n\nSchreib deine Aufgabe so auf, wie sie dir gerade einfällt.'} aria-describedby="input-help input-validation" />
    <div className="input-meta"><span id="input-help">Deutsch oder Englisch · Strg+Enter analysiert</span><span className={inputError ? 'text-error' : ''}>{count(Array.from(original).length)} / {count(MAX_PROMPT_CODEPOINTS)}</span></div>
    <div id="input-validation" className="input-validation" role={inputError ? 'alert' : undefined}>{inputError}</div>
    <div className="prompt-controls">
      <div className="priority-area">
        <span className="control-label" id="priority-label">Deine Priorität</span>
        <div className="segmented-control" role="group" aria-labelledby="priority-label">
          {MODES.map((value) => <button key={value} type="button" aria-pressed={mode === value} className={mode === value ? 'active' : ''} disabled={busy} onClick={() => onModeChange(value)}>{MODE_LABELS[value]}</button>)}
        </div>
        <p className="mode-hint">{MODE_HINTS[mode]}</p>
      </div>
      <div className="prompt-actions">
        <button type="button" className="primary-button" onClick={onAnalyze} disabled={!canAnalyze}><Icon name="spark" size={17} />{busy ? 'Wird analysiert …' : 'Analysieren'}<Icon name="arrow" size={17} /></button>
        <label className="example-label" htmlFor="example-select">Oder starte mit einem Beispiel</label>
        <select id="example-select" value="" onChange={(event) => { const example = EXAMPLES.find((item) => item.id === event.target.value); if (example) onChange(example.text) }}>
          <option value="" disabled>Beispiel auswählen</option>
          {EXAMPLES.map((example) => <option key={example.id} value={example.id}>{example.label}</option>)}
        </select>
      </div>
    </div>
  </section>
}
