import { useState } from 'react'
import { usePlaceSearch } from '../../hooks/usePlaceSearch'
import type { NamedPoint } from '../../domain/types'

export interface PlaceFieldProps {
  label: string
  value: NamedPoint | null
  onSelect: (point: NamedPoint) => void
  onClear: () => void
  id: string
}

/** Búsqueda de lugares por nombre (geocodificación de Open-Meteo). */
export default function PlaceField({ label, value, onSelect, onClear, id }: PlaceFieldProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { results, loading, error } = usePlaceSearch(query)

  return (
    <div className="field">
      <label htmlFor={`${id}-input`}>{label}</label>
      {value ? (
        <div className="selected-chip">
          <span>
            📍 {value.name}{' '}
            <small>
              {value.lat.toFixed(3)}, {value.lon.toFixed(3)}
            </small>
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              onClear()
              setQuery('')
              setOpen(false)
            }}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            id={`${id}-input`}
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Por ejemplo: Segovia, Girona…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
          {open && query.trim().length >= 2 ? (
            <div className="search-results" role="listbox" aria-label="Resultados de búsqueda">
              {loading ? <div className="hint">Buscando…</div> : null}
              {error ? <div className="hint error-text">{error}</div> : null}
              {!loading &&
                results.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    role="option"
                    className="search-result"
                    onClick={() => {
                      onSelect({ name: r.label, lat: r.lat, lon: r.lon })
                      setQuery('')
                      setOpen(false)
                    }}
                  >
                    <strong>{r.name}</strong>
                    <small>
                      {[r.admin1, r.country].filter(Boolean).join(', ')} ·{' '}
                      {r.elevation !== null ? `${Math.round(r.elevation)} m` : 'sin altitud'}
                    </small>
                  </button>
                ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
