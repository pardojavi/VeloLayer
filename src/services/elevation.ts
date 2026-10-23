import type { GeoPoint } from '../domain/types'
import { fetchJsonDeduped } from './http'

export const ELEVATION_BASE = 'https://api.open-meteo.com/v1/elevation'

/** La API admite hasta 100 coordenadas por petición. */
export const ELEVATION_MAX_POINTS_PER_REQUEST = 100

export function buildElevationUrl(points: readonly GeoPoint[]): string {
  const params = new URLSearchParams()
  params.set('latitude', points.map((p) => p.lat.toFixed(4)).join(','))
  params.set('longitude', points.map((p) => p.lon.toFixed(4)).join(','))
  return `${ELEVATION_BASE}?${params.toString()}`
}

export function parseElevationResponse(json: unknown, count: number): (number | null)[] {
  const raw = (json as { elevation?: unknown } | null)?.elevation
  const src = Array.isArray(raw) ? raw : []
  const out: (number | null)[] = []
  for (let i = 0; i < count; i++) {
    const v = src[i]
    out.push(typeof v === 'number' && Number.isFinite(v) ? v : null)
  }
  return out
}

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Altitud de los puntos indicados (Copernicus DEM 90 m vía Open-Meteo).
 * Es tolerante a fallos: si no se puede obtener, devuelve null en lugar de
 * bloquear el cálculo (la altitud del GPX, si existe, tiene prioridad).
 */
export async function fetchElevations(points: readonly GeoPoint[]): Promise<(number | null)[]> {
  const out: (number | null)[] = new Array(points.length).fill(null)
  let offset = 0
  for (const batch of chunkArray(points, ELEVATION_MAX_POINTS_PER_REQUEST)) {
    try {
      const json = await fetchJsonDeduped(buildElevationUrl(batch), { timeoutMs: 8_000 })
      const values = parseElevationResponse(json, batch.length)
      values.forEach((v, j) => {
        out[offset + j] = v
      })
    } catch {
      // Sin altitud se continúa: el modelo de tiempos funciona en llano.
    }
    offset += batch.length
  }
  return out
}
