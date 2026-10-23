import { describe, expect, it } from 'vitest'
import { feltHeadwind, feltWindSpeed, relativeWind, signedAngleDeg } from './wind'

describe('relativeWind', () => {
  it('viento del norte con rumbo norte: frente completo', () => {
    const r = relativeWind(0, 20, 0)
    expect(r?.headKmh).toBeCloseTo(20, 5)
    expect(r?.angleDeg).toBe(0)
  })

  it('viento del norte con rumbo sur: de cola (negativo)', () => {
    const r = relativeWind(0, 20, 180)
    expect(r?.headKmh).toBeCloseTo(-20, 5)
    expect(r?.angleDeg).toBe(180)
  })

  it('viento del este con rumbo norte: lateral derecho', () => {
    const r = relativeWind(90, 10, 0)
    expect(r?.headKmh).toBeCloseTo(0, 5)
    expect(r?.crossKmh).toBeCloseTo(10, 5)
  })

  it('rumbo ausente (modo estático) no inventa componentes', () => {
    expect(relativeWind(0, 10, null)).toBeNull()
  })
})

describe('feltWindSpeed / feltHeadwind', () => {
  it('parado, el ciclista percibe el viento tal cual', () => {
    expect(feltWindSpeed(45, 15, 90, 0)).toBeCloseTo(15, 1)
  })

  it('de frente a 25 km/h con 10 de viento en contra: percibe 35', () => {
    expect(feltWindSpeed(0, 10, 0, 25)).toBeCloseTo(35, 1)
    expect(feltHeadwind(0, 10, 0, 25)).toBeCloseTo(35, 1)
  })

  it('viento de cola más fuerte que el ciclista: sigue percibiéndolo de frente', () => {
    // Viento de cola de 30 km/h y ritmo de 20 km/h → 10 km/h en la cara.
    expect(feltWindSpeed(180, 30, 0, 20)).toBeCloseTo(10, 1)
    // Componente de frente negativa = de cola: −30 + 20 = −10.
    expect(feltHeadwind(180, 30, 0, 20)).toBeCloseTo(-10, 1)
  })

  it('viento de cola más lento que el ciclista: lo percibe de frente', () => {
    expect(feltHeadwind(180, 10, 0, 25)).toBeCloseTo(15, 1)
  })

  it('viento cruzado: magnitud según Pitágoras', () => {
    // 90° de desfase: sqrt(20² + 25²)
    expect(feltWindSpeed(90, 20, 0, 25)).toBeCloseTo(Math.hypot(20, 25), 1)
  })
})

describe('signedAngleDeg', () => {
  it('normaliza al rango (-180, 180]', () => {
    expect(signedAngleDeg(270)).toBe(-90)
    expect(signedAngleDeg(-90)).toBe(-90)
    expect(signedAngleDeg(180)).toBe(180)
    expect(signedAngleDeg(540)).toBe(180)
  })
})
