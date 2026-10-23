import rulesJson from '../../rules/clothing.json'
import { fmtTime, round1 } from '../format'
import type {
  Advice,
  ClothingGroup,
  ClothingItem,
  ClothingRecommendation,
  ThermalSensitivity,
} from '../types'

// ---------------------------------------------------------------------------
// Tipos del archivo de reglas (versionado en src/rules/clothing.json)
// ---------------------------------------------------------------------------

export interface BandRule {
  minC: number
  items: string[]
}

export interface CatalogEntry {
  label: string
  group: ClothingGroup
}

export interface Adjustments {
  layerRangeC: number
  coldStartC: number
  coldStartWindowMin: number
  longDescentMinDropM: number
  longDescentMinMinutes: number
  rainPocketProbPct: number
  rainGearProbPct: number
  rainGearMmH: number
  heavyRainMmH: number
  gustWarningKmh: number
  headwindJacketKmh: number
  headwindJacketMinutes: number
  uvProtectIndex: number
  iceWarningC: number
}

export interface RulesFile {
  version: number
  sensitivityOffsetC: Record<ThermalSensitivity, number>
  catalog: Record<string, CatalogEntry>
  bands: Record<'head' | 'torso' | 'hands' | 'legs' | 'feet', BandRule[]>
  adjustments: Adjustments
}

export const RULES: RulesFile = rulesJson as unknown as RulesFile

// ---------------------------------------------------------------------------
// Entrada del motor
// ---------------------------------------------------------------------------

export interface LongDescent {
  fromKm: number
  toKm: number
  dropM: number
  minutes: number
  maxSpeedKmh: number
}

export interface ClothingInput {
  timesMs: number[]
  cumKm: number[]
  /** Sensación térmica estimada en marcha por punto (puede contener null). */
  apparent: (number | null)[]
  precipProb: (number | null)[]
  precipMmH: (number | null)[]
  gustKmh: (number | null)[]
  /** Componente de frente del viento meteorológico (positiva = de frente). */
  headKmh: (number | null)[]
  uvIndexMax: number | null
  nightStart: boolean
  nightEnd: boolean
  longDescent: LongDescent | null
  sensitivity: ThermalSensitivity
}

const REGION_KEYS = ['torso', 'legs', 'hands', 'head', 'feet'] as const

const SENSITIVITY_LABEL: Record<ThermalSensitivity, string> = {
  friolero: 'friolero',
  normal: 'normal',
  caluroso: 'caluroso',
}

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

function finite(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null && Number.isFinite(v))
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

interface Peak {
  value: number
  index: number
}

function argmax(values: (number | null)[]): Peak | null {
  let best: Peak | null = null
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null || !Number.isFinite(v)) continue
    if (!best || v > best.value) best = { value: v, index: i }
  }
  return best
}

function argmin(values: (number | null)[]): Peak | null {
  let best: Peak | null = null
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null || !Number.isFinite(v)) continue
    if (!best || v < best.value) best = { value: v, index: i }
  }
  return best
}

function where(input: ClothingInput, index: number): string {
  const t = input.timesMs[index]
  const km = input.cumKm[index]
  const time = t !== undefined && Number.isFinite(t) ? `a las ${fmtTime(t)}` : ''
  const place = km !== undefined && Number.isFinite(km) ? `en el km ${Math.round(km * 10) / 10}` : ''
  return [time, place].filter(Boolean).join(' ') || 'en la ruta'
}

function pickBand(bands: BandRule[], refTempC: number): BandRule | null {
  for (const band of bands) {
    if (refTempC >= band.minC) return band
  }
  return bands.length > 0 ? bands[bands.length - 1] : null
}

// ---------------------------------------------------------------------------
// Motor de recomendación
// ---------------------------------------------------------------------------

/**
 * Reglas explícitas y configurables, separadas de la presentación.
 * Cada prenda o aviso indica el dato, el tramo y la hora que lo justifican.
 */
