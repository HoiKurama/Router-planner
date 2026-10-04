import type { ModelCatalog, OptionStatus, RoutingDecision } from '../domain/types'
import { formatScore, percent } from '../router/explain'
import { Icon } from './Icon'

const STATUS_LABELS: Record<OptionStatus, string> = {
  selected: 'Gewählt',
  candidate: 'Ausreichend',
  dominated: 'Ausreichend, aber schwerer',
  below: 'Unter der Schwelle',
  excluded: 'Ausgeschlossen',
}

/** The full reasoning: thresholds, every setting with its score, and where the numbers come from. */
export function RouteDetails({ decision, catalog }: { decision: RoutingDecision; catalog: ModelCatalog }) {
  const metric = decision.metric
  return <details className="routing-details"><summary><Icon name="info" size={16} /> Warum diese Empfehlung?</summary>
    {decision.details.length > 0 && <ul className="reason-list">{decision.details.map((line, i) => <li key={i}>{line}</li>)}</ul>}
    {metric && decision.considered.length > 0 && <>
      <h3>Alle Einstellungen</h3>
      <div className="table-scroll"><table>
        <thead><tr><th>Modell · Einstellung</th><th>Kontingent</th><th>{catalog.metrics[metric].label}</th><th>Anteil</th><th>Ergebnis</th></tr></thead>
        <tbody>{decision.considered.map((option) => <tr key={option.id} className={option.status === 'selected' ? 'is-selected' : undefined}>
          <td>{option.family.name}<small className="table-level">{option.setting.label}</small></td>
          <td>{option.pool.label}</td>
          <td>{formatScore(metric, option.score)}{option.setting.aa.estimated && <small className="table-level">geschätzt</small>}</td>
          <td>{option.share === null ? '–' : percent(option.share)}</td>
          <td>{STATUS_LABELS[option.status]}{option.notes.map((note, i) => <small className="table-level" key={i}>{note}</small>)}</td>
        </tr>)}</tbody>
      </table></div>
    </>}
    <p className="small-note">Benchmarks: Artificial Analysis, übernommen am {catalog.retrieved} (models.json, Version {catalog.version}). Verbrauch: nur die offiziellen Hilfeseiten von Anthropic und OpenAI. Die Werte sind Durchschnitte über Testaufgaben, keine Erfolgsgarantie für deinen Prompt.</p>
    <ul className="source-list">{Object.entries(catalog.sources).map(([id, source]) => <li key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> <small>abgerufen {source.retrieved}</small></li>)}</ul>
  </details>
}
