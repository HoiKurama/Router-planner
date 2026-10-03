/**
 * JavaScript's \b only knows ASCII letters, so "\bprüfe" never matches after "über" and
 * "\bfür\b" fails next to umlauts. rx() rewrites every \b into a Unicode-aware word boundary.
 */
const WORD = String.raw`[\p{L}\p{N}_]`
const BOUNDARY = `(?:(?<!${WORD})(?=${WORD})|(?<=${WORD})(?!${WORD}))`

/** Builds a case-insensitive Unicode regex; write \b as usual. Pass flags to override (e.g. 'u' for case-sensitive). */
export function rx(source: string, flags = 'iu'): RegExp {
  return new RegExp(source.replaceAll(String.raw`\b`, BOUNDARY), flags)
}
