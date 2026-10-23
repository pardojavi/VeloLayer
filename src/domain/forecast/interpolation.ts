import type { DailySeries, HourlySeries } from '../types'

export type RangeFlag = 'before' | 'after' | false

export interface InterpolatedValue {
  value: number | null
  range: RangeFlag
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f
}

/** Índice del último instante ≤ t; -1 si t es anterior al primero. */
export function findSegment(times: readonly number[], t: number): number {
  let lo = 0
  let hi = times.length - 1
  if (t < times[0]) return -1
  if (t >= times[hi]) return hi
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= t) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Interpola linealmente entre horas adyacentes. La interpolación es solo una
 * estimación: la previsión real tiene resolución horaria.
 * Marca 'before'/'after' cuando t cae fuera del horizonte disponible.
 */
export function interpolateAt(
  times: readonly number[],
  values: readonly (number | null)[],
  t: number,
): InterpolatedValue {
  if (times.length === 0 || values.length !== times.length) return { value: null, range: false }
  const i = findSegment(times, t)
  if (i === -1) return { value: values[0] ?? null, range: 'before' }
  if (i >= times.length - 1) {
    const last = times.length - 1
    return { value: values[last] ?? null, range: t > times[last] ? 'after' : false }
  }
  const span = times[i + 1] - times[i]
  const f = span > 0 ? (t - times[i]) / span : 0
  const a = values[i]
  const b = values[i + 1]
  // Un hueco en los datos no se rellena con cero: se mantiene el último
  // valor conocido anterior; si no hay ninguno, se devuelve "sin datos".
  if (a === null || a === undefined) {
    for (let j = i - 1; j >= 0; j--) {
      const prev = values[j]
      if (prev !== null && prev !== undefined) return { value: prev, range: false }
    }
    return { value: null, range: false }
  }
  if (b === null || b === undefined) return { value: a, range: false }
  return { value: Math.round(lerp(a, b, f) * 10) / 10, range: false }
}

/** Interpola un ángulo por el camino corto (para la dirección del viento). */
export function interpolateAngle(
  times: readonly number[],
  values: readonly (number | null)[],
  t: number,
): InterpolatedValue {
  if (times.length === 0 || values.length !== times.length) return { value: null, range: false }
  const i = findSegment(times, t)
  if (i === -1) return { value: values[0] ?? null, range: 'before' }
  if (i >= times.length - 1) {
    const last = times.length - 1
    return { value: values[last] ?? null, range: t > times[last] ? 'after' : false }
  }
  const span = times[i + 1] - times[i]
  const f = span > 0 ? (t - times[i]) / span : 0
  const a = values[i]
  const b = values[i + 1]
  // Igual que interpolateAt: un hueco se cubre con el último valor conocido.
  if (a === null || a === undefined) {
    for (let j = i - 1; j >= 0; j--) {
      const prev = values[j]
      if (prev !== null && prev !== undefined) return { value: prev, range: false }
    }
    return { value: null, range: false }
  }
  if (b === null || b === undefined) return { value: a, range: false }
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  const raw = a + diff * f
  return { value: ((raw % 360) + 360) % 360, range: false }
}

/** Valor más próximo (para códigos meteorológicos: no se interpolan). */
export function nearestAt(
  times: readonly number[],
  values: readonly (number | null)[],
  t: number,
): InterpolatedValue {
  if (times.length === 0 || values.length !== times.length) return { value: null, range: false }
  const i = findSegment(times, t)
  if (i === -1) return { value: values[0] ?? null, range: 'before' }
  if (i >= times.length - 1) {
    const last = times.length - 1
    return { value: values[last] ?? null, range: t > times[last] ? 'after' : false }
  }
  const before = values[i]
  const after = values[i + 1]
  if (before === undefined) return { value: after ?? null, range: false }
  if (after === undefined) return { value: before, range: false }
  const pick = t - times[i] <= times[i + 1] - t ? before : after
  return { value: pick, range: false }
}

export interface HourlySnapshot {
  temperature: number | null
  apparent: number | null
  windSpeed: number | null
  windDirection: number | null
  windGust: number | null
  precipitation: number | null
  precipitationProbability: number | null
  cloudCover: number | null
  weatherCode: number | null
  outOfRange: RangeFlag
}

export function snapshotAt(series: HourlySeries, t: number): HourlySnapshot {
  const temp = interpolateAt(series.time, series.temperature, t)
  const apparent = interpolateAt(series.time, series.apparent, t)
  const wind = interpolateAt(series.time, series.windSpeed, t)
  const dir = interpolateAngle(series.time, series.windDirection, t)
  const gust = interpolateAt(series.time, series.windGust, t)
  const precip = interpolateAt(series.time, series.precipitation, t)
  const prob = interpolateAt(series.time, series.precipitationProbability, t)
  const cloud = interpolateAt(series.time, series.cloudCover, t)
  const code = nearestAt(series.time, series.weatherCode, t)

  const flags: RangeFlag[] = [temp.range, wind.range, code.range]
  const outOfRange: RangeFlag = flags.includes('after')
    ? 'after'
    : flags.includes('before')
      ? 'before'
      : false

  return {
    temperature: temp.value,
    apparent: apparent.value,
    windSpeed: wind.value,
    windDirection: dir.value,
    windGust: gust.value,
    precipitation: precip.value,
    precipitationProbability: prob.value,
    cloudCover: cloud.value,
    weatherCode: code.value,
    outOfRange,
  }
}

/** Índice UV máximo del día (previsión diaria) para un instante dado. */
export function uvAt(daily: DailySeries, t: number): number | null {
  if (daily.time.length === 0) return null
  const i = findSegment(daily.time, t)
  const idx = i === -1 ? 0 : i
  return daily.uvIndexMax[idx] ?? null
}

/** true si el instante cae antes del amanecer o después del ocaso. */
export function isNightAt(daily: DailySeries, t: number): boolean | null {
  if (daily.time.length === 0 || daily.sunrise.length !== daily.time.length) return null
  const i = findSegment(daily.time, t)
  const idx = i === -1 ? 0 : i
  const sunrise = daily.sunrise[idx]
  const sunset = daily.sunset[idx]
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) return null
  return t < sunrise || t > sunset
}
