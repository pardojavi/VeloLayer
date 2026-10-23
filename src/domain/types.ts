// Contratos compartidos entre dominio, servicios, almacenamiento e interfaz.
// Este archivo no contiene lógica: solo tipos y constantes de catálogo.

export type PlanMode = 'location' | 'place' | 'gpx'
export type ThermalSensitivity = 'friolero' | 'normal' | 'caluroso'
export type AppView = 'plan' | 'results' | 'settings'
export type ResultTab = 'summary' | 'charts' | 'clothing'
export type AxisMode = 'km' | 'time'
export type SpeedPreset = 'relaxed' | 'medium' | 'fast' | 'custom'
export type MapColorMode = 'temperature' | 'rain' | 'wind'
export type NoteSeverity = 'info' | 'warning'

export interface GeoPoint {
  lat: number
  lon: number
}

export interface NamedPoint extends GeoPoint {
  name: string
}

/** Velocidades medias orientativas (km/h). Son valores configurables, no predicciones. */
export const SPEED_PRESETS: Record<Exclude<SpeedPreset, 'custom'>, number> = {
  relaxed: 22,
  medium: 26,
  fast: 30,
}

export const SETTINGS_SCHEMA_VERSION = 1

/**
 * Preferencias persistidas. Deben sobrevivir a cerrar la pestaña, el
 * navegador y reiniciar el dispositivo (IndexedDB local).
 */
export interface Settings {
  schemaVersion: number
  planMode: PlanMode
  /** Fecha de salida local, 'YYYY-MM-DD'. */
  date: string
  /** Hora de salida local, 'HH:mm'. */
  startTime: string
  /** Último lugar elegido (búsqueda o selección en el mapa). */
  place: NamedPoint | null
  /** Destino elegido, si lo hay. */
  destination: NamedPoint | null
  circular: boolean
  /** Duración estimada en minutos; alternativa equivalente a hora de llegada. */
  durationMin: number | null
  /** Hora de vuelta local, 'HH:mm'; alternativa equivalente a la duración. */
  arrivalTime: string | null
  speedPreset: SpeedPreset
  avgSpeedKmh: number
  /** Velocidad ascensional (VAM) en metros de desnivel positivo por hora. */
  climbVamMph: number
  /** Velocidad estimada de descenso en km/h. */
  descentSpeedKmh: number
  sensitivity: ThermalSensitivity
  lastTrackId: string | null
  lastAppView: AppView
  lastResultTab: ResultTab
  axisMode: AxisMode
}

/** Punto de track tal y como se almacena (sin derivados). */
export interface RawTrackPoint {
  lat: number
  lon: number
  ele: number | null
  /** Época local del punto en ms, si el GPX incluye marcas de tiempo. */
  time: number | null
}

export interface TrackStats {
  distanceKm: number
  ascentM: number
  descentM: number
  hasEle: boolean
  hasTime: boolean
  pointCount: number
}

export interface TrackRecord {
  id: string
  name: string
  fileName: string
  importedAt: number
  points: RawTrackPoint[]
  stats: TrackStats
}

/** Punto muestreado de la ruta con su hora estimada de paso. */
export interface RoutePoint {
  index: number
  lat: number
  lon: number
  ele: number | null
  /** Distancia acumulada en km desde la salida. */
  cumKm: number
  /** Rumbo del tramo saliente en grados (0 = norte). Nulo sin ruta. */
  bearingDeg: number | null
  /** Hora estimada de paso (ms desde epoch). */
  arrivalMs: number
}

export type RouteSource = 'gpx' | 'straight-line' | 'static'

export interface PlanNote {
  code: string
  message: string
  severity: NoteSeverity
}

export interface RoutePlan {
  source: RouteSource
  points: RoutePoint[]
  /** Geometría completa para dibujar el track en el mapa. */
  geometry: GeoPoint[]
  departureMs: number
  arrivalMs: number
  stats: {
    distanceKm: number
    ascentM: number | null
    descentM: number | null
    durationMin: number
    avgSpeedKmh: number
  }
  notes: PlanNote[]
}

/**
 * Serie horaria de una localización (un punto muestreado).
 * Los null diferencian la ausencia de datos de un valor real igual a cero.
 */
export interface HourlySeries {
  /** Instantes UTC en ms. */
  time: number[]
  temperature: (number | null)[]
  apparent: (number | null)[]
  windSpeed: (number | null)[]
  windDirection: (number | null)[]
  windGust: (number | null)[]
  precipitation: (number | null)[]
  precipitationProbability: (number | null)[]
  cloudCover: (number | null)[]
  weatherCode: (number | null)[]
}

export interface DailySeries {
  /** Inicio de día UTC en ms. */
  time: number[]
  uvIndexMax: (number | null)[]
  sunrise: number[]
  sunset: number[]
}

export interface LocationForecast {
  lat: number
  lon: number
  elevation: number | null
  hourly: HourlySeries
  daily: DailySeries
}

export type FeltMethod = 'wind-chill' | 'api-apparent'

export interface RelativeWind {
  /** Componente de frente (positiva) o de cola (negativa), km/h. */
  headKmh: number
  /** Componente lateral; positiva = desde la derecha, km/h. */
  crossKmh: number
  /** Ángulo del viento respecto al rumbo en grados: 0 = de frente. */
  angleDeg: number | null
}

/** Tiempo meteorológico evaluado en un punto concreto de la ruta. */
export interface PointWeather {
  index: number
  timeMs: number
  temperature: number | null
  /** Temperatura aparente "de API" (incluye humedad y radiación). */
  apparent: number | null
  windSpeed: number | null
  windDirection: number | null
  windGust: number | null
  precipitation: number | null
  precipitationProbability: number | null
  cloudCover: number | null
  weatherCode: number | null
  uvIndex: number | null
  isNight: boolean | null
  relativeWind: RelativeWind | null
  /** Velocidad del viento percibida incluyendo la velocidad del ciclista. */
  feltWindKmh: number | null
  /** Sensación estimada en marcha (ver thermal.ts para el método empleado). */
  feltApparentC: number | null
  feltMethod: FeltMethod | null
  /** Instante dentro del horizonte de previsión. */
  outOfRange: boolean
}

export type ClothingGroup = 'head' | 'torso' | 'hands' | 'legs' | 'feet' | 'pocket'

export interface ClothingItem {
  id: string
  label: string
  group: ClothingGroup
  /** Dato, tramo y hora que justifican la recomendación. */
  reason: string
}

export type AdviceSeverity = 'info' | 'warning' | 'danger'

export interface Advice {
  id: string
  title: string
  detail: string
  severity: AdviceSeverity
}

export interface ClothingRecommendation {
  /** Temperatura de referencia (media de la sensación en marcha + ajuste personal). */
  referenceTempC: number
  meanApparentC: number
  minApparentC: number
  maxApparentC: number
  items: ClothingItem[]
  warnings: Advice[]
}
