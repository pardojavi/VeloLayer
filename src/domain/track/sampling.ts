import type { DerivedTrackPoint } from './geometry'

export interface SamplingOptions {
  /** Máximo de puntos muestreados (limita las peticiones meteorológicas). */
  maxPoints?: number
  /** Separación mínima entre puntos, km. */
  minKm?: number
  /** Cambio de altitud que obliga a muestrear antes de tiempo, metros. */
  eleJumpM?: number
}

/**
 * Elige los índices a muestrear: cada 2–5 km aproximadamente, acortando
 * cuando hay cambios relevantes de altitud y sin superar `maxPoints`
 * (importante porque cada punto es una petición a la API meteorológica).
 * En rutas muy largas la separación objetivo puede superar los 5 km: el
 * límite de peticiones manda sobre la separación aproximada.
 * El primer y el último punto se incluyen siempre.
 */
export function sampleIndices(
  points: readonly DerivedTrackPoint[],
  opts: SamplingOptions = {},
): number[] {
  const n = points.length
  if (n === 0) return []
  if (n === 1) return [0]

  const maxPoints = opts.maxPoints ?? 40
  const minKm = opts.minKm ?? 2
  const eleJumpM = opts.eleJumpM ?? 150

  if (n <= maxPoints) return points.map((_, i) => i)

  const distanceKm = points[n - 1].cumKm
  const target = Math.max(4, maxPoints - 1)
  const stepKm = Math.max(minKm, distanceKm / target)

  const chosen = new Set<number>([0])
  let lastCum = points[0].cumKm
  let lastEle = points[0].ele

  for (let i = 1; i < n - 1; i++) {
    const p = points[i]
    const gap = p.cumKm - lastCum
    const eleJump =
      p.ele !== null && lastEle !== null ? Math.abs(p.ele - lastEle) >= eleJumpM : false
    if (gap >= stepKm || eleJump) {
      chosen.add(i)
      lastCum = p.cumKm
      lastEle = p.ele
    }
  }

  chosen.add(n - 1)
  return Array.from(chosen).sort((a, b) => a - b)
}
