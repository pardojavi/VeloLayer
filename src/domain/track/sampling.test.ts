import { describe, expect, it } from 'vitest'
import { deriveTrackPoints } from './geometry'
import type { DerivedTrackPoint } from './geometry'
import { sampleIndices } from './sampling'

function flatTrack(n: number, kmPerStep: number): DerivedTrackPoint[] {
  const raw = Array.from({ length: n }, (_, i) => ({
    lat: 40 + (i * kmPerStep) / 111.2,
    lon: -3,
    ele: null,
    time: null,
  }))
  return deriveTrackPoints(raw)
}

describe('sampleIndices', () => {
  it('incluye siempre el primer y el último punto', () => {
    const pts = flatTrack(2000, 0.1) // 200 km
    const idx = sampleIndices(pts, { maxPoints: 30 })
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(1999)
    expect(idx.length).toBeLessThanOrEqual(31)
  })

  it('mantiene la separación mínima de 2 km', () => {
    const pts = flatTrack(2000, 0.1)
    const idx = sampleIndices(pts, { maxPoints: 60 })
    for (let i = 1; i < idx.length; i++) {
      expect(pts[idx[i]].cumKm - pts[idx[i - 1]].cumKm).toBeGreaterThanOrEqual(1.5)
    }
  })

  it('muestrea todos los puntos si son pocos', () => {
    const pts = flatTrack(5, 1)
    expect(sampleIndices(pts)).toEqual([0, 1, 2, 3, 4])
  })

  it('acorta el muestreo ante un salto grande de altitud', () => {
    const raw = Array.from({ length: 300 }, (_, i) => ({
      lat: 40 + i * 0.01, // ~1.11 km por paso
      lon: -3,
      ele: i === 150 ? 1500 : 100, // salto de 1400 m de golpe
      time: null,
    }))
    const pts = deriveTrackPoints(raw)
    const idx = sampleIndices(pts, { maxPoints: 12, eleJumpM: 150 })
    expect(idx).toContain(150)
  })
})
