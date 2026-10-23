import { describe, expect, it } from 'vitest'
import { arrivalFromTime, estimateTiming, localToMs } from './timing'

const PROFILE = { flatSpeedKmh: 26, climbVamMph: 700, descentSpeedKmh: 35 }
const T0 = Date.parse('2026-10-24T09:00:00')

describe('estimateTiming', () => {
  it('en llano la duración es distancia / velocidad', () => {
    const pts = [
      { cumKm: 0, ele: 100 },
      { cumKm: 26, ele: 100 },
    ]
    const r = estimateTiming(pts, T0, null, PROFILE)
    expect(r.arrivalMs - T0).toBeCloseTo(3600_000, -3)
    expect(r.avgSpeedKmh).toBeCloseTo(26, 1)
    expect(r.scaled).toBe(false)
  })

  it('el desnivel positivo añade tiempo (VAM)', () => {
    const flat = estimateTiming(
      [
        { cumKm: 0, ele: 100 },
        { cumKm: 10, ele: 100 },
      ],
      T0,
      null,
      PROFILE,
    )
    const climb = estimateTiming(
      [
        { cumKm: 0, ele: 100 },
        { cumKm: 10, ele: 700 },
      ],
      T0,
      null,
      PROFILE,
    )
    // 600 m de desnivel a 700 m/h ≈ 51 min extra.
    const extraMin = (climb.arrivalMs - flat.arrivalMs) / 60_000
    expect(extraMin).toBeCloseTo(600 / 700 * 60, 0)
  })

  it('los descensos usan la velocidad de descenso', () => {
    const r = estimateTiming(
      [
        { cumKm: 0, ele: 1000 },
        { cumKm: 35, ele: 900 },
      ],
      T0,
      null,
      PROFILE,
    )
    // 35 km de bajada a 35 km/h ≈ 1 h (la subida neta es cero).
    expect(r.arrivalMs - T0).toBeCloseTo(3600_000, -4)
  })

  it('con hora de llegada reescala y deriva la velocidad media', () => {
    const pts = [
      { cumKm: 0, ele: 100 },
      { cumKm: 20, ele: 350 },
      { cumKm: 40, ele: 600 },
    ]
    const arrival = T0 + 2 * 3600_000
    const r = estimateTiming(pts, T0, arrival, PROFILE)
    expect(r.scaled).toBe(true)
    expect(r.arrivalMs).toBe(arrival)
    expect(r.avgSpeedKmh).toBeCloseTo(20, 1)
    // El reparto por desnivel se conserva: el punto intermedio sigue
    // estrictamente dentro del intervalo salida–llegada.
    expect(r.passageMs[1]).toBeGreaterThan(T0)
    expect(r.passageMs[1]).toBeLessThan(arrival)
  })

  it('un track sin altitud funciona solo con la velocidad', () => {
    const r = estimateTiming(
      [
        { cumKm: 0, ele: null },
        { cumKm: 22, ele: null },
      ],
      T0,
      null,
      { flatSpeedKmh: 22, climbVamMph: 700, descentSpeedKmh: 35 },
    )
    expect(r.arrivalMs - T0).toBeCloseTo(3600_000, -3)
  })
})

describe('localToMs / arrivalFromTime', () => {
  it('combina fecha y hora locales', () => {
    const ms = localToMs('2026-10-24', '09:30')
    expect(new Date(ms).getHours()).toBe(9)
    expect(new Date(ms).getMinutes()).toBe(30)
  })

  it('una hora de llegada anterior a la salida pasa al día siguiente', () => {
    const dep = localToMs('2026-10-24', '22:00')
    const arr = arrivalFromTime(dep, '2026-10-24', '01:00')
    expect(arr - dep).toBeCloseTo(3 * 3600_000, -3)
  })
})
