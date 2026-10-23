import { useCallback, useEffect, useState } from 'react'
import { AppError } from '../../domain/errors'
import { computeTrackStats } from '../../domain/track/geometry'
import { parseGpx } from '../../domain/track/gpx'
import { fmtDuration, fmtKm } from '../../domain/format'
import type { TrackRecord } from '../../domain/types'
import { listTracks, putTrack, removeTrack } from '../../storage/tracksRepository'

export interface GpxPanelProps {
  selected: TrackRecord | null
  onSelect: (track: TrackRecord | null) => void
  onError: (message: string) => void
  /** Para notificar al resto de la app cuando cambia la lista. */
  onChanged?: () => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Importación y gestión de tracks GPX guardados en el dispositivo. */
export default function GpxPanel({ selected, onSelect, onError, onChanged }: GpxPanelProps) {
  const [tracks, setTracks] = useState<TrackRecord[]>([])
  const [importing, setImporting] = useState(false)

  const refresh = useCallback(() => {
    listTracks()
      .then(setTracks)
      .catch(() => onError('No se han podido leer los tracks guardados.'))
  }, [onError])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleFile = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const parsed = parseGpx(text)
      const stats = computeTrackStats(parsed.points)
      const record: TrackRecord = {
        id: newId(),
        name: parsed.name ?? file.name.replace(/\.gpx$/i, ''),
        fileName: file.name,
        importedAt: Date.now(),
        points: parsed.points,
        stats,
      }
      await putTrack(record)
      onSelect(record)
      refresh()
      onChanged?.()
    } catch (e) {
      onError(
        e instanceof AppError
          ? e.message
          : 'No se ha podido importar el archivo GPX. Comprueba que sea un archivo válido.',
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="field">
      <label htmlFor="gpx-file">Track GPX</label>
      <input
        id="gpx-file"
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
      {importing ? <div className="hint">Importando track…</div> : null}

      {tracks.length > 0 ? (
        <div className="track-list">
          <div className="hint">Tracks guardados en este dispositivo:</div>
          {tracks.map((t) => (
            <div
              key={t.id}
              className={`track-row${selected?.id === t.id ? ' selected' : ''}`}
            >
              <button
                type="button"
                className="track-select"
                onClick={() => onSelect(t)}
                aria-pressed={selected?.id === t.id}
              >
                <strong>{t.name}</strong>
                <small>
                  {fmtKm(t.stats.distanceKm)}
                  {t.stats.hasEle ? ` · +${Math.round(t.stats.ascentM)} m` : ' · sin altitud'} ·{' '}
                  {t.stats.hasTime ? 'con horas GPX' : 'tiempos estimados'}
                </small>
              </button>
              <button
                type="button"
                className="ghost danger"
                onClick={() => {
                  void removeTrack(t.id).then(() => {
                    if (selected?.id === t.id) onSelect(null)
                    refresh()
                    onChanged?.()
                  })
                }}
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="hint">
          Aún no hay tracks guardados. Al importarlos se quedan en el dispositivo y sobreviven a
          reinicios.
        </div>
      )}

      {selected ? (
        <div className="hint">
          Seleccionado: <strong>{selected.name}</strong> ({fmtKm(selected.stats.distanceKm)},{' '}
          {fmtDuration(Math.round(selected.stats.distanceKm / 26 * 60))} a 26 km/h orientativos).
        </div>
      ) : null}
    </div>
  )
}
