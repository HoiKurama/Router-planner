import { MODE_LABELS, TOOL_LABELS } from '../data/policy'
import type { PriorityMode, ReasoningLevel, RoutingDecision, RoutingScore } from '../domain/types'
import { Icon } from './Icon'

const levelLabel: Record<ReasoningLevel, string> = { standard: 'Standard', low: 'Niedrig', medium: 'Mittel', high: 'Hoch' }
const format = (value: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)
const scoreLabel = (candidate: RoutingScore) => candidate.lower === candidate.upper ? format(candidate.lower) : `${format(candidate.lower)}–${format(candidate.upper)}`

export function Recommendation({ decision, mode, stale }: { decision: RoutingDecision | null; mode: PriorityMode; stale: boolean }) {
  if (!decision) return <section className="recommendation-placeholder" aria-label="Empfehlung"><div className="route-symbol"><Icon name="arrow" size={23} /></div><div><h2>{stale ? 'Empfehlung wartet auf Neubewertung' : 'Der passende Weg für deine Aufgabe'}</h2><p>{stale ? 'Übernimm deine Änderungen, um das Routing zu aktualisieren.' : 'Nach der Analyse siehst du Modell, Reasoning und Workflow an einem Ort.'}</p></div><span className="tiny-label">{MODE_LABELS[mode].toUpperCase()}</span></section>

  const selected = decision.selected
  const provisional = decision.status === 'provisional'
  return <section className={`recommendation ${!selected ? 'no-selection' : ''}`} aria-labelledby="recommendation-title">
    <div className="recommendation-top">
      <div><span className="eyebrow"><span className="live-dot" /> DEINE EMPFEHLUNG</span><h2 id="recommendation-title">{selected?.model.name ?? 'Keine belastbare Empfehlung'}</h2><p className="model-source">{selected ? 'Demo-Katalog · fiktives Modellprofil' : 'Ergänze die entscheidenden Angaben und analysiere erneut.'}</p></div>
      {selected && <div className="recommendation-score"><strong>{scoreLabel(selected)}<small>/100</small></strong><span>Heuristische Passung</span></div>}
    </div>
    <div className="recommendation-status"><span className={`status-pill ${provisional || !selected ? 'warning' : ''}`}><Icon name={provisional || !selected ? 'info' : 'check'} size={14} />{!selected ? 'Keine Auswahl' : decision.fallback ? 'Fallback-Empfehlung' : provisional ? 'Vorläufige Empfehlung' : 'Passend im Demo-Katalog'}</span><span className="mode-note">Priorität: {MODE_LABELS[mode]}</span></div>
    {selected && <div className="route-meta"><div><span>WORKFLOW</span><strong>{selected.workflow.profile.label}</strong></div><div><span>REASONING</span><strong>{levelLabel[selected.variant.reasoningLevel]}{selected.variant.reasoningLevel === 'standard' && <small> · nicht separat einstellbar</small>}</strong></div></div>}
    <ul className="reason-list">{decision.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
    {selected && <div className="workflow-steps" aria-label="Empfohlene Arbeitsschritte">{selected.workflow.steps.map((step, i) => <span key={`${i}-${step}`}>{i > 0 && <Icon name="chevron" size={13} />}<span className="workflow-step">{step}</span></span>)}</div>}
    {decision.caveats.length > 0 && <div className="caveat-box"><Icon name="info" size={17} /><div>{decision.caveats.map((caveat, i) => <p key={i}>{caveat}</p>)}</div></div>}
    {provisional && decision.alternatives.length > 0 && <Alternatives candidates={decision.alternatives} />}
    <details className="routing-details"><summary><Icon name="info" size={16} /> Warum diese Empfehlung?</summary>
      {selected && <><h3>Beiträge zum Score</h3><div className="table-scroll"><table><thead><tr><th>Kriterium</th><th>Bewertung</th><th>Gewicht</th><th>Beitrag</th></tr></thead><tbody>{selected.contributions.filter((c) => c.weight > 0).map((c) => <tr key={c.id}><td>{c.label}</td><td>{c.rating === null ? 'Unbekannt' : `${c.rating}/4`}</td><td>{format(c.weight * 100)} %</td><td>{c.lowerPoints === c.upperPoints ? format(c.lowerPoints) : `${format(c.lowerPoints)}–${format(c.upperPoints)}`}</td></tr>)}</tbody></table></div>
        {selected.workflow.tools.length > 0 && <p className="small-note">Benötigte Tools: {selected.workflow.tools.map((tool) => TOOL_LABELS[tool]).join(', ')}. Der Workflow wird hier nicht ausgeführt.</p>}
      </>}
      {!provisional && decision.alternatives.length > 0 && <Alternatives candidates={decision.alternatives} />}
      {decision.considered.length > 0 && <><h3>Kandidaten und Eignung</h3><div className="table-scroll"><table><thead><tr><th>Modell / Level</th><th>Passung</th><th>Eignung</th></tr></thead><tbody>{decision.considered.map((c) => <tr key={c.candidateId}><td>{c.model.name}<small className="table-level">{levelLabel[c.variant.reasoningLevel]}</small></td><td>{scoreLabel(c)}</td><td>{c.eligibility === 'eligible' ? 'Geprüft' : c.eligibility === 'conditional' ? 'Ungeprüft' : 'Ausgeschlossen'}{c.exclusions.map((reason, i) => <small className="table-level" key={i}>{reason}</small>)}</td></tr>)}</tbody></table></div></>}
      <p className="small-note">Die Bewertungen sind illustrative Daten, keine Benchmarks oder Erfolgswahrscheinlichkeiten. Reale Verfügbarkeit und Kontextpassung sind ohne entsprechende Daten ungeprüft. Gleichstände werden stabil über Qualität, Geschwindigkeit, Kosteneffizienz und IDs aufgelöst.</p>
    </details>
  </section>
}

function Alternatives({ candidates }: { candidates: RoutingScore[] }) {
  return <div className="alternatives"><span className="tiny-label">ALTERNATIVEN</span><div>{candidates.map((candidate) => <div className="alternative" key={candidate.candidateId}><span>{candidate.model.name}<small>{candidate.workflow.profile.label} · {levelLabel[candidate.variant.reasoningLevel]}</small></span><strong>{scoreLabel(candidate)}<small>/100</small></strong></div>)}</div></div>
}
