import { AppError } from '../domain/errors'
import { fetchJsonDeduped } from './http'

export const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search'

export interface GeocodingResult {
  id: number
  name: string
  /** Nombre ya formateado: "Madrid, Comunidad de Madrid, España". */
  label: string
  lat: number
  lon: number
  elevation: number | null
  country: string | null
  admin1: string | null
}

export function buildGeocodingUrl(query: string, count = 8): string {
  const params = new URLSearchParams()
  params.set('name', query.trim())
  params.set('count', String(count))
  params.set('language', 'es')
  params.set('format', 'json')
  return `${GEOCODING_BASE}?${params.toString()}`
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

export function formatPlaceLabel(r: {
  name: string
  admin1: string | null
  country: string | null
}): string {
  return [r.name, r.admin1, r.country].filter(Boolean).join(', ')
}

export function parseGeocodingResponse(json: unknown): GeocodingResult[] {
  const results = (json as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []
  const out: GeocodingResult[] = []
  for (const raw of results) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const lat = typeof r.latitude === 'number' ? r.latitude : null
    const lon = typeof r.longitude === 'number' ? r.longitude : null
    const name = str(r.name)
    if (lat === null || lon === null || name === null) continue
    const country = str(r.country)
    const admin1 = str(r.admin1)
    out.push({
      id: typeof r.id === 'number' ? r.id : out.length,
      name,
      label: formatPlaceLabel({ name, admin1, country }),
      lat,
      lon,
      elevation: typeof r.elevation === 'number' ? r.elevation : null,
      country,
      admin1,
    })
  }
  return out
}

/**
 * Busca lugares por nombre. La API exige al menos 2 caracteres; por debajo
 * se devuelve una lista vacía sin consultar.
 */
export async function searchPlaces(query: string, opts: { timeoutMs?: number } = {}): Promise<GeocodingResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  let json: unknown
  try {
    json = await fetchJsonDeduped(buildGeocodingUrl(q), { timeoutMs: opts.timeoutMs ?? 8_000 })
  } catch (e) {
    if (e instanceof AppError) {
      throw new AppError('network', 'No se ha podido buscar lugares. Comprueba la conexión.')
    }
    throw new AppError('network', 'No se ha podido buscar lugares.')
  }
  return parseGeocodingResponse(json)
}
