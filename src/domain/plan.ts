import { AppError } from './errors'
import { computeTrackStats, densifyLine, deriveTrackPoints } from './track/geometry'
import type { DerivedTrackPoint } from './track/geometry'
import { sampleIndices } from './track/sampling'
import { arrivalFromTime, estimateTiming, localToMs } from './timing/timing'
import type { TimingProfile } from './timing/timing'
import type {
  GeoPoint,
  PlanNote,
  RawTrackPoint,
  RoutePlan,
  RoutePoint,
  Settings,
} from './types'

/** Duración interna cuando no hay track, destino ni duración (modo estático). */
export const STATIC_FALLBACK_MIN = 180
const STATIC_STEP_MIN = 30

export interface BuildPlanInput {
  settings: Settings
  /** Puntos del track GPX ya parseados y validados (modo 'gpx'). */
  track: RawTrackPoint[] | null
  /** Coordenadas resueltas de "ubicación actual" (modo 'location'). */
  location: GeoPoint | null
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

function finishLinePlan(
  derived: DerivedTrackPoint[],
  geometry: GeoPoint[],
  departureMs: number,
  targetArrivalMs: number | null,
  settings: Settings,
  source: 'gpx' | 'straight-line',
): RoutePlan {
  const profile: TimingProfile = {
    flatSpeedKmh: settings.avgSpeedKmh,
    climbVamMph: settings.climbVamMph,
    descentSpeedKmh: settings.descentSpeedKmh,
  }

  const sampled = sampleIndices(derived)
  const timing = estimateTiming(derived, departureMs, targetArrivalMs, profile)
  const statsAll = computeTrackStats(derived)
  const hasEle = derived.some((p) => p.ele !== null)

  const points: RoutePoint[] = sampled.map((di, k) => {
    const p = derived[di]
    return {
      index: k,
      lat: p.lat,
      lon: p.lon,
      ele: p.ele,
      cumKm: round3(p.cumKm),
      bearingDeg: p.bearingDeg,
      arrivalMs: timing.passageMs[di],
    }
  })

  const notes: PlanNote[] = []
  if (source === 'straight-line') {
    notes.push({
      code: 'straight-line-approx',
      severity: 'warning',
      message:
        'Sin enrutador ciclista: la línea recta es una aproximación, no una ruta de ciclismo real. ' +
        'Distancias y tiempos son estimaciones.',
    })
  }
  if (source === 'gpx' && !hasEle) {
    notes.push({
      code: 'no-elevation',
      severity: 'warning',
      message: 'El GPX no incluye altitud: el desnivel y el reparto de tiempos son aproximados.',
    })
  }
  if (source === 'gpx' && settings.circular) {
    notes.push({
      code: 'circular-gpx',
      severity: 'info',
      message: 'El track ya define la forma completa de la ruta; "ruta circular" no lo modifica.',
    })
  }
  if (timing.scaled) {
    notes.push({
      code: 'arrival-scaled',
      severity: 'info',
      message:
        `Hora de llegada aplicada: el modelo por desnivel se ha repartido para terminar a la hora ` +
        `indicada (velocidad media derivada: ${timing.avgSpeedKmh} km/h).`,
    })
  }

  return {
    source,
    points,
    geometry,
    departureMs,
    arrivalMs: timing.arrivalMs,
    stats: {
      distanceKm: Math.round(statsAll.distanceKm * 10) / 10,
      ascentM: hasEle ? statsAll.ascentM : null,
      descentM: hasEle ? statsAll.descentM : null,
      durationMin: Math.max(0, Math.round((timing.arrivalMs - departureMs) / 60_000)),
      avgSpeedKmh: timing.avgSpeedKmh,
    },
    notes,
  }
}

/**
 * Construye el plan de ruta a partir de los ajustes, un track GPX (si lo hay)
 * y la ubicación resuelta. Determinista y sin efectos secundarios: la
 * elevación y el tiempo se resuelven fuera, en servicios y hooks.
 */
export function buildRoutePlan({ settings, track, location }: BuildPlanInput): RoutePlan {
  const s = settings
  const departureMs = localToMs(s.date, s.startTime)
  const targetArrivalMs = s.arrivalTime
    ? arrivalFromTime(departureMs, s.date, s.arrivalTime)
    : s.durationMin !== null
      ? departureMs + s.durationMin * 60_000
      : null

  if (s.planMode === 'gpx') {
    if (!track || track.length < 2) {
      throw new AppError('gpx-invalid', 'Selecciona un track GPX con al menos dos puntos.')
    }
    const derived = deriveTrackPoints(track)
    return finishLinePlan(
      derived,
      track.map((p) => ({ lat: p.lat, lon: p.lon })),
      departureMs,
      targetArrivalMs,
      s,
      'gpx',
    )
  }

  const start: GeoPoint | null = s.planMode === 'location' ? location : s.place
  if (!start) {
    throw new AppError(
      'no-start-point',
      s.planMode === 'location'
        ? 'No se ha podido obtener tu ubicación actual.'
        : 'Elige un lugar de salida: búscalo o selecciónalo en el mapa.',
    )
  }

  if (s.destination) {
    const legs: Array<[GeoPoint, GeoPoint]> = [[start, s.destination]]
    if (s.circular) legs.push([s.destination, start])

    const raw: RawTrackPoint[] = []
    for (const [a, b] of legs) {
      const leg = densifyLine(a, b, 1)
      for (let i = raw.length > 0 ? 1 : 0; i < leg.length; i++) {
        raw.push({ lat: leg[i].lat, lon: leg[i].lon, ele: null, time: null })
      }
    }

    const derived = deriveTrackPoints(raw)
    return finishLinePlan(
      derived,
      raw.map((p) => ({ lat: p.lat, lon: p.lon })),
      departureMs,
      targetArrivalMs,
      s,
      'straight-line',
    )
  }

  // Sin track ni destino: línea de tiempo meteorológica en el punto elegido.
  const endMs = targetArrivalMs ?? departureMs + STATIC_FALLBACK_MIN * 60_000
  const stepMs = STATIC_STEP_MIN * 60_000
  const n = Math.min(48, Math.max(2, Math.ceil((endMs - departureMs) / stepMs) + 1))

  const points: RoutePoint[] = []
  for (let i = 0; i < n; i++) {
    points.push({
      index: i,
      lat: start.lat,
      lon: start.lon,
      ele: null,
      cumKm: 0,
      bearingDeg: null,
      arrivalMs: Math.min(departureMs + i * stepMs, endMs),
    })
  }
  points[n - 1].arrivalMs = endMs

  const notes: PlanNote[] = [
    {
      code: 'static-timeline',
      severity: 'info',
      message:
        'Sin track ni destino: se muestra la previsión por hora en el punto elegido ' +
        '(no hay distancia que estimar).',
    },
  ]
  if (targetArrivalMs === null) {
    notes.push({
      code: 'fallback-duration',
      severity: 'info',
      message: `Sin duración indicada: se usan ${STATIC_FALLBACK_MIN / 60} h por defecto.`,
    })
  }

  return {
    source: 'static',
    points,
    geometry: [start],
    departureMs,
    arrivalMs: endMs,
    stats: {
      distanceKm: 0,
      ascentM: null,
      descentM: null,
      durationMin: Math.round((endMs - departureMs) / 60_000),
      avgSpeedKmh: 0,
    },
    notes,
  }
}
