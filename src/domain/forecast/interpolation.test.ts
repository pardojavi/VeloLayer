import { describe, expect, it } from 'vitest'
import { findSegment, interpolateAngle, interpolateAt, nearestAt } from './interpolation'

const T = [0, 3600, 7200]

describe('interpolateAt', () => {
  it('interpola linealmente entre horas', () => {
    expect(interpolateAt(T, [10, 20, 30], 1800).value).toBe(15)
    expect(interpolateAt(T, [10, 20, 30], 5400).value).toBe(25)
  })

  it('marca fuera de rango antes del inicio y después del final', () => {
    expect(interpolateAt(T, [10, 20, 30], -100).range).toBe('before')
    expect(interpolateAt(T, [10, 20, 30], 9000).range).toBe('after')
    // El instante exacto del último dato sigue dentro del rango.
    expect(interpolateAt(T, [10, 20, 30], 7200).range).toBe(false)
  })

  it('un hueco de datos no se rellena con cero', () => {
    const r = interpolateAt(T, [10, null, 30], 3600)
    expect(r.value).toBe(10) // se propaga el valor conocido más próximo
    const mid = interpolateAt(T, [null, null, 30], 5400)
    expect(mid.value).toBeNull()
  })
})

describe('interpolateAngle', () => {
  it('interpola por el camino corto (350° → 10° = 0°)', () => {
    const r = interpolateAngle(T, [350, 10, 20], 1800)
    expect(r.value).toBeCloseTo(0, 5)
  })
})

describe('nearestAt', () => {
  it('elige el valor más próximo sin interpolar códigos', () => {
    expect(nearestAt(T, [0, 3, 61], 4000).value).toBe(3)
    expect(nearestAt(T, [0, 3, 61], 3000).value).toBe(3)
    expect(nearestAt(T, [0, 3, 61], 1000).value).toBe(0)
  })
})

describe('findSegment', () => {
  it('encuentra el segmento correcto', () => {
    expect(findSegment(T, -1)).toBe(-1)
    expect(findSegment(T, 0)).toBe(0)
    expect(findSegment(T, 3599)).toBe(0)
    expect(findSegment(T, 3600)).toBe(1)
    expect(findSegment(T, 7200)).toBe(2)
    expect(findSegment(T, 9999)).toBe(2)
  })
})
