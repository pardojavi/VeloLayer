/** Formateadores compartidos por dominio e interfaz (zona local). */

export function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/** 'HH:mm' local para un instante en ms. */
export function fmtTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 'HH:mm' con segundos apretados (para desambiguar horas iguales). */
export function fmtTimeSec(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export function fmtKm(km: number): string {
  if (!Number.isFinite(km)) return '—'
  if (km < 10) return `${Math.round(km * 10) / 10} km`
  return `${Math.round(km)} km`
}

export function fmtTemp(c: number | null | undefined): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return '—'
  return `${Math.round(c * 10) / 10} °C`
}

export function fmtSpeed(kmh: number | null | undefined): string {
  if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) return '—'
  return `${Math.round(kmh)} km/h`
}

export function fmtDuration(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Duración en minutos entre dos instantes. */
export function minutesBetween(fromMs: number, toMs: number): number {
  return Math.max(0, Math.round((toMs - fromMs) / 60_000))
}
