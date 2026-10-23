import type { FeltMethod } from '../types'

/** Rango de validez de la fórmula canadiense de sensación térmica por viento. */
export const WIND_CHILL_MAX_TEMP_C = 10
export const WIND_CHILL_MIN_WIND_KMH = 4.8

/**
 * Sensación térmica por viento (estándar canadiense, km/h y °C).
 * Solo dentro de su rango de validez: temperatura ≤ 10 °C y viento > 4,8 km/h.
 * Fuera de ese rango devuelve null: no se extrapolan fórmulas.
 */
export function windChillC(tempC: number, windKmh: number): number | null {
  if (!Number.isFinite(tempC) || !Number.isFinite(windKmh)) return null
  if (tempC > WIND_CHILL_MAX_TEMP_C || windKmh <= WIND_CHILL_MIN_WIND_KMH) return null
  const v = Math.pow(Math.max(windKmh, 0.1), 0.16)
  const chill = 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v
  return Math.round(chill * 10) / 10
}

export interface RidingApparent {
  valueC: number | null
  method: FeltMethod | null
  /** true cuando se ha usado la variable aparente de la API por estar la fórmula fuera de rango. */
  usedApiApparent: boolean
}

/**
 * Sensación estimada durante la marcha:
 *  - si la fórmula de viento es válida (T ≤ 10 °C y viento percibido > 4,8 km/h)
 *    se usa con la velocidad del viento que percibe el ciclista;
 *  - en caso contrario se usa la temperatura aparente de la API
 *    (combina viento, humedad y radiación solar).
 * Es una estimación orientativa, no una medición.
 */
export function ridingApparentC(
  tempC: number | null,
  apiApparentC: number | null,
  feltWindKmh: number | null,
): RidingApparent {
  if (tempC === null || !Number.isFinite(tempC)) {
    if (apiApparentC !== null) return { valueC: apiApparentC, method: 'api-apparent', usedApiApparent: true }
    return { valueC: null, method: null, usedApiApparent: false }
  }

  const chill = windChillC(tempC, feltWindKmh ?? 0)
  if (chill !== null) {
    return { valueC: chill, method: 'wind-chill', usedApiApparent: false }
  }
  if (apiApparentC !== null && Number.isFinite(apiApparentC)) {
    return { valueC: apiApparentC, method: 'api-apparent', usedApiApparent: true }
  }
  return { valueC: tempC, method: null, usedApiApparent: false }
}
