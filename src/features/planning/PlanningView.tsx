import { useState } from 'react'
import { SPEED_PRESETS } from '../../domain/types'
import type {
  GeoPoint,
  PlanMode,
  Settings,
  SpeedPreset,
  ThermalSensitivity,
  TrackRecordLike,
} from './planningTypes'
import GpxPanel from './GpxPanel'
import MapPicker from './MapPicker'
import PlaceField from './PlaceField'

export interface PlanningGeo {
  position: GeoPoint | null
  asking: boolean
  error: string | null
  request: () => Promise<GeoPoint>
}

export interface PlanningViewProps {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onCalculate: () => void
  busy: boolean
  error: string | null
  track: TrackRecordLike | null
  onTrackChange: (track: TrackRecordLike | null) => void
  geo: PlanningGeo
}

const MODE_LABELS: Record<PlanMode, string> = {
  location: '📍 Ubicación actual',
  place: '🔍 Lugar elegido',
  gpx: '🧭 Track GPX',
}

const SENSITIVITY_LABELS: Record<ThermalSensitivity, string> = {
  friolero: 'Friolero',
  normal: 'Normal',
  caluroso: 'Caluroso',
}

const SPEED_LABELS: Record<Exclude<SpeedPreset, 'custom'>, string> = {
  relaxed: 'Relajada',
  medium: 'Media',
  fast: 'Rápida',
}

