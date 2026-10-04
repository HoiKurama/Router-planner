import type { KeyboardEvent, RefObject } from 'react'
import type { ProviderId } from '../domain/types'
import { VARIANT_IDS, type PromptVariant, type VariantId } from '../optimizer/variants'
import { Icon } from './Icon'

interface Props {
  variants: PromptVariant[] | null
  active: VariantId
  text: string
  recommendedProvider: ProviderId | null
  editing: boolean
  dirty: boolean
  edited: boolean
  copyStatus: string
  suggestions: string[]
  outputRef: RefObject<HTMLTextAreaElement | null>
  onSelect(id: VariantId): void
  onEdit(): void
  onDraft(text: string): void
  onReevaluate(): void
  onCopy(): void
}

const isShortcut = (event: KeyboardEvent) => event.key === 'Enter' && (event.ctrlKey || event.metaKey)

export function VariantsCard(props: Props) {
  const { variants, active, text, recommendedProvider, editing, dirty, edited, copyStatus, suggestions, outputRef } = props
  const variant = variants?.find((item) => item.id === active) ?? null
  const locked = editing || dirty
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = VARIANT_IDS.indexOf(active) + (event.key === 'ArrowRight' ? 1 : -1)
    const next = VARIANT_IDS[(index + VARIANT_IDS.length) % VARIANT_IDS.length]
    props.onSelect(next)
    document.getElementById(`variant-tab-${next}`)?.focus()
  }
  return <section className="card variants-card" aria-labelledby="output-title">
    <div className="card-heading"><div><span className="step-number">03</span><h2 id="output-title">Prompt-Varianten</h2></div><span className="tiny-label">ORIGINAL BLEIBT WÖRTLICH</span></div>
    {!variants || !variant ? <div className="empty-panel">
      <div className="empty-icon"><Icon name="edit" size={26} /></div>
      <h3>Drei Fassungen, ein Original</h3>
      <p>Für Claude mit XML-Tags, neutral und für ChatGPT mit Markdown. Dein Text bleibt in jeder Fassung unverändert.</p>
    </div> : <>
      <div className="variant-tabs" role="tablist" aria-label="Prompt-Varianten">
        {variants.map((item) => <button key={item.id} id={`variant-tab-${item.id}`} type="button" role="tab" aria-selected={item.id === active} aria-controls="variant-panel"
          tabIndex={item.id === active ? 0 : -1} disabled={locked && item.id !== active} className={item.id === active ? 'active' : ''}
          onClick={() => props.onSelect(item.id)} onKeyDown={onTabKey}>
          {item.label}{item.provider && item.provider === recommendedProvider && <span className="match-badge">passt zur Empfehlung</span>}
        </button>)}
      </div>
      <div id="variant-panel" role="tabpanel" aria-labelledby={`variant-tab-${active}`} className="variant-panel">
        <p className="variant-target">{variant.target}</p>
        <div className={`preservation-label ${edited || dirty ? 'manual' : ''}`}>
          <Icon name={edited || dirty ? 'edit' : 'check'} size={14} />
          {edited || dirty ? 'Manuell bearbeitet' : !variant.preservationPassed ? 'Original als sichere Rückgabe' : variant.changed ? 'Originaltext vollständig erhalten' : 'Unverändert: braucht keinen Rahmen'}
        </div>
        <label className="visually-hidden" htmlFor="optimized-prompt">Optimierter Prompt</label>
        <textarea id="optimized-prompt" ref={outputRef} className={`optimized-text ${editing ? 'is-editing' : ''}`} value={text} readOnly={!editing} spellCheck={false} dir="auto"
          onKeyDown={(event) => { if (editing && isShortcut(event)) { event.preventDefault(); props.onReevaluate() } }}
          onChange={(event) => props.onDraft(event.target.value)} />
        {editing ? <button type="button" className="secondary-button save-button" onClick={props.onReevaluate}>Übernehmen und neu bewerten <Icon name="arrow" size={16} /></button>
          : <div className="output-actions">
            <button type="button" className="secondary-button" onClick={props.onCopy} disabled={!text.trim()}><Icon name="copy" size={15} /> Prompt kopieren</button>
            <button type="button" className="text-button" onClick={props.onEdit}><Icon name="edit" size={15} /> Bearbeiten</button>
          </div>}
        <p className="copy-status" role="status">{copyStatus}</p>
        {suggestions.length > 0 && !edited && <details className="suggestions"><summary>Verbesserungsvorschläge <span>{suggestions.length}</span></summary>
          <ul>{suggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}</ul><p>Übernimm passende Angaben über „Bearbeiten“.</p></details>}
      </div>
    </>}
  </section>
}
