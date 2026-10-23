import { describe, expect, it } from 'vitest'
import { ridingApparentC, windChillC } from './thermal'

describe('windChillC', () => {
  it('aplica la fórmula dentro de su rango (T ≤ 10 °C y viento > 4,8 km/h)', () => {
    const chill = windChillC(5, 30)
    expect(chill).not.toBeNull()
    // Con 5 °C y 30 km/h la sensación queda bastante por debajo del aire.
    expect(chill!).toBeLessThan(5)
    expect(chill!).toBeGreaterThan(-10)
  })

  it('no se aplica por encima de 10 °C', () => {
    expect(windChillC(10.1, 50)).toBeNull()
  })

  it('no se aplica con viento débil (fuera de rango)', () => {
    expect(windChillC(5, 4.8)).toBeNull()
    expect(windChillC(5, 3)).toBeNull()
  })
})

describe('ridingApparentC', () => {
  it('usa la fórmula de viento cuando es válida', () => {
    const r = ridingApparentC(6, 4, 30)
    expect(r.method).toBe('wind-chill')
    expect(r.valueC).toBe(windChillC(6, 30))
  })

  it('usa la temperatura aparente de la API fuera del rango válido', () => {
    const r = ridingApparentC(22, 25, 35)
    expect(r.method).toBe('api-apparent')
    expect(r.usedApiApparent).toBe(true)
    expect(r.valueC).toBe(25)
  })

  it('sin viento percibido suficiente y sin aparente, devuelve la temperatura', () => {
    const r = ridingApparentC(9, null, 2)
    expect(r.valueC).toBe(9)
    expect(r.method).toBeNull()
  })

  it('solo temperatura aparente disponible', () => {
    const r = ridingApparentC(null, 12, null)
    expect(r.valueC).toBe(12)
    expect(r.method).toBe('api-apparent')
  })
})
