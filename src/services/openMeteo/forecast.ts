import { AppError } from '../../domain/errors'
import type { DailySeries, HourlySeries, LocationForecast } from '../../domain/types'
import {
  forecastCacheKey,
  getCachedForecasts,
  purgeExpiredForecastCache,
  putCachedForecasts,
} from '../../storage/forecastCacheRepository'
import { fetchJsonDeduped } from '../http'

export const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'

/**
 * Máximo de coordenadas por petición. La API admite listas largas, pero se
 * mantiene un número conservador para respetar sus límites.
 */
export const FORECAST_MAX_POINTS_PER_REQUEST = 20

export const HOURLY_VARIABLES = [
  'temperature_2m',
  'apparent_temperature',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'precipitation',
  'precipitation_probability',
  'cloud_cover',
  'weather_code',
] as const

export const DAILY_VARIABLES = ['uv_index_max', 'sunrise', 'sunset'] as const

export interface ForecastRequestPoint {
  lat: number
  lon: number
  elevation: number | null
}

/** Días de previsión necesarios para cubrir la ventana (1–16). */
export function forecastDaysFor(startMs: number, endMs: number, now = Date.now()): number {
  const dayMs = 86_400_000
  const today = Math.floor(now / dayMs)
  const endDay = Math.floor(Math.max(endMs, startMs, now) / dayMs)
  return Math.max(1, Math.min(16, endDay - today + 2))
}

export function buildForecastUrl(
  points: readonly ForecastRequestPoint[],
  forecastDays: number,
): string {
  const params = new URLSearchParams()
  params.set('latitude', points.map((p) => p.lat.toFixed(4)).join(','))
  params.set('longitude', points.map((p) => p.lon.toFixed(4)).join(','))
  if (points.some((p) => p.elevation !== null)) {
    // 'nan' desactiva el reescalado para puntos sin altitud conocida.
    params.set(
      'elevation',
      points.map((p) => (p.elevation === null ? 'nan' : String(Math.round(p.elevation)))).join(','),
    )
  }
  params.set('hourly', HOURLY_VARIABLES.join(','))
  params.set('daily', DAILY_VARIABLES.join(','))
  params.set('temperature_unit', 'celsius')
  params.set('wind_speed_unit', 'kmh')
  params.set('precipitation_unit', 'mm')
  params.set('timeformat', 'iso8601')
  // GMT: las marcas temporales son instantes UTC inequívocos (sin ambigüedad
  // de horario de verano); la conversión a hora local se hace al presentar.
  params.set('timezone', 'GMT')
  params.set('forecast_days', String(forecastDays))
  return `${FORECAST_BASE}?${params.toString()}`
}

