import { useCallback, useEffect, useState } from 'react'
import { fmtDuration, fmtKm } from '../../domain/format'
import type { Settings, TrackRecord } from '../../domain/types'
import { clearForecastCache } from '../../storage/forecastCacheRepository'
import { listTracks, removeTrack } from '../../storage/tracksRepository'

export interface SettingsViewProps {
  settings: Settings
  onReset: () => Promise<void>
  storageWarning: string | null
}

const UNITS_LINE = 'Unidades: km, km/h, °C y metros de desnivel.'

export default function SettingsView({ settings, onReset, storageWarning }: SettingsViewProps) {
  const [tracks, setTracks] = useState<TrackRecord[]>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refreshTracks = useCallback(() => {
    listTracks()
      .then(setTracks)
      .catch(() => setMessage('No se han podido leer los tracks guardados.'))
  }, [])

  useEffect(() => {
    refreshTracks()
  }, [refreshTracks])

  return (
    <div className="settings-view">
      <header className="view-header">
        <h1>Ajustes</h1>
        <p className="hint">{UNITS_LINE}</p>
      </header>

      {storageWarning ? <div className="banner warning">{storageWarning}</div> : null}
      {message ? <div className="banner info">{message}</div> : null}

      <section className="card">
        <h2>Tracks guardados</h2>
        {tracks.length === 0 ? (
          <p className="hint">
            No hay tracks GPX guardados. Los tracks se guardan en este dispositivo y sobreviven a
            reinicios.
          </p>
        ) : (
          <ul className="item-list">
            {tracks.map((t) => (
              <li key={t.id} className="track-settings-row">
                <div>
                  <strong>{t.name}</strong>
                  <p className="reason">
                    {fmtKm(t.stats.distanceKm)}
                    {t.stats.hasEle ? ` · +${Math.round(t.stats.ascentM)} m` : ' · sin altitud'} ·{' '}
                    {fmtDuration(Math.round((t.stats.distanceKm / 26) * 60))} orientativos
                    {settings.lastTrackId === t.id ? ' · en uso' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => {
                    void removeTrack(t.id).then(() => {
                      setMessage(
                        settings.lastTrackId === t.id
                          ? 'Track eliminado. Selecciona otro track antes de calcular.'
                          : `Track “${t.name}” eliminado.`,
                      )
                      refreshTracks()
                    })
                  }}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Datos locales</h2>
        <p className="hint">
          Tus preferencias, tracks y la caché meteorológica viven solo en este dispositivo
          (IndexedDB). No hay cuenta ni sincronización: si borras los datos del sitio o
          desinstalas la app, se perderán.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void clearForecastCache()
                .then(() => setMessage('Caché meteorológica borrada.'))
                .catch(() => setMessage('No se ha podido borrar la caché meteorológica.'))
            }}
          >
            Borrar caché meteorológica
          </button>
        </div>
        <div className="button-row">
          {!confirmReset ? (
            <button type="button" className="ghost danger" onClick={() => setConfirmReset(true)}>
              Restablecer preferencias
            </button>
          ) : (
            <>
              <span className="hint">
                ¿Borrar preferencias? Los tracks guardados NO se borran.
              </span>
              <button
                type="button"
                className="danger-btn"
                onClick={() => {
                  void onReset().then(() => {
                    setConfirmReset(false)
                    setMessage('Preferencias restablecidas.')
                  })
                }}
              >
                Sí, restablecer
              </button>
              <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Fuentes y atribución</h2>
        <ul className="attribution-list">
          <li>
            Datos meteorológicos:{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{' '}
            (CC BY 4.0; uso no comercial salvo licencia).
          </li>
          <li>
            Geocodificación:{' '}
            <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">
              Open-Meteo Geocoding
            </a>{' '}
            con datos de{' '}
            <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
              GeoNames
            </a>
            .
          </li>
          <li>
            Altitud: Copernicus DEM 2021 GLO-90 (90 m) vía Open-Meteo, © Copernicus / ESA.
          </li>
          <li>
            Mapa:{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © colaboradores de OpenStreetMap
            </a>{' '}
            (ODbL). Solo se cachean teselas visitadas, con límite de 300 y 7 días.
          </li>
        </ul>
        <p className="hint">
          La app necesita conexión para obtener previsiones nuevas: no funciona completa sin
          conexión. El mapa puede faltar si sus teselas no están en caché. La línea recta entre
          salida y destino no es una ruta ciclista real.
        </p>
      </section>

      <footer className="attribution">VeloLayer 0.1.0 · PWA instalable · sin cuentas</footer>
    </div>
  )
}
