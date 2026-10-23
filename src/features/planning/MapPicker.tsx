import * as L from 'leaflet'
import { useEffect, useRef } from 'react'
import type { GeoPoint } from '../../domain/types'

export interface MapPickerProps {
  /** Centro inicial del mapa (lugar actual o última posición conocida). */
  center: GeoPoint | null
  selected: GeoPoint | null
  onPick: (point: GeoPoint, label: string) => void
}

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores'

/**
 * Mini mapa para elegir un punto tocando. Conviene reutilizarlo como
 * "seleccionar en el mapa" para salida y destino.
 */
export default function MapPicker({ center, selected, onPick }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const start = center ?? selected ?? { lat: 40.4168, lon: -3.7038 }
    const map = L.map(el, {
      center: [start.lat, start.lon],
      zoom: center || selected ? 12 : 5,
      scrollWheelZoom: false,
      attributionControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Math.round(e.latlng.lat * 1e5) / 1e5
      const lon = Math.round(e.latlng.lng * 1e5) / 1e5
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lon]).addTo(map)
      } else {
        markerRef.current.setLatLng([lat, lon])
      }
      onPickRef.current({ lat, lon }, `Punto elegido (${lat.toFixed(4)}, ${lon.toFixed(4)})`)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Solo se crea una vez; el centro cambia por efectos externos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mueve el marcador cuando cambia la selección externa.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected) return
    if (!markerRef.current) {
      markerRef.current = L.marker([selected.lat, selected.lon]).addTo(map)
    } else {
      markerRef.current.setLatLng([selected.lat, selected.lon])
    }
    map.setView([selected.lat, selected.lon], map.getZoom())
  }, [selected])

  return <div ref={containerRef} className="map-picker" aria-label="Mapa para elegir un punto" />
}
