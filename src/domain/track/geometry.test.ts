import { describe, expect, it } from 'vitest'
import {
  bearingDeg,
  computeTrackStats,
  deriveTrackPoints,
  densifyLine,
  haversineKm,
  nearestIndex,
} from './geometry'

const A = { lat: 40.0, lon: -3.0 }
const B = { lat: 41.0, lon: -3.0 }

describe('haversineKm', () => {
  it('distancia de un grado de latitud ≈ 111,2 km', () => {
    expect(haversineKm(A, B)).toBeCloseTo(111.2, 0)
  })

  it('distancia nula entre el mismo punto', () => {
    expect(haversineKm(A, A)).toBe(0)
  })
})

describe('bearingDeg', () => {
  it('al norte es 0°', () => {
    expect(bearingDeg(A, B)).toBeCloseTo(0, 1)
  })

  it('al este es 90°', () => {
    // Rumbo inicial de la ortodromía: en latitud 40 una línea hacia el este
    // se desvía ~0,3° hacia el norte, por eso no es exactamente 90°.
    expect(bearingDeg(A, { lat: 40.0, lon: -2.0 })).toBeCloseTo(90, 0)
  })
})

describe('deriveTrackPoints', () => {
  it('acumula distancia y asigna rumbo por tramo', () => {
    const pts = deriveTrackPoints([
      { lat: 40.0, lon: -3.0, ele: 100, time: null },
      { lat: 40.0, lon: -3.01, ele: 120, time: null },
      { lat: 40.0, lon: -3.02, ele: 110, time: null },
    ])
    expect(pts[0].cumKm).toBe(0)
    expect(pts[0].bearingDeg).toBeNull()
    expect(pts[1].cumKm).toBeCloseTo(0.86, 1)
    expect(pts[2].cumKm).toBeCloseTo(1.72, 1)
    expect(pts[1].bearingDeg).toBeCloseTo(270, 0)
  })
})

describe('computeTrackStats', () => {
  it('calcula distancia, desnivel positivo y negativo', () => {
    const stats = computeTrackStats([
      { lat: 40.0, lon: -3.0, ele: 100, time: null },
      { lat: 40.005, lon: -3.0, ele: 150, time: null },
      { lat: 40.01, lon: -3.0, ele: 130, time: null },
    ])
    expect(stats.distanceKm).toBeCloseTo(1.11, 1)
    expect(stats.ascentM).toBe(50)
    expect(stats.descentM).toBe(20)
    expect(stats.hasEle).toBe(true)
    expect(stats.hasTime).toBe(false)
  })

  it('diferencia ausencia de altitud de cero metros', () => {
    const stats = computeTrackStats([
      { lat: 40.0, lon: -3.0, ele: null, time: null },
      { lat: 40.005, lon: -3.0, ele: null, time: null },
    ])
    expect(stats.hasEle).toBe(false)
    expect(stats.ascentM).toBe(0)
  })
})

describe('densifyLine', () => {
  it('interpola puntos intermedios', () => {
    const pts = densifyLine(A, B, 0.5)
    expect(pts.length).toBeGreaterThanOrEqual(3)
    expect(pts[0]).toEqual(A)
    expect(pts[pts.length - 1]).toEqual(B)
  })
})

describe('nearestIndex', () => {
  it('encuentra el punto más cercano', () => {
    const pts = [A, B, { lat: 42.0, lon: -3.0 }]
    expect(nearestIndex(pts, { lat: 41.9, lon: -3.0 })).toBe(2)
    expect(nearestIndex(pts, { lat: 39.9, lon: -3.0 })).toBe(0)
  })
})