/** ISO 8601 sin offset (GMT) → instante UTC en ms. */
export function parseIsoInstant(value: unknown): number {
  if (typeof value !== 'string') return NaN
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(value)
  return Date.parse(hasOffset ? value : `${value}Z`)
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function parseHourlySeries(hourly: unknown): HourlySeries {
  const h = (hourly ?? {}) as Record<string, unknown>
  const rawTime = Array.isArray(h.time) ? h.time : []
  const time = rawTime.map(parseIsoInstant)
  const n = time.length
  const arr = (name: string): (number | null)[] => {
    const raw = h[name]
    const src = Array.isArray(raw) ? raw : []
    const out: (number | null)[] = []
    for (let i = 0; i < n; i++) out.push(numOrNull(src[i]))
    return out
  }
  return {
    time,
    temperature: arr('temperature_2m'),
    apparent: arr('apparent_temperature'),
    windSpeed: arr('wind_speed_10m'),
    windDirection: arr('wind_direction_10m'),
    windGust: arr('wind_gusts_10m'),
    precipitation: arr('precipitation'),
    precipitationProbability: arr('precipitation_probability'),
    cloudCover: arr('cloud_cover'),
    weatherCode: arr('weather_code'),
  }
}

export function parseDailySeries(daily: unknown): DailySeries {
  const d = (daily ?? {}) as Record<string, unknown>
  const rawTime = Array.isArray(d.time) ? d.time : []
  const time = rawTime.map(parseIsoInstant)
  const n = time.length
  const nums = (name: string): (number | null)[] => {
    const raw = d[name]
    const src = Array.isArray(raw) ? raw : []
    const out: (number | null)[] = []
    for (let i = 0; i < n; i++) out.push(numOrNull(src[i]))
    return out
  }
  const times = (name: string): number[] => {
    const raw = d[name]
    const src = Array.isArray(raw) ? raw : []
    const out: number[] = []
    for (let i = 0; i < n; i++) out.push(parseIsoInstant(src[i]))
    return out
  }
  return {
    time,
    uvIndexMax: nums('uv_index_max'),
    sunrise: times('sunrise'),
    sunset: times('sunset'),
  }
}

export function parseLocationForecast(json: unknown, requested: ForecastRequestPoint): LocationForecast {
  const o = (json ?? {}) as Record<string, unknown>
  const lat = numOrNull(o.latitude) ?? requested.lat
  const lon = numOrNull(o.longitude) ?? requested.lon
  return {
    lat,
    lon,
    elevation: numOrNull(o.elevation),
    hourly: parseHourlySeries(o.hourly),
    daily: parseDailySeries(o.daily),
  }
}

/** La API devuelve un objeto con una coordenada y una lista con varias. */
export function parseForecastResponse(
  json: unknown,
  points: readonly ForecastRequestPoint[],
): LocationForecast[] {
  if (Array.isArray(json)) {
    return json.map((item, i) =>
      parseLocationForecast(item, points[i] ?? points[points.length - 1] ?? { lat: 0, lon: 0, elevation: null }),
    )
  }
  const first = points[0] ?? { lat: 0, lon: 0, elevation: null }
  return [parseLocationForecast(json, first)]
}

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function toForecastError(e: unknown): AppError {
  if (e instanceof AppError) return e
  return new AppError(
    'forecast-unavailable',
    'No se ha podido obtener la previsión meteorológica. Reintenta en unos segundos.',
  )
}

export interface FetchForecastsOptions {
  forecastDays: number
  /** Desactivar la caché local (por ejemplo, con "actualizar"). */
  useCache?: boolean
  timeoutMs?: number
  now?: number
}

/**
 * Previsión para cada punto muestreado, con caché local (TTL 3 h),
 * deduplicación de peticiones en vuelo y lotes de coordenadas.
 */
export async function fetchPointForecasts(
  points: readonly ForecastRequestPoint[],
  opts: FetchForecastsOptions,
): Promise<LocationForecast[]> {
  const now = opts.now ?? Date.now()
  const days = opts.forecastDays
  const keys = points.map((p) => forecastCacheKey(p.lat, p.lon, p.elevation, days))
  const out: LocationForecast[] = new Array(points.length)

  let cache = new Map<string, LocationForecast>()
  if (opts.useCache !== false) {
    try {
      cache = await getCachedForecasts(keys, now)
      void purgeExpiredForecastCache(now).catch(() => undefined)
    } catch {
      // La caché es opcional: si falla, se consulta la API.
    }
  }

  const missing: number[] = []
  keys.forEach((key, i) => {
    const hit = cache.get(key)
    if (hit) out[i] = hit
    else missing.push(i)
  })

  if (missing.length > 0) {
    const toCache: { key: string; forecast: LocationForecast }[] = []
    for (const batch of chunkArray(missing, FORECAST_MAX_POINTS_PER_REQUEST)) {
      const batchPoints = batch.map((i) => points[i])
      const url = buildForecastUrl(batchPoints, days)
      let json: unknown
      try {
        json = await fetchJsonDeduped(url, { timeoutMs: opts.timeoutMs ?? 12_000 })
      } catch (e) {
        throw toForecastError(e)
      }
      const parsed = parseForecastResponse(json, batchPoints)
      batch.forEach((pointIdx, j) => {
        const forecast = parsed[j]
        if (forecast) {
          out[pointIdx] = forecast
          toCache.push({ key: keys[pointIdx], forecast })
        }
      })
    }
    if (opts.useCache !== false) {
      try {
        await putCachedForecasts(toCache, now)
      } catch {
        // Sin caché se sigue funcionando; se reintentará en la próxima consulta.
      }
    }
  }

  return out
}
