import { summarizeUsage } from '../app/history'
import type { HistoryEntry } from '../app/storage'
import type { UsagePool } from '../domain/types'
import { Icon } from './Icon'

const share = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0

/** How often each provider was recommended in the stored history. */
export function UsageCard({ entries, pools }: { entries: HistoryEntry[]; pools: UsagePool[] }) {
  const usage = summarizeUsage(entries, pools)
  const routed = usage.anthropic + usage.openai
  return <section className="card side-card usage-card" aria-labelledby="usage-title">
    <div className="card-heading"><div><Icon name="chart" size={16} /><h2 id="usage-title">Empfehlungen im Überblick</h2></div></div>
    {!usage.total ? <p className="side-empty">Sobald du Prompts analysierst, siehst du hier, wie oft Claude und wie oft ChatGPT empfohlen wurde.</p> : <>
      <div className="usage-split" role="img" aria-label={`Claude ${usage.anthropic}, ChatGPT ${usage.openai}, ohne Empfehlung ${usage.none}`}>
        {usage.anthropic > 0 && <span className="segment anthropic" style={{ flexGrow: usage.anthropic }} />}
        {usage.openai > 0 && <span className="segment openai" style={{ flexGrow: usage.openai }} />}
        {usage.none > 0 && <span className="segment none" style={{ flexGrow: usage.none }} />}
      </div>
      <dl className="usage-legend">
        <div><dt><span className="provider-dot anthropic" aria-hidden="true" />Claude</dt><dd>{usage.anthropic} <small>{share(usage.anthropic, routed)} %</small></dd></div>
        <div><dt><span className="provider-dot openai" aria-hidden="true" />ChatGPT</dt><dd>{usage.openai} <small>{share(usage.openai, routed)} %</small></dd></div>
        {usage.none > 0 && <div><dt><span className="provider-dot none" aria-hidden="true" />Ohne Empfehlung</dt><dd>{usage.none}</dd></div>}
      </dl>
      <ul className="pool-bars">{usage.pools.map(({ pool, count }) => <li key={pool.id}>
        <span>{pool.label}</span><strong>{count}</strong>
        <span className="pool-bar" aria-hidden="true"><span className={pool.provider} style={{ width: `${share(count, usage.total)}%` }} /></span>
      </li>)}</ul>
      <p className="small-note">Zählt Empfehlungen aus deinem Verlauf ({usage.total} {usage.total === 1 ? 'Eintrag' : 'Einträge'}), nicht deinen tatsächlichen Verbrauch in den Apps.</p>
    </>}
  </section>
}
