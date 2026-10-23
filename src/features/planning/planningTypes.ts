// Reexporta los contratos que la vista de planificación necesita.
// Evita un ciclo de imports App → features → App.
export type {
  GeoPoint,
  PlanMode,
  Settings,
  SpeedPreset,
  ThermalSensitivity,
  TrackRecord,
} from '../../domain/types'

export type TrackRecordLike = import('../../domain/types').TrackRecord
