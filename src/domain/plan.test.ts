import { describe, expect, it } from 'vitest'
import { buildRoutePlan } from './plan'
import { createDefaultSettings } from './settings'
import type { RawTrackPoint, Settings } from './types'

const NOW = new Date('2026-10-23T10:00:00')

function settings(patch: Partial<Settings>): Settings {
  return { ...createDefaultSettings(NOW), ...patch }
}

function flatTrack(km: number): RawTrackPoint[] {
  const n = Math.max(3, Math.round(km / 0.5) + 1)
  return Array.from({ length: n }, (_, i) => ({
    lat: 40 + (i * 0.5) / 111.2,
    lon: -3,
    ele: 100,
    time: null,
  }))
}

describe('buildRoutePlan (modo GPX)', () => {
  it('muestrea el track y estima horas de paso crecientes', () => {
    const plan = buildRoutePlan({
      settings: settings({ planMode: 'gpx', date: '2026-10-24', startTime: '09:00' }),
      track: flatTrack(30),
      location: null,
    })
    expect(plan.source).toBe('gpx')
    expect(plan.stats.distanceKm).toBeCloseTo(30, 0)
    expect(plan.points.length).toBeGreaterThan(2)
    for (let i = 1; i < plan.points.length; i++) {
      expect(plan.points[i].arrivalMs).toBeGreaterThan(plan.points[i - 1].arrivalMs)
    }
    expect(plan.arrivalMs).toBe(plan.points[plan.points.length - 1].arrivalMs)
  })

  it('exige un track', () => {
    expect(() =>
      buildRoutePlan({
        settings: settings({ planMode: 'gpx' }),
        track: null,
        location: null,
      }),
    ).toThrowError(/track GPX/)
  })
})

describe('buildRoutePlan (lugar + destino)', () => {
  const start = { name: 'Madrid', lat: 40.4168, lon: -3.7038 }

  it('con destino usa línea recta y avisa de la aproximación', () => {
    const plan = buildRoutePlan({
      settings: settings({
        planMode: 'place',
        place: start,
        destination: { name: 'Aranjuez', lat: 40.0333, lon: -3.6 },
      }),
      track: null,
      location: null,
    })
    expect(plan.source).toBe('straight-line')
    expect(plan.stats.distanceKm).toBeGreaterThan(40)
    expect(plan.notes.some((n) => n.code === 'straight-line-approx')).toBe(true)
  })

  it('una ruta circular duplica la distancia', () => {
    const base = settings({
      planMode: 'place',
      place: start,
      destination: { name: 'Aranjuez', lat: 40.0333, lon: -3.6 },
    })
    const oneWay = buildRoutePlan({ settings: base, track: null, location: null })
    const circular = buildRoutePlan({
      settings: { ...base, circular: true },
      track: null,
      location: null,
    })
    expect(circular.stats.distanceKm).toBeCloseTo(oneWay.stats.distanceKm * 2, 0)
  })

  it('con hora de llegada respeta la duración indicada', () => {
    const plan = buildRoutePlan({
      settings: settings({
        planMode: 'place',
        place: start,
        destination: { name: 'Aranjuez', lat: 40.0333, lon: -3.6 },
        date: '2026-10-24',
        startTime: '09:00',
        arrivalTime: '13:00',
        durationMin: null,
      }),
      track: null,
      location: null,
    })
    expect(plan.stats.durationMin).toBe(240)
    expect(plan.notes.some((n) => n.code === 'arrival-scaled')).toBe(true)
    expect(plan.stats.avgSpeedKmh).toBeGreaterThan(0)
  })
})

describe('buildRoutePlan (modo estático)', () => {
  it('sin track ni destino genera una línea de tiempo por hora', () => {
    const plan = buildRoutePlan({
      settings: settings({ planMode: 'place', place: { name: 'Madrid', lat: 40.4, lon: -3.7 } }),
      track: null,
      location: null,
    })
    expect(plan.source).toBe('static')
    expect(plan.points.every((p) => p.bearingDeg === null && p.cumKm === 0)).toBe(true)
    expect(plan.notes.some((n) => n.code === 'static-timeline')).toBe(true)
    // Sin duración: 3 h por defecto.
    expect(plan.stats.durationMin).toBe(180)
  })

  it('exige un punto de salida', () => {
    expect(() =>
      buildRoutePlan({ settings: settings({ planMode: 'place', place: null }), track: null, location: null }),
    ).toThrowError(/lugar de salida/)
  })

  it('modo ubicación usa las coordenadas resueltas', () => {
    const plan = buildRoutePlan({
      settings: settings({ planMode: 'location' }),
      track: null,
      location: { lat: 43.36, lon: -8.41 },
    })
    expect(plan.points[0].lat).toBe(43.36)
  })
})
