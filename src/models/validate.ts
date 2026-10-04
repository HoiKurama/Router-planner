const METRICS = ['intelligence', 'coding', 'math', 'longContext'] as const
const PROVIDERS = ['anthropic', 'openai']
const DOCUMENTATION = ['ordinal', 'estimates', 'none']
const AVAILABILITY = ['yes', 'unclear']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
const isUrl = (value: unknown) => typeof value === 'string' && /^https:\/\/\S+$/.test(value)
const isScore = (value: unknown, max: number) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max)
const isAmount = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)

/**
 * Checks models.json without changing it. Returns readable German errors; an empty list means the file is usable.
 * The app refuses to route with an invalid catalog instead of guessing around broken values.
 */
export function validateCatalog(catalog: unknown): string[] {
  if (!isRecord(catalog) || !isRecord(catalog.sources) || !isRecord(catalog.metrics) || !Array.isArray(catalog.pools) || !Array.isArray(catalog.models)) {
    return ['models.json: Grundstruktur ungültig (sources, metrics, pools und models werden gebraucht).']
  }
  const errors: string[] = []
  if (!isText(catalog.version)) errors.push('models.json: "version" fehlt.')
  if (!isDate(catalog.retrieved)) errors.push('models.json: "retrieved" muss ein Datum im Format JJJJ-MM-TT sein.')
  const sources = catalog.sources
  for (const [id, source] of Object.entries(sources)) {
    if (!isRecord(source) || !isText(source.title) || !isUrl(source.url) || !isDate(source.retrieved)) errors.push(`Quelle "${id}": title, https-URL und Abrufdatum (JJJJ-MM-TT) werden gebraucht.`)
  }
  const knownSource = (id: unknown) => typeof id === 'string' && id in sources
  for (const metric of METRICS) {
    const info = catalog.metrics[metric]
    if (!isRecord(info) || !isText(info.label) || !isText(info.aaField) || !knownSource(info.source)) errors.push(`Metrik "${metric}": label, aaField und eine bekannte Quelle werden gebraucht.`)
  }

  const pools = new Map<string, Record<string, unknown>>()
  for (const pool of catalog.pools) {
    if (!isRecord(pool) || !isText(pool.id)) { errors.push('Ein Kontingent (pools) hat keine ID.'); continue }
    if (pools.has(pool.id)) errors.push(`Kontingent "${pool.id}" ist doppelt.`)
    pools.set(pool.id, pool)
    if (!PROVIDERS.includes(String(pool.provider))) errors.push(`Kontingent "${pool.id}": provider muss anthropic oder openai sein.`)
    if (pool.kind !== 'chat' && pool.kind !== 'workspace') errors.push(`Kontingent "${pool.id}": kind muss chat oder workspace sein.`)
    if (!DOCUMENTATION.includes(String(pool.usageDocumentation))) errors.push(`Kontingent "${pool.id}": usageDocumentation muss ordinal, estimates oder none sein.`)
    if (!isText(pool.label) || !isText(pool.plan) || !isText(pool.usageSummary) || !isUrl(pool.appUrl) || !knownSource(pool.source)) errors.push(`Kontingent "${pool.id}": label, plan, usageSummary, appUrl und eine bekannte Quelle werden gebraucht.`)
  }
  if (!pools.size) errors.push('models.json enthält kein Kontingent.')

  const familyIds = new Set<string>()
  for (const family of catalog.models) {
    if (!isRecord(family) || !isText(family.id)) { errors.push('Ein Modell hat keine ID.'); continue }
    const at = `Modell "${family.id}"`
    if (familyIds.has(family.id)) errors.push(`${at} ist doppelt.`)
    familyIds.add(family.id)
    if (!isText(family.name) || !isText(family.howTo)) errors.push(`${at}: name und howTo werden gebraucht.`)
    if (typeof family.pool !== 'string' || !pools.has(family.pool)) errors.push(`${at}: unbekanntes Kontingent "${String(family.pool)}".`)
    if (typeof family.inPlan !== 'boolean') errors.push(`${at}: inPlan muss true oder false sein.`)
    if (!Number.isInteger(family.weight) || (family.weight as number) < 1) errors.push(`${at}: weight muss eine ganze Zahl ab 1 sein.`)
    if (!isRecord(family.usage) || !isText(family.usage.text) || !(family.usage.estimate === null || isText(family.usage.estimate)) || !knownSource(family.usage.source)) {
      errors.push(`${at}: usage braucht text, estimate (Text oder null) und eine bekannte Quelle.`)
    }
    const window = family.contextWindowTokens
    if (window !== null && (!Number.isInteger(window) || (window as number) <= 0)) errors.push(`${at}: contextWindowTokens muss eine positive ganze Zahl oder null sein.`)
    if (!Array.isArray(family.settings) || !family.settings.length) { errors.push(`${at}: settings fehlen.`); continue }
    const settingIds = new Set<string>()
    for (const setting of family.settings) {
      if (!isRecord(setting) || !isText(setting.id)) { errors.push(`${at}: eine Einstellung hat keine ID.`); continue }
      const where = `${family.id}/${setting.id}`
      if (settingIds.has(setting.id)) errors.push(`Einstellung "${where}" ist doppelt.`)
      settingIds.add(setting.id)
      if (!isText(setting.label)) errors.push(`Einstellung "${where}": label fehlt.`)
      if (!Number.isInteger(setting.effortRank) || (setting.effortRank as number) < 0 || (setting.effortRank as number) > 5) errors.push(`Einstellung "${where}": effortRank muss 0 bis 5 sein.`)
      if (!AVAILABILITY.includes(String(setting.availability))) errors.push(`Einstellung "${where}": availability muss yes oder unclear sein.`)
      const aa = setting.aa
      if (!isRecord(aa) || !isText(aa.slug)) { errors.push(`Einstellung "${where}": aa.slug fehlt.`); continue }
      if (!isScore(aa.intelligence, 100)) errors.push(`Einstellung "${where}": aa.intelligence muss 0–100 oder null sein.`)
      for (const metric of ['coding', 'math', 'longContext'] as const) {
        if (!isScore(aa[metric], 1)) errors.push(`Einstellung "${where}": aa.${metric} muss 0–1 oder null sein.`)
      }
      for (const field of ['priceInput', 'priceOutput', 'speed'] as const) {
        if (!isAmount(aa[field])) errors.push(`Einstellung "${where}": aa.${field} muss eine Zahl ab 0 oder null sein.`)
      }
      if (aa.estimated !== undefined && typeof aa.estimated !== 'boolean') errors.push(`Einstellung "${where}": aa.estimated muss true oder false sein.`)
    }
  }
  return errors
}
