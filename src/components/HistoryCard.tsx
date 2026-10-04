import { useState } from 'react'
import { filterHistory, type ProviderFilter } from '../app/history'
import type { HistoryEntry } from '../app/storage'
import { CATEGORY_LABELS, MODE_LABELS } from '../data/policy'
import type { Category } from '../domain/types'
import { Icon } from './Icon'

interface Props {
  entries: HistoryEntry[]
  saving: boolean
  busy: boolean
  onReuse(entry: HistoryEntry): void
  onClear(): void
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const formatDate = (iso: string) => dateFormat.format(new Date(iso))

export function HistoryCard({ entries, saving, busy, onReuse, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<ProviderFilter>('all')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const visible = filterHistory(entries, query, provider, category)
  return <section className="card side-card history-card" aria-labelledby="history-title">
    <div className="card-heading"><div><Icon name="history" size={16} /><h2 id="history-title">Verlauf</h2><span className="count-badge">{entries.length}</span></div>
      <button type="button" className="text-button danger" onClick={onClear} disabled={!entries.length}><Icon name="trash" size={14} /> Verlauf löschen</button></div>
    <div className="history-filters">
      <label className="search-field"><Icon name="search" size={14} /><span className="visually-hidden">Verlauf durchsuchen</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Prompt oder Modell suchen" /></label>
      <label><span className="visually-hidden">Nach Anbieter filtern</span>
        <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderFilter)}>
          <option value="all">Alle Anbieter</option><option value="anthropic">Claude</option><option value="openai">ChatGPT</option><option value="none">Ohne Empfehlung</option>
        </select></label>
      <label><span className="visually-hidden">Nach Kategorie filtern</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as Category | 'all')}>
          <option value="all">Alle Kategorien</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((id) => <option key={id} value={id}>{CATEGORY_LABELS[id]}</option>)}
        </select></label>
    </div>
    {!entries.length ? <p className="side-empty">{saving ? 'Noch keine Einträge. Jede Analyse landet hier und lässt sich mit einem Klick wiederholen.' : 'Der Verlauf ist ausgeschaltet. Du kannst ihn in den Einstellungen einschalten.'}</p>
      : !visible.length ? <p className="side-empty">Keine Treffer für diese Suche.</p>
        : <ul className="history-list">{visible.map((entry) => <li key={entry.id}>
          <button type="button" className="history-item" disabled={busy} onClick={() => onReuse(entry)} title="Prompt übernehmen und erneut analysieren">
            <span className="history-meta"><span className={`provider-dot ${entry.provider ?? 'none'}`} aria-hidden="true" />
              <strong>{entry.modelName ? `${entry.modelName} · ${entry.settingLabel}` : 'Keine Empfehlung'}</strong>
              <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></span>
            <span className="history-prompt">{entry.prompt}</span>
            <span className="history-tags">{entry.category ? CATEGORY_LABELS[entry.category] : entry.fallback ? 'Allgemein' : 'Unklar'} · {MODE_LABELS[entry.mode]}{entry.status === 'provisional' ? ' · vorläufig' : ''}</span>
          </button>
        </li>)}</ul>}
    {!saving && entries.length > 0 && <p className="small-note">Speichern ist aus: Neue Analysen kommen nicht mehr dazu. Der bestehende Verlauf bleibt, bis du ihn löschst.</p>}
  </section>
}
