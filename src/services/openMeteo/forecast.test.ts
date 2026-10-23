import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetDatabaseConnection } from '../../storage/db'
import {
  buildForecastUrl,
  fetchPointForecasts,
  forecastDaysFor,
  parseForecastResponse,
  parseIsoInstant,
} from './forecast'

const T0 = Date.parse('2026-10-24T00:00:00Z')

function makeForecastPayload(lat: number, lon: number, hours = 6) {
  const time = Array.from({ length: hours }, (_, i) => new Date(T0 + i * 3_600_000).toISOString().slice(0, 16))
  const fill = (v: number) => Array.from({ length: hours }, () => v)
  return {
    latitude: lat,
    longitude: lon,
    elevation: 650,
    hourly: {
      time,
      temperature_2m: fill(12),
      apparent_temperature: fill(11),
      wind_speed_10m: fill(20),
      wind_direction_10m: fill(0),
      wind_gusts_10m: fill(30),
      precipitation: fill(0),
      precipitation_probability: fill(10),
      cloud_cover: fill(40),
      weather_code: fill(1),
    },
    daily: {
      time: [time[0].slice(0, 10)],
      uv_index_max: [5],
      sunrise: [new Date(T0 - 3_600_000).toISOString().slice(0, 16)],
      sunset: [new Date(T0 + 12 * 3_600_000).toISOString().slice(0, 16)],
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetDatabaseConnection()
})

describe('buildForecastUrl', () => {
  it('incluye varias coordenadas, altitud y las variables horarias', () => {
    const url = buildForecastUrl(
      [
        { lat: 40.4168, lon: -3.7038, elevation: 650 },
        { lat: 40.5, lon: -3.8, elevation: null },
      ],
      7,
    )
    const u = new URL(url)
    expect(u.searchParams.get('latitude')).toBe('40.4168,40.5000')
    expect(u.searchParams.get('longitude')).toBe('-3.7038,-3.8000')
    // El punto sin altitud desactiva el reescalado con 'nan'.
    expect(u.searchParams.get('elevation')).toBe('650,nan')
    expect(u.searchParams.get('timezone')).toBe('GMT')
    expect(u.searchParams.get('forecast_days')).toBe('7')
    const hourly = u.searchParams.get('hourly') ?? ''
    for (const v of [
      'temperature_2m',
      'apparent_temperature',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'precipitation',
      'precipitation_probability',
      'weather_code',
    ]) {
      expect(hourly).toContain(v)
    }
    expect(u.searchParams.get('daily')).toContain('uv_index_max')
  })

  it('sin altitud no envía el parámetro elevation', () => {
    const url = buildForecastUrl([{ lat: 1, lon: 2, elevation: null }], 3)
    expect(new URL(url).searchParams.has('elevation')).toBe(false)
  })
})

describe('forecastDaysFor', () => {
  it('cubre la ventana pedida y respeta el máximo de 16 días', () => {
    const now = Date.parse('2026-10-23T12:00:00Z')
    expect(forecastDaysFor(now, now + 2 * 86_400_000, now)).toBeGreaterThanOrEqual(3)
    expect(forecastDaysFor(now, now + 40 * 86_400_000, now)).toBe(16)
    expect(forecastDaysFor(now, now, now)).toBeGreaterThanOrEqual(1)
  })
})

describe('parseIsoInstant', () => {
  it('interpreta el ISO sin offset como UTC', () => {
    expect(parseIsoInstant('2026-10-24T09:00')).toBe(Date.parse('2026-10-24T09:00:00Z'))
    expect(parseIsoInstant('2026-10-24T09:00:00Z')).toBe(Date.parse('2026-10-24T09:00:00Z'))
    expect(parseIsoInstant(42)).toBeNaN()
  })
})

describe('parseForecastResponse', () => {
  it('devuelve un único resultado para una coordenada', () => {
    const payload = makeForecastPayload(40.4, -3.7)
    const out = parseForecastResponse(payload, [{ lat: 40.4, lon: -3.7, elevation: 650 }])
    expect(out).toHaveLength(1)
    expect(out[0].hourly.temperature[0]).toBe(12)
    expect(out[0].daily.uvIndexMax[0]).toBe(5)
    expect(out[0].hourly.time[0]).toBe(T0)
  })

  it('devuelve una lista para varias coordenadas', () => {
    const payloads = [makeForecastPayload(40.4, -3.7, 3), makeForecastPayload(40.5, -3.8, 3)]
    const out = parseForecastResponse(payloads, [
      { lat: 40.4, lon: -3.7, elevation: null },
      { lat: 40.5, lon: -3.8, elevation: null },
    ])
    expect(out).toHaveLength(2)
    expect(out[1].lat).toBe(40.5)
  })

  it('faltantes de datos se convierten en null, no en cero', () => {
    const payload = makeForecastPayload(40.4, -3.7, 3) as {
      hourly: Record<string, unknown>
    }
    payload.hourly.precipitation_probability = [null, null, null]
    const out = parseForecastResponse(payload, [{ lat: 40.4, lon: -3.7, elevation: null }])
    expect(out[0].hourly.precipitationProbability[0]).toBeNull()
  })
})

describe('fetchPointForecasts', () => {
  it('consulta la API y después sirve desde la caché local', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        makeForecastPayload(40.4168, -3.7038, 4),
        makeForecastPayload(40.5, -3.8, 4),
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const points = [
      { lat: 40.4168, lon: -3.7038, elevation: 650 },
      { lat: 40.5, lon: -3.8, elevation: 700 },
    ]

    const first = await fetchPointForecasts(points, { forecastDays: 3, now: T0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toHaveLength(2)
    expect(first[0].hourly.temperature).toHaveLength(4)

    // Segunda consulta: caché local, sin nueva petición.
    const second = await fetchPointForecasts(points, { forecastDays: 3, now: T0 + 60_000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second[0].hourly.temperature[0]).toBe(12)
  })

  it('convierte los errores de red en un error de aplicación comprensible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(
      fetchPointForecasts([{ lat: 1, lon: 2, elevation: null }], { forecastDays: 2, useCache: false }),
    ).rejects.toThrowError(/conexión|reintenta/i)
  })
})