export function recommendClothing(
  input: ClothingInput,
  rules: RulesFile = RULES,
): ClothingRecommendation {
  const values = finite(input.apparent)

  if (values.length === 0) {
    return {
      referenceTempC: 0,
      meanApparentC: 0,
      minApparentC: 0,
      maxApparentC: 0,
      items: [],
      warnings: [
        {
          id: 'no-weather-data',
          title: 'Sin datos meteorológicos',
          detail: 'No se ha podido calcular la sensación térmica de la ruta.',
          severity: 'warning',
        },
      ],
    }
  }

  const mean = round1(avg(values))
  const minPeak = argmin(input.apparent)
  const maxPeak = argmax(input.apparent)
  const minV = minPeak ? round1(minPeak.value) : mean
  const maxV = maxPeak ? round1(maxPeak.value) : mean
  const minIdx = minPeak ? minPeak.index : 0
  const maxIdx = maxPeak ? maxPeak.index : 0

  const offset = rules.sensitivityOffsetC[input.sensitivity] ?? 0
  // La sensibilidad suma o resta grados a los UMBRALES de frío (friolero
  // suma 3 °C ⇒ se comporta como si hicieran 3 °C menos), por lo que se
  // resta a la temperatura de referencia.
  const ref = round1(mean - offset)

  const items: ClothingItem[] = []
  const warnings: Advice[] = []

  const sensNote =
    input.sensitivity === 'normal'
      ? ''
      : ` (sensibilidad: ${SENSITIVITY_LABEL[input.sensitivity]})`

  const coldReason =
    `Sensación estimada de ${minV} °C ${where(input, minIdx)}, mínimo de la ruta; ` +
    `media ${mean} °C${sensNote}.`
  const warmReason =
    `Sensación estimada de ${maxV} °C ${where(input, maxIdx)}, máximo de la ruta; ` +
    `media ${mean} °C${sensNote}.`
  const bandReason = ref < 18 ? coldReason : warmReason

  // Prendas por zona según la temperatura de referencia.
  for (const key of REGION_KEYS) {
    const band = pickBand(rules.bands[key], ref)
    if (!band) continue
    for (const id of band.items) {
      const entry = rules.catalog[id]
      items.push({
        id,
        label: entry?.label ?? id,
        group: entry?.group ?? key,
        reason: bandReason,
      })
    }
  }

  const adj = rules.adjustments

  // Diferencia grande entre sensación máxima y mínima → capas extraíbles.
  if (maxV - minV >= adj.layerRangeC) {
    items.push({
      id: 'removable_layers',
      label: rules.catalog.removable_layers?.label ?? 'Capas extraíbles',
      group: 'pocket',
      reason:
        `La sensación varía ${round1(maxV - minV)} °C (de ${minV} °C ${where(input, minIdx)} ` +
        `a ${maxV} °C ${where(input, maxIdx)}): lleva una capa que puedas quitar o poner en marcha.`,
    })
  }

  // Primera media hora más fría que la media → capa adicional para la salida.
  const windowMs = adj.coldStartWindowMin * 60_000
  const firstWindow = input.apparent.filter(
    (_v, i) => input.timesMs[i] !== undefined && input.timesMs[i] - input.timesMs[0] <= windowMs,
  )
  const firstValues = finite(firstWindow)
  if (firstValues.length > 0) {
    const firstMean = avg(firstValues)
    if (mean - firstMean >= adj.coldStartC) {
      items.push({
        id: 'extra_start',
        label: rules.catalog.extra_start?.label ?? 'Capa adicional para la salida',
        group: 'pocket',
        reason:
          `Los primeros ${adj.coldStartWindowMin} min se perciben ${round1(mean - firstMean)} °C ` +
          `más fríos que la media (${round1(firstMean)} °C frente a ${mean} °C).`,
      })
    }
  }

  // Descenso prolongado: en bajada la velocidad aumenta el enfriamiento.
  const d = input.longDescent
  if (d && d.dropM >= adj.longDescentMinDropM && d.minutes >= adj.longDescentMinMinutes) {
    warnings.push({
      id: 'long-descent',
      title: 'Descenso prolongado',
      detail:
        `De ${Math.round(d.fromKm)} km a ${Math.round(d.toKm)} km bajan ${Math.round(d.dropM)} m ` +
        `en ${d.minutes} min (hasta ${Math.round(d.maxSpeedKmh)} km/h estimados). En bajada el ` +
        `enfriamiento percibido aumenta: considera el chaleco o la chaqueta aunque la hora sea templada. ` +
        `Estimación orientativa, no una medición.`,
      severity: 'info',
    })
  }

  // Lluvia.
  const probPeak = argmax(input.precipProb)
  const precipPeak = argmax(input.precipMmH)

  if (probPeak && probPeak.value >= adj.rainPocketProbPct) {
    items.push({
      id: 'light_rain_shell',
      label: rules.catalog.light_rain_shell?.label ?? 'Capa impermeable ligera',
      group: 'pocket',
      reason: `Probabilidad de lluvia del ${Math.round(probPeak.value)} % ${where(input, probPeak.index)}.`,
    })
  }

  const rainGear =
    (probPeak && probPeak.value >= adj.rainGearProbPct) ||
    (precipPeak && precipPeak.value >= adj.rainGearMmH)

  if (rainGear) {
    const reasonBits: string[] = []
    if (probPeak && probPeak.value >= adj.rainGearProbPct) {
      reasonBits.push(`${Math.round(probPeak.value)} % ${where(input, probPeak.index)}`)
    }
    if (precipPeak && precipPeak.value >= adj.rainGearMmH) {
      reasonBits.push(
        `${round1(precipPeak.value)} mm/h ${where(input, precipPeak.index)}`,
      )
    }
    items.push({
      id: 'rain_shell',
      label: rules.catalog.rain_shell?.label ?? 'Chubasquero',
      group: 'pocket',
      reason: `Previsión de lluvia: ${reasonBits.join(' y ')}.`,
    })
    warnings.push({
      id: 'rain-gear',
      title: 'Lluvia probable',
      detail:
        'Además del chubasquero, valora cubrezapatillas impermeables y guardabarros ' +
        'para los tramos con lluvia sostenida.',
      severity: 'warning',
    })
  }

  if (precipPeak && precipPeak.value >= adj.heavyRainMmH) {
    warnings.push({
      id: 'heavy-rain',
      title: 'Lluvia intensa prevista',
      detail:
        `${round1(precipPeak.value)} mm/h ${where(input, precipPeak.index)}. ` +
        'Valora aplazar o acortar la salida.',
      severity: 'danger',
    })
  }

  // Viento.
  const gustPeak = argmax(input.gustKmh)
  if (gustPeak && gustPeak.value >= adj.gustWarningKmh) {
    warnings.push({
      id: 'gusts',
      title: 'Rachas de viento',
      detail: `Rachas de ${Math.round(gustPeak.value)} km/h ${where(input, gustPeak.index)}.`,
      severity: 'warning',
    })
  }

  const headPeak = argmax(input.headKmh)
  let headMinutes = 0
  if (headPeak && headPeak.value >= adj.headwindJacketKmh) {
    for (let i = 1; i < input.headKmh.length; i++) {
      const v = input.headKmh[i]
      if (v !== null && v >= adj.headwindJacketKmh && input.timesMs[i] !== undefined) {
        headMinutes += Math.round((input.timesMs[i] - input.timesMs[i - 1]) / 60_000)
      }
    }
    if (headMinutes >= adj.headwindJacketMinutes) {
      items.push({
        id: 'wind_pocket',
        label: rules.catalog.wind_pocket?.label ?? 'Chaleco cortavientos',
        group: 'pocket',
        reason:
          `Viento de frente sostenido: componente de hasta ${Math.round(headPeak.value)} km/h ` +
          `${where(input, headPeak.index)} y ${headMinutes} min por encima de ` +
          `${adj.headwindJacketKmh} km/h.`,
      })
    }
  }

  // UV.
  if (input.uvIndexMax !== null && input.uvIndexMax >= adj.uvProtectIndex) {
    items.push({
      id: 'sun_protection',
      label: rules.catalog.sun_protection?.label ?? 'Protección solar',
      group: 'pocket',
      reason: `Índice UV máximo previsto: ${Math.round(input.uvIndexMax)}.`,
    })
  }

  // Antes del amanecer o después del ocaso.
  if (input.nightStart || input.nightEnd) {
    const bits = [
      input.nightStart ? 'la salida es antes del amanecer' : null,
      input.nightEnd ? 'la llegada es después del ocaso' : null,
    ].filter(Boolean)
    items.push({
      id: 'lights',
      label: rules.catalog.lights?.label ?? 'Luces delantera y trasera',
      group: 'pocket',
      reason: `Segmento nocturno: ${bits.join(' y ')}.`,
    })
    warnings.push({
      id: 'reflective',
      title: 'Elementos reflectantes',
      detail: 'Con poca luz, añade prendas reflectantes y revisa que las luces estén cargadas.',
      severity: 'info',
    })
  }

  // Hielo.
  if (ref < adj.iceWarningC || minV < adj.iceWarningC) {
    warnings.push({
      id: 'ice',
      title: 'Posible hielo',
      detail:
        `Mínimo previsto de ${minV} °C ${where(input, minIdx)}. ` +
        'Cuidado en descensos, puentes y curvas con sombra.',
      severity: 'warning',
    })
  }

  // Deduplicar por id conservando el primer aparecido.
  const seen = new Set<string>()
  const uniqueItems = items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  return {
    referenceTempC: ref,
    meanApparentC: mean,
    minApparentC: minV,
    maxApparentC: maxV,
    items: uniqueItems,
    warnings,
  }
}
