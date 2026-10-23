import type { Settings } from './types'
import { SETTINGS_SCHEMA_VERSION, SPEED_PRESETS } from './types'

/** Fecha local 'YYYY-MM-DD' para mañana (o para hoy, si `tomorrow` es false). */
export function localDateString(date: Date, tomorrow = false): string {
  const d = new Date(date)
  if (tomorrow) d.setDate(d.getDate() + 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function createDefaultSettings(now: Date = new Date()): Settings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    planMode: 'place',
    // Por defecto: mañana, cuando no existe una selección previa válida.
    date: localDateString(now, true),
    startTime: '09:00',
    place: null,
    destination: null,
    circular: false,
    // Sin duración ni hora de vuelta prefijadas: el modelo estima la llegada
    // a partir de las velocidades (y, en modo estático, se usan 3 h).
    durationMin: null,
    arrivalTime: null,
    speedPreset: 'medium',
    avgSpeedKmh: SPEED_PRESETS.medium,
    climbVamMph: 700,
    descentSpeedKmh: 35,
    sensitivity: 'normal',
    theme: 'light',
    lastTrackId: null,
    lastAppView: 'plan',
    lastResultTab: 'summary',
    axisMode: 'time',
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function sanitizeDate(value: unknown, now: Date): string {
  if (typeof value === 'string' && DATE_RE.test(value)) {
    const parsed = new Date(`${value}T12:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      // Una fecha pasada ya no es válida: se corrige de forma segura.
      const today = new Date(`${localDateString(now)}T12:00:00`)
      if (parsed.getTime() >= today.getTime()) return value
      return localDateString(now, true)
    }
  }
  return localDateString(now, true)
}

function sanitizeTime(value: unknown, fallback: string): string {
  if (typeof value === 'string' && TIME_RE.test(value)) {
    const [h, m] = value.split(':').map(Number)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return value
  }
  return fallback
}

function sanitizePoint(v: unknown): Settings['place'] {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  if (!isFiniteNumber(p.lat) || !isFiniteNumber(p.lon)) return null
  if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) return null
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Lugar guardado'
  return { name, lat: p.lat, lon: p.lon }
}

/**
 * Normaliza cualquier dato leído del almacenamiento. Nunca lanza: si un valor
 * no es válido se sustituye por el valor por defecto.
 */
export function sanitizeSettings(raw: unknown, now: Date = new Date()): Settings {
  const defaults = createDefaultSettings(now)
  if (!raw || typeof raw !== 'object') return defaults
  const s = raw as Record<string, unknown>

  const planMode =
    s.planMode === 'location' || s.planMode === 'place' || s.planMode === 'gpx'
      ? s.planMode
      : defaults.planMode

  const speedPreset =
    s.speedPreset === 'relaxed' || s.speedPreset === 'medium' || s.speedPreset === 'fast' || s.speedPreset === 'custom'
      ? s.speedPreset
      : defaults.speedPreset

  const sensitivity =
    s.sensitivity === 'friolero' || s.sensitivity === 'normal' || s.sensitivity === 'caluroso'
      ? s.sensitivity
      : defaults.sensitivity

  const lastAppView =
    s.lastAppView === 'plan' || s.lastAppView === 'results' || s.lastAppView === 'settings'
      ? s.lastAppView
      : defaults.lastAppView

  const lastResultTab =
    s.lastResultTab === 'summary' || s.lastResultTab === 'charts' || s.lastResultTab === 'clothing'
      ? s.lastResultTab
      : defaults.lastResultTab

  const axisMode = s.axisMode === 'km' || s.axisMode === 'time' ? s.axisMode : defaults.axisMode

  const theme = s.theme === 'dark' ? 'dark' : 'light'

  let durationMin: number | null = null
  if (isFiniteNumber(s.durationMin) && s.durationMin > 0 && s.durationMin <= 24 * 60) {
    durationMin = Math.round(s.durationMin)
  }

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    planMode,
    date: sanitizeDate(s.date, now),
    startTime: sanitizeTime(s.startTime, defaults.startTime),
    place: sanitizePoint(s.place),
    destination: sanitizePoint(s.destination),
    circular: s.circular === true,
    durationMin,
    // Sin hora de llegada guardada (o corrupta): no se impone ninguna
    // restricción y el modelo deriva la llegada.
    arrivalTime: sanitizeTime(s.arrivalTime, '') || null,
    speedPreset,
    avgSpeedKmh: isFiniteNumber(s.avgSpeedKmh) && s.avgSpeedKmh >= 5 && s.avgSpeedKmh <= 60
      ? s.avgSpeedKmh
      : defaults.avgSpeedKmh,
    climbVamMph: isFiniteNumber(s.climbVamMph) && s.climbVamMph >= 150 && s.climbVamMph <= 2000
      ? s.climbVamMph
      : defaults.climbVamMph,
    descentSpeedKmh: isFiniteNumber(s.descentSpeedKmh) && s.descentSpeedKmh >= 15 && s.descentSpeedKmh <= 80
      ? s.descentSpeedKmh
      : defaults.descentSpeedKmh,
    sensitivity,
    theme,
    lastTrackId: typeof s.lastTrackId === 'string' ? s.lastTrackId : null,
    lastAppView,
    lastResultTab,
    axisMode,
  }
}
