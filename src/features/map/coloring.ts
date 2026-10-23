import type { MapColorMode, PointWeather } from '../../domain/types'

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ]
}

function lerpColor(a: string, b: string, f: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const t = Math.min(1, Math.max(0, f))
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

interface Stop {
  at: number
  color: string
}

function gradient(stops: Stop[], value: number): string {
  if (value <= stops[0].at) return stops[0].color
  for (let i = 1; i < stops.length; i++) {
    if (value <= stops[i].at) {
      const prev = stops[i - 1]
      const next = stops[i]
      const f = (value - prev.at) / (next.at - prev.at)
      return lerpColor(prev.color, next.color, f)
    }
  }
  return stops[stops.length - 1].color
}

const TEMP_STOPS: Stop[] = [
  { at: -10, color: '#a5b4fc' },
  { at: 0, color: '#38bdf8' },
  { at: 10, color: '#34d399' },
  { at: 18, color: '#fbbf24' },
  { at: 26, color: '#f97316' },
  { at: 35, color: '#ef4444' },
]

export function temperatureColor(tempC: number | null): string {
  if (tempC === null || !Number.isFinite(tempC)) return '#64748b'
  return gradient(TEMP_STOPS, tempC)
}

export function rainColor(mmH: number | null): string {
  if (mmH === null || !Number.isFinite(mmH)) return '#64748b'
  if (mmH <= 0) return '#94a3b8'
  const f = Math.min(1, mmH / 5)
  return lerpColor('#7dd3fc', '#1d4ed8', f)
}

export function headwindColor(headKmh: number | null): string {
  if (headKmh === null || !Number.isFinite(headKmh)) return '#64748b'
  if (headKmh >= 0) {
    // De frente: intensidad en tonos cálidos.
    return lerpColor('#fbbf24', '#dc2626', Math.min(1, headKmh / 40))
  }
  // De cola: tonos fríos.
  return lerpColor('#2dd4bf', '#0f766e', Math.min(1, Math.abs(headKmh) / 40))
}

export function segmentColor(mode: MapColorMode, weather: PointWeather): string {
  switch (mode) {
    case 'temperature':
      return temperatureColor(weather.feltApparentC ?? weather.temperature)
    case 'rain':
      return rainColor(weather.precipitation)
    case 'wind':
      return headwindColor(weather.relativeWind?.headKmh ?? null)
  }
}

export const MAP_COLOR_LABELS: Record<MapColorMode, string> = {
  temperature: 'Sensación térmica',
  rain: 'Lluvia',
  wind: 'Viento de frente/cola',
}
