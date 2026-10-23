import * as L from 'leaflet'
import { useEffect, useRef } from 'react'
import { nearestIndex } from '../../domain/track/geometry'
import type { MapColorMode, PointWeather, RoutePlan } from '../../domain/types'
import { segmentColor } from './coloring'

export interface MapViewProps {
  plan: RoutePlan
  weather: PointWeather[]
  selectedIndex: number
  colorMode: MapColorMode
  onSelectIndex: (index: number) => void
}

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores'

/**
 * Mapa con el track, segmentos coloreados por la variable elegida y un
 * marcador en el punto seleccionado. Al tocar el mapa se selecciona el
 * punto muestreado más cercano (sincroniza el cursor de las gráficas).
 */
export default function MapView({
  plan,
  weather,
  selectedIndex,
  colorMode,
  onSelectIndex,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const trackLayerRef = useRef<L.LayerGroup | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const onSelectRef = useRef(onSelectIndex)
  onSelectRef.current = onSelectIndex
  const planRef = useRef(plan)
  planRef.current = plan

  // Creación única del mapa.
  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      // Evita conflictos con el scroll vertical de la página en móvil.
      dragging: true,
    })
    tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map)
    trackLayerRef.current = L.layerGroup().addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const pts = planRef.current.points
      if (pts.length === 0) return
      const idx = nearestIndex(pts, { lat: e.latlng.lat, lon: e.latlng.lng })
      onSelectRef.current(idx)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      trackLayerRef.current = null
      markerRef.current = null
    }
  }, [])

  // Geometría y segmentos coloreados.
  useEffect(() => {
    const map = mapRef.current
    const layer = trackLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    if (plan.geometry.length >= 2) {
      L.polyline(
        plan.geometry.map((p) => [p.lat, p.lon] as [number, number]),
        { color: '#e2e8f0', weight: 7, opacity: 0.85 },
      ).addTo(layer)
    }

    // Segmentos entre puntos muestreados, coloreados por la variable elegida.
    for (let i = 1; i < plan.points.length; i++) {
      const a = plan.points[i - 1]
      const b = plan.points[i]
      const w = weather[i - 1]
      if (!w) continue
      L.polyline(
        [
          [a.lat, a.lon],
          [b.lat, b.lon],
        ],
        { color: segmentColor(colorMode, w), weight: 4, opacity: 1 },
      ).addTo(layer)
    }

    if (plan.geometry.length === 0) return
    const bounds = L.latLngBounds(plan.geometry.map((p) => [p.lat, p.lon] as [number, number]))
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 })
  }, [plan, weather, colorMode])

  // Marcador del punto seleccionado.
  useEffect(() => {
    const map = mapRef.current
    const layer = trackLayerRef.current
    const p = plan.points[selectedIndex]
    if (!map || !layer || !p) return
    if (!markerRef.current) {
      markerRef.current = L.circleMarker([p.lat, p.lon], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#0f172a',
        fillOpacity: 1,
      }).addTo(map)
    } else {
      markerRef.current.setLatLng([p.lat, p.lon])
    }
  }, [plan.points, selectedIndex])

  return <div ref={containerRef} className="map-view" aria-label="Mapa de la ruta" />
}
