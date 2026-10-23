import { AppError } from '../errors'
import type { RawTrackPoint } from '../types'

export interface ParsedGpx {
  name: string | null
  points: RawTrackPoint[]
}

function parseCoord(el: Element, attr: 'lat' | 'lon'): number | null {
  const raw = el.getAttribute(attr)
  if (raw === null) return null
  const v = Number(raw)
  if (!Number.isFinite(v)) return null
  if (attr === 'lat' && (v < -90 || v > 90)) return null
  if (attr === 'lon' && (v < -180 || v > 180)) return null
  return v
}

function childText(el: Element, tag: string): string | null {
  const child = Array.from(el.children).find((c) => c.tagName.toLowerCase() === tag)
  if (!child) return null
  const text = child.textContent?.trim()
  return text ? text : null
}

function parsePoint(el: Element): RawTrackPoint | null {
  const lat = parseCoord(el, 'lat')
  const lon = parseCoord(el, 'lon')
  if (lat === null || lon === null) return null

  const eleText = childText(el, 'ele')
  const eleNum = eleText === null ? NaN : Number(eleText)
  const ele = Number.isFinite(eleNum) ? eleNum : null

  const timeText = childText(el, 'time')
  let time: number | null = null
  if (timeText) {
    const parsed = Date.parse(timeText)
    if (Number.isFinite(parsed)) time = parsed
  }

  return { lat, lon, ele, time }
}

/**
 * Lee un archivo GPX con DOMParser y valida coordenadas, ele y marcas de tiempo.
 * Lanza AppError('gpx-invalid') si el archivo no es un GPX utilizable.
 */
export function parseGpx(xmlText: string): ParsedGpx {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  } catch {
    throw new AppError('gpx-invalid', 'No se ha podido leer el archivo. ¿Es un XML válido?')
  }

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new AppError('gpx-invalid', 'El archivo no es XML válido.')
  }

  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'gpx') {
    throw new AppError('gpx-invalid', 'El archivo no tiene formato GPX (falta la etiqueta <gpx>).')
  }

  // Se aceptan <trkpt>, y como alternativa <rtept>, dentro de track o ruta.
  let pointEls = Array.from(doc.getElementsByTagName('trkpt'))
  if (pointEls.length === 0) pointEls = Array.from(doc.getElementsByTagName('rtept'))
  if (pointEls.length < 2) {
    throw new AppError(
      'gpx-invalid',
      'El GPX no contiene al menos dos puntos de track (<trkpt>).',
    )
  }

  const points: RawTrackPoint[] = []
  let invalid = 0
  for (const el of pointEls) {
    const p = parsePoint(el)
    if (p) points.push(p)
    else invalid += 1
  }

  if (points.length < 2) {
    throw new AppError(
      'gpx-invalid',
      `El GPX tiene demasiados puntos inválidos (solo ${points.length} de ${pointEls.length} tienen coordenadas válidas).`,
    )
  }
  // Se toleran puntos sueltos corruptos, pero no archivos donde más de la
  // mitad de los puntos son inválidos.
  if (invalid > 0 && points.length < pointEls.length * 0.5) {
    throw new AppError(
      'gpx-invalid',
      `El GPX tiene demasiados puntos inválidos (${invalid} de ${pointEls.length}).`,
    )
  }

  const trkName =
    Array.from(doc.getElementsByTagName('trk'))
      .map((trk) => childText(trk, 'name'))
      .find((n): n is string => n !== null) ?? null
  const metaName = Array.from(doc.getElementsByTagName('metadata'))
    .map((m) => childText(m, 'name'))
    .find((n): n is string => n !== null) ?? null

  return { name: trkName ?? metaName, points }
}
