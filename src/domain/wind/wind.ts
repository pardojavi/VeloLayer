import type { RelativeWind } from '../types'

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Pasa un ángulo al rango (-180, 180]. */
export function signedAngleDeg(deg: number): number {
  const n = normalizeDeg(deg)
  return n > 180 ? n - 360 : n
}

/**
 * Componentes del viento meteorológico respecto al rumbo del tramo.
 *
 * Convención de la API: `wind_direction` es el ángulo DESDE el que sopla
 * (0 = norte, 90 = este), igual que `bearingDeg` (0 = norte, sentido horario).
 * El ángulo 0 significa viento de frente. Componente de frente positiva,
 * de cola negativa; componente lateral positiva si el viento viene de la
 * derecha del ciclista.
 *
 * Devuelve null si no hay rumbo (tramo estático sin ruta).
 */
export function relativeWind(
  windFromDeg: number,
  windSpeedKmh: number,
  bearingDeg: number | null,
): RelativeWind | null {
  if (bearingDeg === null || !Number.isFinite(windFromDeg)) return null
  const alpha = signedAngleDeg(windFromDeg - bearingDeg)
  const rad = toRad(alpha)
  return {
    headKmh: Math.round(windSpeedKmh * Math.cos(rad) * 10) / 10,
    crossKmh: Math.round(windSpeedKmh * Math.sin(rad) * 10) / 10,
    angleDeg: Math.round(alpha),
  }
}

/**
 * Velocidad del viento percibida por el ciclista (vectorial: viento
 * meteorológico + velocidad propia). Es la que interesa para el enfriamiento.
 */
export function feltWindSpeed(
  windFromDeg: number,
  windSpeedKmh: number,
  bearingDeg: number | null,
  riderSpeedKmh: number,
): number {
  if (bearingDeg === null || !Number.isFinite(windFromDeg)) return windSpeedKmh
  const alpha = toRad(signedAngleDeg(windFromDeg - bearingDeg))
  const s = Math.max(0, riderSpeedKmh)
  const felt = Math.sqrt(windSpeedKmh ** 2 + s ** 2 + 2 * windSpeedKmh * s * Math.cos(alpha))
  return Math.round(felt * 10) / 10
}

/**
 * Componente de frente de lo que percibe el ciclista (incluye su velocidad):
 * positiva = viento en la cara, negativa = viento de cola.
 */
export function feltHeadwind(
  windFromDeg: number,
  windSpeedKmh: number,
  bearingDeg: number | null,
  riderSpeedKmh: number,
): number {
  if (bearingDeg === null || !Number.isFinite(windFromDeg)) return windSpeedKmh
  const alpha = toRad(signedAngleDeg(windFromDeg - bearingDeg))
  return Math.round((windSpeedKmh * Math.cos(alpha) + Math.max(0, riderSpeedKmh)) * 10) / 10
}
