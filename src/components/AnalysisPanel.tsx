import { CAPABILITY_LABELS, CATEGORY_LABELS } from '../data/policy'
import type { Demand, TaskAnalysis } from '../domain/types'
import { Icon } from './Icon'

const demandLabel: Record<Demand, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', unknown: 'Unklar' }
const boolLabel = { yes: 'Ja', no: 'Nein', unknown: 'Unklar' }

export function AnalysisPanel({ analysis, stale, edited }: { analysis: TaskAnalysis | null; stale: boolean; edited: boolean }) {
  return <section className="card analysis-panel" aria-labelledby="analysis-title">
    <div className="card-heading"><div><span className="step-number">04</span><h2 id="analysis-title">Analyse</h2></div><span className="tiny-label">AUFGABENPROFIL</span></div>
    {!analysis || stale ? <div className="empty-panel">
      <div className="empty-icon"><Icon name="scan" size={26} /></div>
      <h3>{stale ? 'Änderungen neu bewerten' : 'Was braucht deine Aufgabe?'}</h3>
      <p>{stale ? 'Die Empfehlung wird nach der Prüfung deines bearbeiteten Prompts aktualisiert.' : 'Kategorie, Komplexität und benötigte Fähigkeiten werden lokal erkannt.'}</p>
      <div className="skeleton-lines" aria-hidden="true"><span /><span /><span /></div>
    </div> : <div className="analysis-body">
      {edited && <p className="basis-label">Basis: bearbeiteter Prompt</p>}
      <div className="category-row"><span className="category-badge">{analysis.primaryCategory ? CATEGORY_LABELS[analysis.primaryCategory] : analysis.fallback ? 'Allgemein · Fallback' : 'Unklare Aufgabe'}</span><span className={`confidence ${analysis.confidence}`} title="Regel-Sicherheit: Stärke der Signale und Abstand zur nächstbesten Kategorie">{!analysis.primaryCategory ? 'Kein Regelsignal' : `${analysis.confidence === 'clear' ? 'Erkannt' : 'Unsicher'} · ${Math.round(analysis.confidenceScore * 100)} %`}</span></div>
      <p className="goal-excerpt">{analysis.goal.value ?? 'Ein konkretes Ziel fehlt noch.'}</p>
      <SignalList analysis={analysis} />
      <div className="complexity-heading"><span>Komplexität</span><strong>{analysis.complexity.value ? `${analysis.complexity.value} / 5` : 'Unklar'}</strong></div>
      <div className="complexity-meter" aria-label={`Komplexität ${analysis.complexity.value ?? 'unklar'}`}>
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= (analysis.complexity.value ?? 0) ? 'filled' : ''} />)}
      </div>
      <div className="metric-grid">
        {([['Reasoning', analysis.reasoningDemand], ['Kontext', analysis.contextDemand], ['Toolbedarf', analysis.toolDemand], ['Genauigkeit', analysis.accuracyNeed]] as const).map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{demandLabel[value]}</strong></div>)}
      </div>
      {analysis.issues.length > 0 && <div className="analysis-notes"><span className="note-title"><Icon name="info" size={15} /> Noch zu klären</span><ul>{analysis.issues.slice(0, 2).map((issue) => <li key={issue.id}>{issue.message}</li>)}</ul></div>}
      <details className="analysis-details"><summary>Analyse im Detail</summary>
        <dl className="detail-list">
          <div><dt>Mehrstufig</dt><dd>{boolLabel[analysis.multiStep]}</dd></div>
          <div><dt>Coding</dt><dd>{boolLabel[analysis.codingTask]}</dd></div>
          <div><dt>Recherche</dt><dd>{boolLabel[analysis.researchNeeded]}</dd></div>
          <div><dt>Dateizugriff</dt><dd>{boolLabel[analysis.fileAccessNeeded]}</dd></div>
          <div><dt>Dringlichkeit</dt><dd>{demandLabel[analysis.speedNeed]}</dd></div>
          <div><dt>Weitere Bereiche</dt><dd>{analysis.categories.slice(1).map((c) => CATEGORY_LABELS[c]).join(', ') || 'Keine'}</dd></div>
        </dl>
        {analysis.constraints.length > 0 && <><h4>Erkannte Anforderungen</h4><ul className="constraint-list">{analysis.constraints.slice(0, 5).map((constraint, i) => <li key={i}>{constraint.value}</li>)}</ul></>}
        <p className="small-note">Die Erkennung ist regelbasiert. Fachliche Stärken wie {CAPABILITY_LABELS.reasoning} sind von technischen Tools getrennt.</p>
      </details>
    </div>}
  </section>
}

/** The rules that fired, main category first, so the user can see why this route was chosen. */
function SignalList({ analysis }: { analysis: TaskAnalysis }) {
  const signals = [...analysis.signals]
    .sort((a, b) => Number(b.category === analysis.primaryCategory) - Number(a.category === analysis.primaryCategory) || b.strength - a.strength)
    .slice(0, 4)
  if (!signals.length) return null
  return <div className="signal-list"><span className="signal-title">Warum diese Kategorie?</span>
    <ul>{signals.map((signal) => <li key={signal.ruleId}>
      <q>{signal.excerpt}</q>
      <small>{signal.label} · {CATEGORY_LABELS[signal.category]} +{signal.strength}</small>
    </li>)}</ul>
  </div>
}
