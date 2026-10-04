import rawCatalog from '../../models.json'
import type { ModelCatalog } from '../domain/types'
import { validateCatalog } from './validate'

/**
 * The model catalog from models.json in the project root. It is bundled at build time:
 * the app never fetches benchmark data at runtime. Edit the JSON and rebuild to update it.
 */
export const CATALOG_ERRORS = validateCatalog(rawCatalog)
export const CATALOG = rawCatalog as unknown as ModelCatalog
