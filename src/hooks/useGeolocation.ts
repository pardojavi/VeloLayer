import { useCallback, useState } from 'react'
import { AppError } from '../domain/errors'
import type { GeoPoint } from '../domain/types'

export interface UseGeolocation {
  position: GeoPoint | null
  asking: boolean
  error: string | null
  request: () => Promise<GeoPoint>
}

/**
 * Solicita la geolocalización solo cuando el usuario la pide. El permiso no
 * se persiste: lo controlan el navegador y el sistema operativo.
 */
export function useGeolocation(): UseGeolocation {
  const [position, setPosition] = useState<GeoPoint | null>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(
    () =>
      new Promise<GeoPoint>((resolve, reject) => {
        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
          const e = new AppError(
            'geolocation-unavailable',
            'Este dispositivo no permite obtener la ubicación. Elige un lugar en el mapa.',
          )
          setError(e.message)
          reject(e)
          return
        }
        setAsking(true)
        setError(null)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const p: GeoPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude }
            setPosition(p)
            setAsking(false)
            resolve(p)
          },
          (err) => {
            const e =
              err.code === err.PERMISSION_DENIED
                ? new AppError(
                    'geolocation-denied',
                    'Has denegado el permiso de ubicación. Actívalo en los ajustes del navegador o elige un lugar en el mapa.',
                  )
                : new AppError(
                    'geolocation-unavailable',
                    'No se ha podido obtener tu ubicación. Inténtalo de nuevo o elige un lugar.',
                  )
            setError(e.message)
            setAsking(false)
            reject(e)
          },
          { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
        )
      }),
    [],
  )

  return { position, asking, error, request }
}
