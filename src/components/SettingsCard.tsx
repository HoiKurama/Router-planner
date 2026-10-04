import { useRef } from 'react'
import { STORAGE_KEY, type Settings } from '../app/storage'
import type { ProviderId, UsagePool } from '../domain/types'
import { Icon } from './Icon'

const DOCUMENTATION_HINT: Record<UsagePool['usageDocumentation'], string> = {
  ordinal: 'Verbrauch nur als Reihenfolge dokumentiert',
  estimates: 'Verbrauch mit Schätzwerten dokumentiert',
  none: 'Verbrauch nicht dokumentiert',
}

interface Props {
  settings: Settings
  pools: UsagePool[]
  notice: string | null
  onChange(settings: Settings): void
  onExport(): void
  onImport(file: File): void
}

export function SettingsCard({ settings, pools, notice, onChange, onExport, onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const togglePool = (id: string, on: boolean) => onChange({
    ...settings, enabledPools: pools.map((pool) => pool.id).filter((poolId) => poolId === id ? on : settings.enabledPools.includes(poolId)),
  })
  return <section className="card side-card settings-card" aria-labelledby="settings-title">
    <div className="card-heading"><div><Icon name="settings" size={16} /><h2 id="settings-title">Einstellungen</h2></div></div>
    <fieldset className="pool-options"><legend>Meine Abos</legend>
      {pools.map((pool) => <label key={pool.id} className="check-row">
        <input type="checkbox" checked={settings.enabledPools.includes(pool.id)} onChange={(event) => togglePool(pool.id, event.target.checked)} />
        <span>{pool.label}<small>{DOCUMENTATION_HINT[pool.usageDocumentation]}</small></span>
      </label>)}
    </fieldset>
    <label className="field-row" htmlFor="preferred-provider">Bevorzugter Anbieter
      <select id="preferred-provider" value={settings.preferredProvider ?? ''} onChange={(event) => onChange({ ...settings, preferredProvider: (event.target.value || null) as ProviderId | null })}>
        <option value="">Keiner</option><option value="anthropic">Claude</option><option value="openai">ChatGPT</option>
      </select>
    </label>
    <p className="small-note">Reichen Einstellungen beider Anbieter, gewinnt der bevorzugte.</p>
    <label className="check-row"><input type="checkbox" checked={settings.saveHistory} onChange={(event) => onChange({ ...settings, saveHistory: event.target.checked })} /><span>Verlauf speichern</span></label>
    <div className="data-actions">
      <button type="button" className="secondary-button" onClick={onExport}><Icon name="download" size={14} /> Export als JSON</button>
      <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}><Icon name="upload" size={14} /> Import aus JSON</button>
      <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-label="JSON-Datei importieren"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} />
    </div>
    {notice && <p className="storage-notice" role="status">{notice}</p>}
    <p className="small-note">Verlauf und Einstellungen liegen nur in diesem Browser (localStorage, Schlüssel <code>{STORAGE_KEY}</code>).</p>
  </section>
}
