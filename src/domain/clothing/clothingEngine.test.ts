import { describe, expect, it } from 'vitest'
import { recommendClothing } from './clothingEngine'
import type { ClothingInput } from './clothingEngine'

const HOUR = 3_600_000
const T0 = Date.parse('2026-10-24T09:00:00')

function input(overrides: Partial<ClothingInput> = {}): ClothingInput {
  const n = 5
  return {
    timesMs: Array.from({ length: n }, (_, i) => T0 + i * HOUR),
    cumKm: Array.from({ length: n }, (_, i) => i * 10),
    apparent: Array.from({ length: n }, () => 5),
    precipProb: Array.from({ length: n }, () => 5),
    precipMmH: Array.from({ length: n }, () => 0),
    gustKmh: Array.from({ length: n }, () => 10),
    headKmh: Array.from({ length: n }, () => 0),
    uvIndexMax: 2,
    nightStart: false,
    nightEnd: false,
    longDescent: null,
    sensitivity: 'normal',
    ...overrides,
  }
}

function hasItem(rec: ReturnType<typeof recommendClothing>, id: string): boolean {
  return rec.items.some((i) => i.id === id)
}

describe('recommendClothing', () => {
  it('frío de 5 °C: capa base, maillot térmico y chaqueta', () => {
    const rec = recommendClothing(input())
    expect(hasItem(rec, 'base_layer')).toBe(true)
    expect(hasItem(rec, 'thermal_ls')).toBe(true)
    expect(hasItem(rec, 'wind_jacket')).toBe(true)
    expect(hasItem(rec, 'gloves_warm')).toBe(true)
    expect(rec.referenceTempC).toBe(5)
  })

  it('cada prenda explica el dato que la justifica', () => {
    const rec = recommendClothing(input())
    for (const item of rec.items) {
      expect(item.reason).toMatch(/Sensación estimada|Probabilidad|Viento|UV|Segmento|variación|fríos/)
    }
  })

  it('calor de 27 °C: maillot ligero y culotte corto', () => {
    const rec = recommendClothing(input({ apparent: Array(5).fill(27) }))
    expect(hasItem(rec, 'maillot_light')).toBe(true)
    expect(hasItem(rec, 'culotte_short')).toBe(true)
    expect(hasItem(rec, 'base_layer')).toBe(false)
  })

  it('sensibilidad friolero suma 3 °C a los umbrales', () => {
    // Media de 19 °C: en "normal" iría maillot corto; friolero, manguitos disponibles.
    const base = recommendClothing(input({ apparent: Array(5).fill(19) }))
    const friolero = recommendClothing(input({ apparent: Array(5).fill(19), sensitivity: 'friolero' }))
    expect(hasItem(base, 'arm_warmer')).toBe(false)
    expect(hasItem(friolero, 'arm_warmer')).toBe(true)
  })

  it('caluroso resta 3 °C a los umbrales', () => {
    // 23 °C queda justo por debajo del umbral de maillot ligero (25 °C).
    const normal = recommendClothing(input({ apparent: Array(5).fill(23) }))
    const caluroso = recommendClothing(input({ apparent: Array(5).fill(23), sensitivity: 'caluroso' }))
    expect(hasItem(normal, 'maillot_ss')).toBe(true)
    expect(hasItem(normal, 'maillot_light')).toBe(false)
    expect(hasItem(caluroso, 'maillot_light')).toBe(true)
  })

  it('recorrido variable (≥ 8 °C) sugiere capas extraíbles con tramo y hora', () => {
    const rec = recommendClothing(
      input({ apparent: [1, 4, 9, 15, 18] }),
    )
    const removable = rec.items.find((i) => i.id === 'removable_layers')
    expect(removable).toBeDefined()
    expect(removable!.reason).toContain('km')
    expect(removable!.reason).toMatch(/a las \d{2}:\d{2}/)
  })

  it('primera media hora más fría: capa adicional para la salida', () => {
    const rec = recommendClothing(input({ apparent: [0, 8, 9, 9, 9] }))
    expect(hasItem(rec, 'extra_start')).toBe(true)
  })

  it('probabilidad de lluvia ≥ 40 %: capa impermeable ligera', () => {
    const rec = recommendClothing(input({ precipProb: [10, 45, 10, 10, 10] }))
    expect(hasItem(rec, 'light_rain_shell')).toBe(true)
    expect(hasItem(rec, 'rain_shell')).toBe(false)
  })

  it('probabilidad ≥ 70 % o precipitación ≥ 1 mm/h: chubasquero y aviso', () => {
    const rec = recommendClothing(input({ precipProb: [10, 80, 10, 10, 10] }))
    expect(hasItem(rec, 'rain_shell')).toBe(true)
    expect(rec.warnings.some((w) => w.id === 'rain-gear')).toBe(true)
  })

  it('lluvia intensa avisa para reconsiderar la salida', () => {
    const rec = recommendClothing(input({ precipMmH: [0, 0, 5.5, 0, 0] }))
    const heavy = rec.warnings.find((w) => w.id === 'heavy-rain')
    expect(heavy).toBeDefined()
    expect(heavy!.severity).toBe('danger')
  })

  it('rachas ≥ 40 km/h generan aviso', () => {
    const rec = recommendClothing(input({ gustKmh: [10, 12, 48, 12, 10] }))
    expect(rec.warnings.some((w) => w.id === 'gusts')).toBe(true)
  })

  it('viento de frente sostenido recomienda cortavientos de bolsillo', () => {
    const rec = recommendClothing(input({ headKmh: [30, 32, 31, 30, 2] }))
    expect(hasItem(rec, 'wind_pocket')).toBe(true)
  })

  it('UV ≥ 6 recomienda protección solar', () => {
    const rec = recommendClothing(input({ uvIndexMax: 7 }))
    expect(hasItem(rec, 'sun_protection')).toBe(true)
  })

  it('tramo nocturno recomienda luces y reflectantes', () => {
    const rec = recommendClothing(input({ nightStart: true }))
    expect(hasItem(rec, 'lights')).toBe(true)
    expect(rec.warnings.some((w) => w.id === 'reflective')).toBe(true)
  })

  it('temperaturas bajo cero avisan del hielo', () => {
    const rec = recommendClothing(input({ apparent: Array(5).fill(-3) }))
    expect(rec.warnings.some((w) => w.id === 'ice')).toBe(true)
    expect(hasItem(rec, 'base_warm')).toBe(true)
  })

  it('descenso largo: aviso de enfriamiento por velocidad', () => {
    const rec = recommendClothing(
      input({
        longDescent: { fromKm: 20, toKm: 40, dropM: 900, minutes: 30, maxSpeedKmh: 55 },
      }),
    )
    expect(rec.warnings.some((w) => w.id === 'long-descent')).toBe(true)
  })

  it('sin datos meteorológicos devuelve un aviso, no prendas inventadas', () => {
    const rec = recommendClothing(input({ apparent: [null, null, null, null, null] }))
    expect(rec.items).toHaveLength(0)
    expect(rec.warnings.some((w) => w.id === 'no-weather-data')).toBe(true)
  })
})
