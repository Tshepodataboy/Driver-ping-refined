/**
 * Incident location privacy helper.
 *
 * A reporter may type a precise place ("Pretoria CBD, Boom Street" or
 * "Pretoria CBD in Boom Street"). Only the area/suburb level is ever kept,
 * stored or shown to the reported driver: "Pretoria CBD".
 */

const STREET_WORDS =
  /(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|close|crescent|cres\.?|boulevard|blvd\.?|highway|hwy\.?|freeway|off-?ramp|on-?ramp|intersection|corner|cnr\.?|weg|straat|laan|plein|parking|parkade|robot|traffic light)s?\b/gi;

// "Pretoria CBD in Boom Street" / "Sandton near Gautrain station"
const DETAIL_SEPARATOR =
  /\s+(?:in|at|on|near|by|along|outside|opposite|next to|behind|@)\s+/i;

const MAX_AREA_LENGTH = 60;

/**
 * Reduces a free-text incident location to its area level only.
 * Street names, street numbers and landmark detail are dropped.
 */
export function toIncidentArea(raw?: string | null): string {
  if (!raw) return '';

  const beforeStreet = (raw.split(DETAIL_SEPARATOR)[0] || '').trim();
  const segments = beforeStreet
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  // Prefer the first segment that is not a street or a numbered address.
  const area =
    segments.find((part) => !/\d/.test(part) && !STREET_WORDS.test(part)) ||
    segments[0] ||
    beforeStreet;

  STREET_WORDS.lastIndex = 0;

  return area
    .replace(/\b\d+[a-z]?\b/gi, ' ') // house and street numbers
    .replace(STREET_WORDS, ' ') // street-type words
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ') // keep letters, digits, spaces
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-'\s]+|[-'\s]+$/g, '')
    .slice(0, MAX_AREA_LENGTH)
    .trim();
}
