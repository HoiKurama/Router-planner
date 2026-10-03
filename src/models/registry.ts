import { CAPABILITY_IDS } from '../domain/types'

const isRating = (value: unknown) => value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const validTools = new Set(['webSearch', 'webRead', 'fileRead', 'fileWrite', 'codeExecution'])

/** Validate data without coercion, including malformed values from future loaders. */
export function validateRegistry(registry: unknown): string[] {
  const errors: string[] = []
  if (!isRecord(registry) || !Array.isArray(registry.models) || !Array.isArray(registry.workflows)) return ['Ungültige Katalogstruktur.']
  if (!isString(registry.version)) errors.push('Die Katalogversion fehlt.')
  const modelIds = new Set<string>()
  const workflowIds = new Set<string>()
  for (const workflow of registry.workflows) {
    if (!isRecord(workflow)) { errors.push('Ungültiger Workflow.'); continue }
    if (!isString(workflow.id) || workflowIds.has(workflow.id)) errors.push('Workflow-IDs müssen eindeutig sein.')
    else workflowIds.add(workflow.id)
    if (!isString(workflow.label)) errors.push('Workflow-Bezeichnung fehlt.')
    if (!Array.isArray(workflow.tools) || workflow.tools.some((tool: unknown) => typeof tool !== 'string' || !validTools.has(tool))) errors.push(`Ungültige Tools: ${workflow.id}`)
  }
  for (const model of registry.models) {
    if (!isRecord(model)) { errors.push('Ungültiges Modellprofil.'); continue }
    if (!isString(model.id) || modelIds.has(model.id)) errors.push('Modell-IDs müssen eindeutig sein.')
    else modelIds.add(model.id)
    if (!isString(model.name) || !isString(model.providerId) || !isString(model.version) || !['illustrative', 'measured', 'documented'].includes(String(model.provenance))) errors.push(`Metadaten fehlen: ${model.id}`)
    if (!['active', 'disabled'].includes(String(model.status))) errors.push(`Ungültiger Katalogstatus: ${model.id}`)
    if (!isRecord(model.capabilities) || !isRecord(model.capabilities.ratings)) { errors.push(`Fähigkeiten fehlen: ${model.id}`); continue }
    const capabilities = model.capabilities
    const ratings = capabilities.ratings as Record<string, unknown>
    for (const id of CAPABILITY_IDS) {
      if (!isRating(ratings[id])) errors.push(`Ungültige Bewertung ${model.id}/${id}`)
    }
    for (const id of Object.keys(ratings)) {
      if (!(CAPABILITY_IDS as readonly string[]).includes(id)) errors.push(`Unbekannte Fähigkeit ${model.id}/${id}`)
    }
    if (capabilities.toolCalling !== true && capabilities.toolCalling !== false && capabilities.toolCalling !== null) errors.push(`Ungültige Tool-Unterstützung: ${model.id}`)
    if (!Array.isArray(capabilities.inputModalities) || !capabilities.inputModalities.length || capabilities.inputModalities.some((item: unknown) => !['text', 'image', 'audio'].includes(String(item)))) errors.push(`Ungültige Modalitäten: ${model.id}`)
    const window = capabilities.contextWindowTokens
    if (window !== null && (typeof window !== 'number' || !Number.isInteger(window) || window <= 0)) errors.push(`Ungültiges Kontextfenster: ${model.id}`)
    if (!Array.isArray(model.variants) || !model.variants.length) { errors.push(`Varianten fehlen: ${model.id}`); continue }
    const variantIds = new Set<string>()
    for (const variant of model.variants) {
      if (!isRecord(variant)) { errors.push(`Ungültige Variante: ${model.id}`); continue }
      if (!isString(variant.id) || variantIds.has(variant.id)) errors.push(`Varianten-IDs müssen eindeutig sein: ${model.id}`)
      else variantIds.add(variant.id)
      if (!['standard', 'low', 'medium', 'high'].includes(String(variant.reasoningLevel))) errors.push(`Ungültiges Reasoning-Level: ${model.id}`)
      if (!isRating(variant.speed) || !isRating(variant.costEfficiency)) errors.push(`Ungültige Betriebsbewertung: ${model.id}/${variant.id}`)
      if (variant.ratings !== undefined && !isRecord(variant.ratings)) { errors.push(`Ungültige Variantenfähigkeiten: ${model.id}`); continue }
      for (const [id, value] of Object.entries((variant.ratings ?? {}) as Record<string, unknown>)) {
        if (!(CAPABILITY_IDS as readonly string[]).includes(id) || !isRating(value)) errors.push(`Ungültige Variantenfähigkeit: ${model.id}/${id}`)
      }
    }
  }
  return errors
}
