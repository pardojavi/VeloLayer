import type { ClothingInput, LongDescent } from './clothing/clothingEngine'
import { round1 } from './format'
import { isNightAt, snapshotAt, uvAt } from './forecast/interpolation'
import { ridingApparentC } from './thermal-comfort/thermal'
import type { ThermalSensitivity, LocationForecast, PointWeather, RoutePlan } from './types'
import { feltWindSpeed, relativeWind } from './wind/wind'

/** Velocidad estimada del ciclista en cada tramo (km/h) a partir de los tiempos. */
export function riderSpeeds(plan: RoutePlan): number[] {
  const n = plan.points.length
  const out = new Array<number>(n).fill(0)
  if (plan.source === 'static') return out
  for (let i = 1; i < n; i++) {
    const dtH = (plan.points[i].arrivalMs - plan.points[i - 1].arrivalMs) / 3_600_000
    const dKm = plan.points[i].cumKm - plan.points[i - 1].cumKm
    out[i] = dtH > 0 ? round1(dKm / dtH) : 0
  }
  out[0] = out[1] ?? 0
  return out
}

/**
 * Une el plan de ruta con la previsión consultada para cada punto muestreado:
 * interpola valores horarios a la hora estimada de paso, calcula viento
 * relativo y sensación térmica en marcha.
 */
export function buildPointWeather(
  plan: RoutePlan,
  forecasts: LocationForecast[],
): PointWeather[] {
  const speeds = riderSpeeds(plan)

  return plan.points.map((p, i) => {
    const base: PointWeather = {
      index: i,
      timeMs: p.arrivalMs,
      temperature: null,
      apparent: null,
      windSpeed: null,
      windDirection: null,
      windGust: null,
      precipitation: null,
      precipitationProbability: null,
      cloudCover: null,
      weatherCode: null,
      uvIndex: null,
      isNight: null,
      relativeWind: null,
      feltWindKmh: null,
      feltApparentC: null,
      feltMethod: null,
      outOfRange: true,
    }

    const f = forecasts[i]
    if (!f) return base

    const snap = snapshotAt(f.hourly, p.arrivalMs)
    const uv = uvAt(f.daily, p.arrivalMs)
    const night = isNightAt(f.daily, p.arrivalMs)

    const windSpeed = snap.windSpeed
    const windDir = snap.windDirection
    const felt =
      windSpeed !== null && windDir !== null
        ? feltWindSpeed(windDir, windSpeed, p.bearingDeg, speeds[i])
        : windSpeed
    const rel =
      windSpeed !== null && windDir !== null
        ? relativeWind(windDir, windSpeed, p.bearingDeg)
        : null
    const apparent = ridingApparentC(snap.temperature, snap.apparent, felt)

    return {
      index: i,
      timeMs: p.arrivalMs,
      temperature: snap.temperature,
      apparent: snap.apparent,
      windSpeed,
      windDirection: windDir,
      windGust: snap.windGust,
      precipitation: snap.precipitation,
      precipitationProbability: snap.precipitationProbability,
      cloudCover: snap.cloudCover,
      weatherCode: snap.weatherCode,
      uvIndex: uv,
      isNight: night,
      relativeWind: rel,
      feltWindKmh: felt,
      feltApparentC: apparent.valueC,
      feltMethod: apparent.method,
      outOfRange: snap.outOfRange !== false,
    }
  })
}

/** Descenso continuo más largo del track (para avisar del enfriamiento en bajada). */
export function longestDescent(plan: RoutePlan): LongDescent | null {
  const pts = plan.points
  let best: LongDescent | null = null
  let cur: LongDescent | null = null

  const close = (d: LongDescent | null) => {
    if (d && (!best || d.dropM > best.dropM)) best = d
  }

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (a.ele === null || b.ele === null) {
      close(cur)
      cur = null
      continue
    }
    const dEle = b.ele - a.ele
    const dtMin = Math.max(0, Math.round((b.arrivalMs - a.arrivalMs) / 60_000))
    const dKm = b.cumKm - a.cumKm

    if (dEle < 0) {
      if (!cur) cur = { fromKm: a.cumKm, toKm: b.cumKm, dropM: 0, minutes: 0, maxSpeedKmh: 0 }
      cur.toKm = b.cumKm
      cur.dropM += -dEle
      cur.minutes += dtMin
      const speed = dtMin > 0 ? (dKm / dtMin) * 60 : 0
      cur.maxSpeedKmh = Math.max(cur.maxSpeedKmh, round1(speed))
    } else {
      close(cur)
      cur = null
    }
  }
  close(cur)
  return best
}

/** Datos de entrada del motor de ropa a partir del análisis de la ruta. */
export function buildClothingInput(
  plan: RoutePlan,
  weather: PointWeather[],
  sensitivity: ThermalSensitivity,
): ClothingInput {
  const uvValues = weather
    .map((w) => w.uvIndex)
    .filter((v): v is number => v !== null && Number.isFinite(v))

  return {
    timesMs: plan.points.map((p) => p.arrivalMs),
    cumKm: plan.points.map((p) => p.cumKm),
    apparent: weather.map((w) => w.feltApparentC),
    precipProb: weather.map((w) => w.precipitationProbability),
    precipMmH: weather.map((w) => w.precipitation),
    gustKmh: weather.map((w) => w.windGust),
    headKmh: weather.map((w) => w.relativeWind?.headKmh ?? null),
    uvIndexMax: uvValues.length > 0 ? Math.max(...uvValues) : null,
    nightStart: weather[0]?.isNight === true,
    nightEnd: weather.length > 0 && weather[weather.length - 1]?.isNight === true,
    longDescent: longestDescent(plan),
    sensitivity,
  }
}
