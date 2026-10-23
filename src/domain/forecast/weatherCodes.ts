export interface WeatherCodeInfo {
  label: string
  icon: string
}

const CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Cielo despejado', icon: '☀️' },
  1: { label: 'Despejado mayormente', icon: '🌤️' },
  2: { label: 'Parcialmente nublado', icon: '⛅' },
  3: { label: 'Nublado', icon: '☁️' },
  45: { label: 'Niebla', icon: '🌫️' },
  48: { label: 'Niebla con escarcha', icon: '🌫️' },
  51: { label: 'Llovizna ligera', icon: '🌦️' },
  53: { label: 'Llovizna moderada', icon: '🌦️' },
  55: { label: 'Llovizna densa', icon: '🌧️' },
  56: { label: 'Llovizna helada', icon: '🌧️' },
  57: { label: 'Llovizna helada densa', icon: '🌧️' },
  61: { label: 'Lluvia ligera', icon: '🌦️' },
  63: { label: 'Lluvia moderada', icon: '🌧️' },
  65: { label: 'Lluvia intensa', icon: '🌧️' },
  66: { label: 'Lluvia helada', icon: '🌧️' },
  67: { label: 'Lluvia helada intensa', icon: '🌧️' },
  71: { label: 'Nieve ligera', icon: '🌨️' },
  73: { label: 'Nieve moderada', icon: '🌨️' },
  75: { label: 'Nieve intensa', icon: '🌨️' },
  77: { label: 'Granos de nieve', icon: '🌨️' },
  80: { label: 'Chubascos ligeros', icon: '🌦️' },
  81: { label: 'Chubascos moderados', icon: '🌧️' },
  82: { label: 'Chubascos violentos', icon: '⛈️' },
  85: { label: 'Chubascos de nieve', icon: '🌨️' },
  86: { label: 'Chubascos de nieve intensos', icon: '🌨️' },
  95: { label: 'Tormenta', icon: '⛈️' },
  96: { label: 'Tormenta con granizo', icon: '⛈️' },
  97: { label: 'Tormenta fuerte', icon: '⛈️' },
  99: { label: 'Tormenta fuerte con granizo', icon: '⛈️' },
}

export function weatherCodeInfo(code: number | null | undefined): WeatherCodeInfo {
  if (code === null || code === undefined) return { label: 'Sin datos', icon: '·' }
  return CODES[code] ?? { label: `Código ${code}`, icon: '·' }
}

export function isRainCode(code: number | null | undefined): boolean {
  if (code === null || code === undefined) return false
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
}