const SPEED_HINTS: Record<Exclude<SpeedPreset, 'custom'>, string> = {
  relaxed: '≈22 km/h',
  medium: '≈26 km/h',
  fast: '≈30 km/h',
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PlanningView({
  settings,
  update,
  onCalculate,
  busy,
  error,
  track,
  onTrackChange,
  geo,
}: PlanningViewProps) {
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [gpxError, setGpxError] = useState<string | null>(null)

  const isGpx = settings.planMode === 'gpx'

  return (
    <div className="planning-view">
      <header className="view-header">
        <h1>¿Qué ropa me pongo?</h1>
        <p className="hint">
          Planifica la salida y VeloLayer cruza la previsión a lo largo de la ruta para
          recomendarte la ropa. Tus selecciones se guardan en este dispositivo.
        </p>
      </header>

      <section className="card">
        <h2>1. ¿Cómo planificamos la salida?</h2>
        <div className="segmented mode-tabs" role="group" aria-label="Modo de planificación">
          {(Object.keys(MODE_LABELS) as PlanMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={settings.planMode === mode ? 'active' : ''}
              onClick={() => update({ planMode: mode })}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        {settings.planMode === 'location' ? (
          <div className="mode-panel">
            <button
              type="button"
              className="primary"
              disabled={geo.asking}
              onClick={() => void geo.request().catch(() => undefined)}
            >
              {geo.asking ? 'Localizando…' : geo.position ? 'Usar mi ubicación (actualizar)' : 'Usar mi ubicación'}
            </button>
            {geo.position ? (
              <div className="hint">
                📍 {geo.position.lat.toFixed(4)}, {geo.position.lon.toFixed(4)}. El permiso no se
                guarda: se pedirá de nuevo cuando calcules.
              </div>
            ) : null}
            {geo.error ? <div className="hint error-text">{geo.error}</div> : null}
            <p className="hint">
              Con esta opción, sin destino, se muestra la previsión por hora en tu ubicación.
            </p>
          </div>
        ) : null}

        {settings.planMode === 'place' ? (
          <div className="mode-panel">
            <PlaceField
              id="place"
              label="Lugar de salida"
              value={settings.place}
              onSelect={(p) => update({ place: p })}
              onClear={() => update({ place: null })}
            />
            <button
              type="button"
              className="ghost"
              onClick={() => setShowMapPicker((v) => !v)}
            >
              {showMapPicker ? 'Ocultar el mapa' : 'Elegir el punto en el mapa'}
            </button>
            {showMapPicker ? (
              <MapPicker
                center={settings.place}
                selected={settings.place}
                onPick={(point, label) => update({ place: { ...point, name: label } })}
              />
            ) : null}
          </div>
        ) : null}

        {settings.planMode === 'gpx' ? (
          <div className="mode-panel">
            <GpxPanel
              selected={track}
              onSelect={onTrackChange}
              onError={(message) => setGpxError(message)}
            />
            {gpxError ? <div className="hint error-text">{gpxError}</div> : null}
          </div>
        ) : null}
      </section>

      {!isGpx ? (
        <section className="card">
          <h2>2. Salida y llegada</h2>
          <div className="field-row">
            <div className="field">
              <label htmlFor="date">Fecha de salida</label>
              <input
                id="date"
                type="date"
                min={todayString()}
                value={settings.date}
                onChange={(e) => update({ date: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="start-time">Hora de salida</label>
              <input
                id="start-time"
                type="time"
                value={settings.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="duration">Duración estimada (min)</label>
              <input
                id="duration"
                type="number"
                min={15}
                max={1440}
                step={15}
                placeholder="Ej.: 180"
                value={settings.durationMin ?? ''}
                disabled={settings.arrivalTime !== null}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  update({ durationMin: v, arrivalTime: null })
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="arrival-time">Hora de vuelta (opcional)</label>
              <input
                id="arrival-time"
                type="time"
                value={settings.arrivalTime ?? ''}
                disabled={settings.durationMin !== null}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : e.target.value
                  update({ arrivalTime: v, durationMin: null })
              }}
              />
            </div>
          </div>
          <p className="hint">
            Duración y hora de vuelta son equivalentes: si cambias una, la otra se recalcula al
            calcular. Sin ninguna de las dos, el modelo estima la llegada con tu velocidad.
          </p>

          <PlaceField
            id="destination"
            label="Destino (opcional)"
            value={settings.destination}
            onSelect={(p) => update({ destination: p })}
            onClear={() => update({ destination: null })}
          />
          {settings.destination ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.circular}
                onChange={(e) => update({ circular: e.target.checked })}
              />
              Es una ruta circular (vuelta al punto de salida)
            </label>
          ) : null}
          {settings.destination ? (
            <p className="hint warning-text">
              Sin enrutador ciclista, salida y destino se unen en línea recta: es una
              aproximación, no una ruta real.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="card">
          <h2>2. Horas</h2>
          <div className="field-row">
            <div className="field">
              <label htmlFor="date-gpx">Fecha de salida</label>
              <input
                id="date-gpx"
                type="date"
                min={todayString()}
                value={settings.date}
                onChange={(e) => update({ date: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="start-time-gpx">Hora de salida</label>
              <input
                id="start-time-gpx"
                type="time"
                value={settings.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="duration-gpx">Duración estimada (min, opcional)</label>
              <input
                id="duration-gpx"
                type="number"
                min={15}
                max={1440}
                step={15}
                placeholder="Según velocidad"
                value={settings.durationMin ?? ''}
                disabled={settings.arrivalTime !== null}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  update({ durationMin: v, arrivalTime: null })
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="arrival-time-gpx">Hora de vuelta (opcional)</label>
              <input
                id="arrival-time-gpx"
                type="time"
                value={settings.arrivalTime ?? ''}
                disabled={settings.durationMin !== null}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : e.target.value
                  update({ arrivalTime: v, durationMin: null })
                }}
              />
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h2>{isGpx ? '3' : '3'}. Tu perfil</h2>
        <div className="field">
          <span className="label-text">Velocidad media en llano</span>
          <div className="segmented" role="group" aria-label="Velocidad media">
            {(['relaxed', 'medium', 'fast'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={settings.speedPreset === p ? 'active' : ''}
                onClick={() =>
                  update({ speedPreset: p, avgSpeedKmh: SPEED_PRESETS[p] })
                }
              >
                {SPEED_LABELS[p]} {SPEED_HINTS[p]}
              </button>
            ))}
            <button
              type="button"
              className={settings.speedPreset === 'custom' ? 'active' : ''}
              onClick={() => update({ speedPreset: 'custom' })}
            >
              Personalizada
            </button>
          </div>
          {settings.speedPreset === 'custom' ? (
            <div className="field inline">
              <label htmlFor="speed">km/h</label>
              <input
                id="speed"
                type="number"
                min={5}
                max={50}
                step={0.5}
                value={settings.avgSpeedKmh}
                onChange={(e) =>
                  update({ avgSpeedKmh: Number(e.target.value) || SPEED_PRESETS.medium })
                }
              />
            </div>
          ) : null}
          <p className="hint">Son valores orientativos y configurables, no predicciones exactas.</p>
        </div>

        <div className="field">
          <span className="label-text">Sensibilidad térmica personal</span>
          <div className="segmented" role="group" aria-label="Sensibilidad térmica">
            {(['friolero', 'normal', 'caluroso'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={settings.sensitivity === s ? 'active' : ''}
                onClick={() => update({ sensitivity: s })}
              >
                {SENSITIVITY_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="hint">
            Friolero suma 3 °C a los umbrales de frío; caluroso resta 3 °C. Es configurable en
            `src/rules/clothing.json`.
          </p>
        </div>

        <button
          type="button"
          className="ghost"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? 'Ocultar parámetros avanzados' : 'Parámetros avanzados'}
        </button>
        {showAdvanced ? (
          <div className="field-row">
            <div className="field">
              <label htmlFor="vam">Velocidad ascensional (m desnivel+/h)</label>
              <input
                id="vam"
                type="number"
                min={150}
                max={2000}
                step={50}
                value={settings.climbVamMph}
                onChange={(e) => update({ climbVamMph: Number(e.target.value) || 700 })}
              />
            </div>
            <div className="field">
              <label htmlFor="descent">Velocidad de descenso (km/h)</label>
              <input
                id="descent"
                type="number"
                min={15}
                max={80}
                step={1}
                value={settings.descentSpeedKmh}
                onChange={(e) => update({ descentSpeedKmh: Number(e.target.value) || 35 })}
              />
            </div>
          </div>
        ) : null}
      </section>

      {error ? <div className="banner error">{error}</div> : null}

      <button
        type="button"
        className="primary big"
        disabled={busy}
        onClick={onCalculate}
      >
        {busy ? 'Calculando previsión…' : 'Calcular previsión y ropa'}
      </button>
      <p className="hint center">
        Se consultarán las coordenadas estimadas de paso a Open-Meteo. Nada se envía a servidores
        propios.
      </p>
    </div>
  )
}
