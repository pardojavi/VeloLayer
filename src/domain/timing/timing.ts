export interface TimingProfile {
  /** Velocidad en llano, km/h. */
  flatSpeedKmh: number
  /** Velocidad ascensional: metros de desnivel positivo por hora (VAM). */
  climbVamMph: number
  /** Velocidad aproximada en descenso, km/h. */
  descentSpeedKmh: number
}

export interface TimingPoint {
  cumKm: number
  ele: number | null
}

export interface TimingResult {
  /** Hora estimada de paso por cada punto (ms). */
  passageMs: number[]
  arrivalMs: number
  avgSpeedKmh: number
  /** true si la hora de llegada proporcionada reescaló el modelo. */
  scaled: boolean
  /** Duración total del modelo antes de reescalado. */
  modelDurationMin: number
}

/**
 * Modelo sencillo y configurable:
 *  - llano (sin desnivel neto): tiempo = distancia / velocidad en llano;
 *  - subida (desnivel positivo): se añade desnivel positivo / VAM;
 *  - bajada (desnivel neto negativo): distancia / velocidad de descenso.
 * Si se proporciona hora de llegada, los tiempos se reparten de forma
 * proporcional conservando el reparto por desnivel y se deriva la
 * velocidad media coherente. No es una predicción exacta.
 */
export function estimateTiming(
  points: readonly TimingPoint[],
  departureMs: number,
  arrivalMs: number | null,
  profile: TimingProfile,
): TimingResult {
  const n = points.length
  if (n === 0) return { passageMs: [], arrivalMs: departureMs, avgSpeedKmh: 0, scaled: false, modelDurationMin: 0 }

  const cumHours: number[] = new Array(n).fill(0)
  let acc = 0

  for (let i = 1; i < n; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const horizKm = Math.max(0, cur.cumKm - prev.cumKm)
    const dEle =
      prev.ele !== null && cur.ele !== null ? cur.ele - prev.ele : 0

    let hours = 0
    if (horizKm > 0) {
      const speed =
        dEle < 0 && profile.descentSpeedKmh > 0
          ? profile.descentSpeedKmh
          : profile.flatSpeedKmh
      hours += horizKm / Math.max(1, speed)
    }
    if (dEle > 0 && profile.climbVamMph > 0) {
      hours += dEle / profile.climbVamMph
    }

    acc += hours
    cumHours[i] = acc
  }

  const modelTotalMs = acc * 3600_000
  const modelDurationMin = Math.round(modelTotalMs / 60_000)
  const distanceKm = points[n - 1].cumKm

  const passageMs: number[] = new Array(n)
  let finalArrivalMs: number
  let scaled = false

  if (arrivalMs !== null && arrivalMs > departureMs && modelTotalMs > 0) {
    const factor = (arrivalMs - departureMs) / modelTotalMs
    for (let i = 0; i < n; i++) passageMs[i] = departureMs + cumHours[i] * 3600_000 * factor
    finalArrivalMs = arrivalMs
    scaled = true
  } else if (modelTotalMs > 0) {
    for (let i = 0; i < n; i++) passageMs[i] = departureMs + cumHours[i] * 3600_000
    finalArrivalMs = departureMs + modelTotalMs
  } else {
    // Sin distancia (línea estática): todos los puntos comparten la salida.
    for (let i = 0; i < n; i++) passageMs[i] = departureMs
    finalArrivalMs = arrivalMs ?? departureMs
  }

  const durationH = (finalArrivalMs - departureMs) / 3600_000
  const avgSpeedKmh = durationH > 0 ? Math.round((distanceKm / durationH) * 10) / 10 : 0

  return { passageMs, arrivalMs: finalArrivalMs, avgSpeedKmh, scaled, modelDurationMin }
}

/** Combina una fecha local 'YYYY-MM-DD' y una hora 'HH:mm' en ms (zona local). */
export function localToMs(date: string, time: string): number {
  const ms = new Date(`${date}T${time}:00`).getTime()
  return Number.isFinite(ms) ? ms : Date.now()
}

/**
 * Hora de llegada a partir de la salida: si la hora dada es anterior o igual
 * a la salida, se interpreta como el día siguiente.
 */
export function arrivalFromTime(departureMs: number, date: string, time: string): number {
  const ms = localToMs(date, time)
  return ms > departureMs ? ms : ms + 24 * 3600_000
}
