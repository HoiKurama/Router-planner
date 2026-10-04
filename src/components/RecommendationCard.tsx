import { MODE_LABELS, PROVIDER_LABELS, TOOL_LABELS } from '../data/policy'
import type { ModelCatalog, PriorityMode, RouteOption, RoutingDecision } from '../domain/types'
import { formatScore, percent } from '../router/explain'
import { Icon } from './Icon'
import { RouteDetails } from './RouteDetails'

interface Props {
  decision: RoutingDecision | null
  catalog: ModelCatalog
  mode: PriorityMode
  stale: boolean
  busy: boolean
}

const host = (url: string) => { try { return new URL(url).host } catch { return url } }

function statusLabel(decision: RoutingDecision) {
  if (!decision.selected) return 'Keine Empfehlung'
  if (decision.fallback) return 'Fallback-Empfehlung'
  return decision.status === 'provisional' ? 'Vorläufige Empfehlung' : 'Empfehlung'
}

export function RecommendationCard({ decision, catalog, mode, stale, busy }: Props) {
  if (busy) {
    return <section className="card recommendation-card is-loading" aria-label="Empfehlung wird berechnet" aria-busy="true">
      <div className="skeleton-block wide" /><div className="skeleton-block" /><div className="skeleton-block short" />
    </section>
  }
  if (!decision) {
    return <section className="card recommendation-placeholder" aria-label="Empfehlung">
      <div className="route-symbol"><Icon name="arrow" size={23} /></div>
      <div><h2>{stale ? 'Empfehlung wartet auf Neubewertung' : 'Welches Modell, welche Stufe?'}</h2>
        <p>{stale ? 'Übernimm deine Änderungen, um die Empfehlung zu aktualisieren.' : 'Nach der Analyse siehst du hier das sparsamste Modell aus deinen Abos, das für die Aufgabe reicht.'}</p></div>
      <span className="tiny-label">{MODE_LABELS[mode].toUpperCase()}</span>
    </section>
  }
  const selected = decision.selected
  const warning = decision.status !== 'recommended'
  return <section className={`card recommendation-card ${selected ? `provider-${selected.pool.provider}` : 'no-selection'}`} aria-labelledby="recommendation-title">
    <div className="recommendation-top">
      <div>
        <span className="eyebrow"><span className="live-dot" /> DEINE EMPFEHLUNG{selected && <span className={`provider-chip ${selected.pool.provider}`}>{PROVIDER_LABELS[selected.pool.provider]}</span>}</span>
        <h2 id="recommendation-title">{selected?.family.name ?? 'Keine belastbare Empfehlung'}</h2>
        {selected ? <p className="setting-label">{selected.setting.label} <span>· {selected.pool.label}</span></p>
          : <p className="model-source">Ergänze die entscheidenden Angaben und analysiere erneut.</p>}
      </div>
      {selected && decision.metric && <div className="recommendation-score">
        <strong>{formatScore(decision.metric, selected.score)}</strong>
        <span>{catalog.metrics[decision.metric].label}{selected.share !== null && ` · ${percent(selected.share)} vom besten Wert`}</span>
      </div>}
    </div>
    <div className="recommendation-status">
      <span className={`status-pill ${warning ? 'warning' : ''}`}><Icon name={warning ? 'info' : 'check'} size={14} />{statusLabel(decision)}</span>
      <span className="mode-note">Priorität: {MODE_LABELS[mode]}</span>
    </div>
    <p className="explanation">{decision.explanation}</p>
    {selected && <SelectionFacts selected={selected} />}
    {decision.caveats.length > 0 && <div className="caveat-box"><Icon name="info" size={17} /><div>{decision.caveats.map((caveat, i) => <p key={i}>{caveat}</p>)}</div></div>}
    {decision.alternatives.length > 0 && <Alternatives decision={decision} />}
    {selected && decision.workflow && decision.workflow.steps.length > 0 && <div className="workflow-steps" aria-label="Empfohlene Arbeitsschritte">
      {decision.workflow.steps.map((step, i) => <span key={`${i}-${step}`}>{i > 0 && <Icon name="chevron" size={13} />}<span className="workflow-step">{step}</span></span>)}
    </div>}
    {selected && decision.workflow && decision.workflow.tools.length > 0 && <p className="small-note">Benötigt: {decision.workflow.tools.map((tool) => TOOL_LABELS[tool]).join(', ')}. Schalte das in der App ein; diese Seite prüft nicht, welche Werkzeuge ein Modell dort anbietet.</p>}
    <RouteDetails decision={decision} catalog={catalog} />
  </section>
}

function SelectionFacts({ selected }: { selected: RouteOption }) {
  const { family, pool } = selected
  return <div className="route-meta">
    <div><span>SO STELLST DU ES EIN</span><strong>{family.howTo}</strong>
      <a className="text-link" href={pool.appUrl} target="_blank" rel="noreferrer">{host(pool.appUrl)} öffnen <Icon name="external" size={13} /></a></div>
    <div><span>VERBRAUCH LAUT ANBIETER</span><strong>{family.usage.text}</strong>{family.usage.estimate && <small>Schätzung: {family.usage.estimate}</small>}</div>
  </div>
}

function Alternatives({ decision }: { decision: RoutingDecision }) {
  return <div className="alternatives"><span className="tiny-label">EBENFALLS AUSREICHEND</span>
    <ul>{decision.alternatives.map((option) => <li className="alternative" key={option.id}>
      <span><span className={`provider-dot ${option.pool.provider}`} aria-hidden="true" />{option.family.name} · {option.setting.label}<small>{option.pool.label}{option.setting.availability !== 'yes' && ' · Verfügbarkeit unklar'}</small></span>
      {decision.metric && <strong>{formatScore(decision.metric, option.score)}</strong>}
    </li>)}</ul>
  </div>
}
