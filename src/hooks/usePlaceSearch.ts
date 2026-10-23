import { useEffect, useState } from 'react'
import { searchPlaces } from '../services/geocoding'
import type { GeocodingResult } from '../services/geocoding'

export interface UsePlaceSearch {
  results: GeocodingResult[]
  loading: boolean
  error: string | null
}

/** Búsqueda de lugares con retardo y cancelación de peticiones obsoletas. */
export function usePlaceSearch(query: string, delayMs = 350): UsePlaceSearch {
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    const timer = setTimeout(() => {
      searchPlaces(q)
        .then((r) => {
          if (!alive) return
          setResults(r)
          setError(r.length === 0 ? 'Sin resultados. Prueba con otro nombre.' : null)
          setLoading(false)
        })
        .catch((e) => {
          if (!alive) return
          setResults([])
          setError(e instanceof Error ? e.message : 'No se ha podido buscar.')
          setLoading(false)
        })
    }, delayMs)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, delayMs])

  return { results, loading, error }
}
