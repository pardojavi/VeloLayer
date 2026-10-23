import type { GeoPoint, RawTrackPoint, TrackStats } from '../types'

const EARTH_RADIUS_M = 6371008.8

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Distancia sobre la superficie terrestre en km (haversine). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))) / 1000
}

/** Rumbo desde a hacia b en grados, 0 = norte, sentido horario. */
export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return (deg + 360) % 360
}

export interface DerivedTrackPoint extends RawTrackPoint {
  cumKm: number
  bearingDeg: number | null
}

/** Acumula distancia y rumbo por tramo; conserva los puntos originales. */
export function deriveTrackPoints(points: RawTrackPoint[]): DerivedTrackPoint[] {
  const out: DerivedTrackPoint[] = []
  let cum = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    let bearing: number | null = null
    if (i > 0) {
      const prev = points[i - 1]
      const d = haversineKm(prev, p)
      cum += d
      if (d > 0.001) bearing = bearingDeg(prev, p)
      else bearing = out[i - 1].bearingDeg
    }
    out.push({ ...p, cumKm: cum, bearingDeg: bearing })
  }
  return out
}

export function computeTrackStats(points: RawTrackPoint[]): TrackStats {
  let distanceKm = 0
  let ascent = 0
  let descent = 0
  let hasEle = false
  let hasTime = false
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p.ele !== null) hasEle = true
    if (p.time !== null) hasTime = true
    if (i === 0) continue
    distanceKm += haversineKm(points[i - 1], p)
    const prevEle = points[i - 1].ele
    if (prevEle !== null && p.ele !== null) {
      const d = p.ele - prevEle
      if (d > 0) ascent += d
      else descent += -d
    }
  }
  return {
    distanceKm,
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
    hasEle,
    hasTime,
    pointCount: points.length,
  }
}

/** Interpola un punto sobre la línea recta entre a y b (0 ≤ t ≤ 1). */
export function interpolatePoint(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }
}

/**
 * Densifica una línea recta con puntos cada `stepKm` km aproximadamente.
 * El resultado se usa como aproximación: no es una ruta ciclista real.
 */
export function densifyLine(a: GeoPoint, b: GeoPoint, stepKm = 1): GeoPoint[] {
  const total = haversineKm(a, b)
  const segments = Math.max(1, Math.ceil(total / stepKm))
  const out: GeoPoint[] = [a]
  for (let i = 1; i < segments; i++) out.push(interpolatePoint(a, b, i / segments))
  out.push(b)
  return out
}

/** Punto más cercano de `points` a `target` (índice original). */
export function nearestIndex(points: readonly GeoPoint[], target: GeoPoint): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = haversineKm(points[i], target)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}
