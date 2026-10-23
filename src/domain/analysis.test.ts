import { describe, expect, it } from 'vitest'
import { buildClothingInput, buildPointWeather, longestDescent, riderSpeeds } from './analysis'
import type { LocationForecast, RoutePlan } from './types'

const T0 = Date.parse('2026-10-24T09:00:00Z')
const HOUR = 3_600_000

function forecast(hours: number, patch: Partial<LocationForecast['hourly']> = {}): LocationForecast {
  const time = Array.from({ length: hours }, (_, i) => T0 + i * HOUR)
  const fill = (v: number | null) => time.map(() => v)
  return {
    lat: 40.4,
    lon: -3.7,
    elevation: 650,
    hourly: {
      time,
      temperature: fill(10),
      apparent: fill(9),
      windSpeed: fill(20),
      windDirection: fill(0),
      windGust: fill(30),
      precipitation: fill(0),
      precipitationProbability: fill(15),
      cloudCover: fill(40),
      weatherCode: fill(1),
      ...patch,
    },
    daily: {
      time: [T0],
      uvIndexMax: [4],
      sunrise: [T0 - 2 * HOUR],
      sunset: [T0 + 8 * HOUR],
    },
  }
}

function plan(eles: (number | null)[], bearing: number | null = 0): RoutePlan {
  const points = eles.map((ele, i) => ({
    index: i,
    lat: 40.4 + i * 0.02,
    lon: -3.7,
    ele,
    cumKm: i * 2,
    bearingDeg: i === 0 ? bearing : bearing,
    arrivalMs: T0 + i * HOUR,
  }))
  return {
    source: 'gpx',
    points,
    geometry: points.map((p) => ({ lat: p.lat, lon: p.lon })),
    departureMs: T0,
    arrivalMs: T0 + (eles.length - 1) * HOUR,
    stats: {
      distanceKm: (eles.length - 1) * 2,
      ascentM: 100,
      descentM: 100,
      durationMin: (eles.length - 1) * 60,
      avgSpeedKmh: 2,
    },
    notes: [],
  }
}

describe('riderSpeeds', () => {
  it('deriva la velocidad de los tramos', () => {
    const speeds = riderSpeeds(plan([100, 100, 100]))
    expect(speeds).toEqual([2, 2, 2])
  })

  it('modo estático: sin velocidad de ciclista', () => {
    const p = plan([null, null])
    const speeds = riderSpeeds({ ...p, source: 'static' })
    expect(speeds).toEqual([0, 0])
  })
})

describe('buildPointWeather', () => {
  it('interpola la previsión a la hora de paso y calcula viento relativo', () => {
    const p = plan([100, 100, 100])
    const weather = buildPointWeather(p, [forecast(6), forecast(6), forecast(6)])
    expect(weather).toHaveLength(3)
    expect(weather[0].temperature).toBe(10)
    expect(weather[0].feltApparentC).not.toBeNull()
    // Rumbo norte y viento del norte: componente de frente positiva.
    expect(weather[1].relativeWind?.headKmh).toBeGreaterThan(0)
    // 20 km/h de viento frontal + 2 km/h de ritmo → 22 km/h percibidos.
    expect(weather[1].feltWindKmh).toBeCloseTo(22, 1)
  })

  it('marca como fuera de rango los puntos sin previsión', () => {
    const p = plan([100, 100, 100])
    const weather = buildPointWeather(p, [forecast(6)])
    expect(weather[0].outOfRange).toBe(false)
    expect(weather[2].outOfRange).toBe(true)
    expect(weather[2].temperature).toBeNull()
  })

  it('detecta la noche con sunrise/sunset', () => {
    const p = plan([100])
    const w = buildPointWeather(p, [
      forecast(2, {}) as LocationForecast,
    ])[0]
    expect(w.isNight).toBe(false)
    const nightPlan = plan([100])
    nightPlan.points[0].arrivalMs = T0 - 3 * HOUR
    const wNight = buildPointWeather(nightPlan, [forecast(6)])[0]
    expect(wNight.isNight).toBe(true)
  })
})

describe('longestDescent', () => {
  it('encuentra el descenso continuo de mayor caída', () => {
    const d = longestDescent(plan([500, 400, 300, 350, 300, 200]))
    expect(d).not.toBeNull()
    // 500 → 300 m (km 0 → km 4) cae 200 m; el tramo final (350 → 200,
    // km 6 → km 10) cae solo 150 m, así que gana el primero.
    expect(d!.dropM).toBe(200)
    expect(d!.fromKm).toBe(0)
    expect(d!.toKm).toBe(4)
  })

  it('devuelve null sin datos de altitud', () => {
    expect(longestDescent(plan([null, null, null]))).toBeNull()
  })
})

describe('buildClothingInput', () => {
  it('empaqueta las series y detecta noche y UV', () => {
    const p = plan([100, 100])
    const weather = buildPointWeather(p, [forecast(6), forecast(6)])
    const input = buildClothingInput(p, weather, 'friolero')
    expect(input.apparent).toHaveLength(2)
    expect(input.uvIndexMax).toBe(4)
    expect(input.nightStart).toBe(false)
    expect(input.nightEnd).toBe(false)
    expect(input.sensitivity).toBe('friolero')
  })
})
