import { describe, expect, it } from 'vitest'
import { AppError } from '../errors'
import { parseGpx } from './gpx'

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <metadata><name>Ruta de prueba</name></metadata>
  <trk>
    <name>Subida al puerto</name>
    <trkseg>
      <trkpt lat="40.4168" lon="-3.7038"><ele>650</ele><time>2026-10-24T08:00:00Z</time></trkpt>
      <trkpt lat="40.4268" lon="-3.7138"><ele>720</ele><time>2026-10-24T08:10:00Z</time></trkpt>
      <trkpt lat="40.4368" lon="-3.7238"><ele>690</ele></trkpt>
      <trkpt lat="nope" lon="-3.7238"/>
    </trkseg>
  </trk>
</gpx>`

describe('parseGpx', () => {
  it('lee puntos, ele y marcas de tiempo', () => {
    const parsed = parseGpx(VALID_GPX)
    expect(parsed.name).toBe('Subida al puerto')
    expect(parsed.points).toHaveLength(3)
    expect(parsed.points[0]).toEqual({
      lat: 40.4168,
      lon: -3.7038,
      ele: 650,
      time: Date.parse('2026-10-24T08:00:00Z'),
    })
    expect(parsed.points[1].ele).toBe(720)
    // El tercer punto no tiene hora y el cuarto (inválido) se descarta.
    expect(parsed.points[2].time).toBeNull()
  })

  it('acepta rtept cuando no hay trkpt', () => {
    const gpx = `<?xml version="1.0"?><gpx><rte><rtept lat="40" lon="-3"/><rtept lat="40.1" lon="-3.1"/></rte></gpx>`
    const parsed = parseGpx(gpx)
    expect(parsed.points).toHaveLength(2)
  })

  it('rechaza XML inválido', () => {
    expect(() => parseGpx('<gpx><trkpt')).toThrowError(AppError)
  })

  it('rechaza archivos que no son GPX', () => {
    expect(() => parseGpx('<?xml version="1.0"?><kml></kml>')).toThrowError(/GPX/)
  })

  it('rechaza un GPX sin puntos suficientes', () => {
    expect(() => parseGpx('<?xml version="1.0"?><gpx></gpx>')).toThrowError(/dos puntos/)
  })

  it('rechaza coordenadas fuera de rango', () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="999" lon="0"/><trkpt lat="888" lon="0"/><trkpt lat="1" lon="1"/>
    </trkseg></trk></gpx>`
    // Dos de tres inválidos → se considera corrupto.
    expect(() => parseGpx(gpx)).toThrowError(/inválidos/)
  })
})
