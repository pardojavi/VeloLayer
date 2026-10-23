import { describe, expect, it } from 'vitest'
import { createDefaultSettings, sanitizeSettings } from './settings'

const NOW = new Date('2026-10-23T10:00:00')

describe('createDefaultSettings', () => {
  it('por defecto la salida es mañana', () => {
    const s = createDefaultSettings(NOW)
    expect(s.date).toBe('2026-10-24')
    expect(s.startTime).toBe('09:00')
    expect(s.avgSpeedKmh).toBe(26)
    expect(s.sensitivity).toBe('normal')
    expect(s.durationMin).toBeNull()
  })
})

describe('sanitizeSettings', () => {
  it('con datos ausentes devuelve los valores por defecto', () => {
    expect(sanitizeSettings(null, NOW)).toEqual(createDefaultSettings(NOW))
    expect(sanitizeSettings({ junk: true }, NOW)).toEqual(createDefaultSettings(NOW))
  })

  it('conserva selecciones válidas', () => {
    const raw = {
      planMode: 'gpx',
      date: '2026-10-25',
      startTime: '07:30',
      place: { name: 'Segovia', lat: 40.9429, lon: -4.1088 },
      circular: true,
      durationMin: 240,
      arrivalTime: null,
      speedPreset: 'fast',
      avgSpeedKmh: 30,
      climbVamMph: 800,
      descentSpeedKmh: 40,
      sensitivity: 'friolero',
      lastTrackId: 'abc',
      lastAppView: 'settings',
      lastResultTab: 'charts',
      axisMode: 'km',
    }
    const s = sanitizeSettings(raw, NOW)
    expect(s.planMode).toBe('gpx')
    expect(s.place?.name).toBe('Segovia')
    expect(s.circular).toBe(true)
    expect(s.durationMin).toBe(240)
    expect(s.speedPreset).toBe('fast')
    expect(s.sensitivity).toBe('friolero')
    expect(s.lastTrackId).toBe('abc')
    expect(s.lastResultTab).toBe('charts')
    expect(s.axisMode).toBe('km')
  })

  it('corrige de forma segura una fecha pasada', () => {
    const s = sanitizeSettings({ date: '2020-01-01' }, NOW)
    expect(s.date).toBe('2026-10-24')
  })

  it('descarta coordenadas fuera de rango y horas inválidas', () => {
    const s = sanitizeSettings(
      {
        place: { name: 'Malo', lat: 1234, lon: 0 },
        startTime: '99:99',
        avgSpeedKmh: -5,
        climbVamMph: 999999,
      },
      NOW,
    )
    expect(s.place).toBeNull()
    expect(s.startTime).toBe('09:00')
    expect(s.avgSpeedKmh).toBe(26)
    expect(s.climbVamMph).toBe(700)
  })

  it('una hora de llegada presente pero corrupta se elimina', () => {
    const s = sanitizeSettings({ arrivalTime: '25:99' }, NOW)
    expect(s.arrivalTime).toBeNull()
    const ok = sanitizeSettings({ arrivalTime: '17:45', durationMin: 120 }, NOW)
    expect(ok.arrivalTime).toBe('17:45')
  })
})
