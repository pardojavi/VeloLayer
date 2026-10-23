import MapView from '../map/MapView'
import { MAP_COLOR_LABELS, temperatureColor } from '../map/coloring'
import { fmtDuration, fmtKm, fmtTemp } from '../../domain/format'
import { weatherCodeInfo } from '../../domain/forecast/weatherCodes'
import type { AnalysisResult } from '../../hooks/useAnalysis'
import type { MapColorMode } from '../../domain/types'

export interface SummaryViewProps {
  result: AnalysisResult
  selectedIndex: number
  onSelectIndex: (index: number) => void
  colorMode: MapColorMode
  onColorModeChange: (mode: MapColorMode) => void
}

function methodLabel(method: string | null): string {
  if (method === 'wind-chill') return 'fórmula de viento (rango válido)'
  if (method === 'api-apparent') return 'aparente de la API'
  return 'temperatura del aire'
}

export default function SummaryView({
  result,
  selectedIndex,
  onSelectIndex,
  colorMode,
  onColorModeChange,
}: SummaryViewProps) {
  const { plan, weather } = result
  const point = plan.points[selectedIndex]
  const w = weather[selectedIndex]
  const code = w ? weatherCodeInfo(w.weatherCode) : weatherCodeInfo(null)

  return (
    <div className="summary-view">
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-label">Distancia</span>
          <span className="stat-value">
            {plan.stats.distanceKm > 0 ? fmtKm(plan.stats.distanceKm) : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Duración</span>
          <span className="stat-value">{fmtDuration(plan.stats.durationMin)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Salida → llegada</span>
          <span className="stat-value">
            {new Date(plan.departureMs).toLocaleTimeString('es', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            →{' '}
            {new Date(plan.arrivalMs).toLocaleTimeString('es', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Velocidad media</span>
          <span className="stat-value">
            {plan.stats.avgSpeedKmh > 0 ? `${plan.stats.avgSpeedKmh} km/h` : '—'}
          </span>
        </div>
        {plan.stats.ascentM !== null ? (
          <div className="stat">
            <span className="stat-label">Desnivel +/−</span>
            <span className="stat-value">
              +{plan.stats.ascentM} / −{plan.stats.descentM ?? 0} m
            </span>
          </div>
        ) : null}
      </div>

      {plan.notes.length > 0 ? (
        <ul className="notes">
          {plan.notes.map((n) => (
            <li key={n.code} className={`note ${n.severity}`}>
              {n.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="map-section">
        <div className="chip-row" role="group" aria-label="Colorear el track por">
          {(Object.keys(MAP_COLOR_LABELS) as MapColorMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`chip${colorMode === mode ? ' active' : ''}`}
              onClick={() => onColorModeChange(mode)}
            >
              {MAP_COLOR_LABELS[mode]}
            </button>
          ))}
        </div>
        <MapView
          plan={plan}
          weather={weather}
          selectedIndex={selectedIndex}
          colorMode={colorMode}
          onSelectIndex={onSelectIndex}
        />
      </div>

      {point && w ? (
        <div className="card point-card">
          <div className="point-header">
            <span className="point-icon" aria-hidden="true">
              {code.icon}
            </span>
            <div>
              <strong>
                {plan.source === 'static'
                  ? new Date(point.arrivalMs).toLocaleTimeString('es', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : `Km ${Math.round(point.cumKm * 10) / 10} · ${new Date(point.arrivalMs).toLocaleTimeString('es', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
              </strong>
              <div className="hint">{code.label}{w.isNight ? ' · noche' : ''}{w.outOfRange ? ' · fuera del horizonte de previsión' : ''}</div>
            </div>
          </div>
          <ul className="point-vars">
            <li>
              <span>Temperatura</span>
              <strong style={{ color: temperatureColor(w.temperature) }}>
                {fmtTemp(w.temperature)}
              </strong>
            </li>
            <li>
              <span>Sensación en bici</span>
              <strong>{fmtTemp(w.feltApparentC)}</strong>
            </li>
            <li>
              <span>Método</span>
              <strong className="small">{methodLabel(w.feltMethod)}</strong>
            </li>
            {point.ele !== null ? (
              <li>
                <span>Altitud</span>
                <strong>{Math.round(point.ele)} m</strong>
              </li>
            ) : null}
            <li>
              <span>Viento</span>
              <strong>
                {w.windSpeed !== null ? `${Math.round(w.windSpeed)} km/h` : '—'}
                {w.relativeWind
                  ? ` · ${w.relativeWind.headKmh >= 0 ? 'frente' : 'cola'} ${Math.abs(w.relativeWind.headKmh)} km/h`
                  : ''}
              </strong>
            </li>
            <li>
              <span>Rachas</span>
              <strong>{w.windGust !== null ? `${Math.round(w.windGust)} km/h` : '—'}</strong>
            </li>
            <li>
              <span>Lluvia</span>
              <strong>
                {w.precipitationProbability !== null ? `${Math.round(w.precipitationProbability)} %` : '—'} ·{' '}
                {w.precipitation !== null ? `${w.precipitation} mm/h` : '—'}
              </strong>
            </li>
            <li>
              <span>UV máx. del día</span>
              <strong>{w.uvIndex !== null ? Math.round(w.uvIndex) : '—'}</strong>
            </li>
          </ul>
          <p className="hint">
            Toca cualquier punto del mapa o las gráficas para ver sus valores.
          </p>
        </div>
      ) : null}
    </div>
  )
}
