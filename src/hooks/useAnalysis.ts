import { useCallback, useState } from 'react'
import { buildClothingInput, buildPointWeather } from '../domain/analysis'
import { recommendClothing } from '../domain/clothing/clothingEngine'
import type { ClothingRecommendation } from '../domain/types'
import { buildRoutePlan } from '../domain/plan'
import type { GeoPoint, PointWeather, RawTrackPoint, RoutePlan, Settings } from '../domain/types'
import { fetchElevations } from '../services/elevation'
import { fetchPointForecasts, forecastDaysFor } from '../services/openMeteo/forecast'

export interface AnalysisResult {
  plan: RoutePlan
  weather: PointWeather[]
  clothing: ClothingRecommendation
  computedAt: number
}

export interface UseAnalysis {
  busy: boolean
  calculate: (settings: Settings, track: RawTrackPoint[] | null, location: GeoPoint | null) => Promise<AnalysisResult>
}

/**
 * Orquesta el cálculo: plan de ruta → altitud → previsión por punto →
 * sensación térmica → recomendación de ropa. La lógica de cálculo vive en
 * `domain/`, aquí solo se encadena.
 */
export function useAnalysis(): UseAnalysis {
  const [busy, setBusy] = useState(false)

  const calculate = useCallback(
    async (
      settings: Settings,
      track: RawTrackPoint[] | null,
      location: GeoPoint | null,
    ): Promise<AnalysisResult> => {
      setBusy(true)
      try {
        const plan = buildRoutePlan({ settings, track, location })

        // La altitud de Open-Meteo se pide solo donde el track no la aporta.
        if (plan.points.some((p) => p.ele === null)) {
          const elevations = await fetchElevations(
            plan.points.map((p) => ({ lat: p.lat, lon: p.lon })),
          )
          plan.points = plan.points.map((p, i) =>
            p.ele === null ? { ...p, ele: elevations[i] ?? null } : p,
          )
          const withEle = plan.points.some((p) => p.ele !== null)
          if (withEle && plan.source !== 'static') {
            let ascent = 0
            let descent = 0
            for (let i = 1; i < plan.points.length; i++) {
              const a = plan.points[i - 1].ele
              const b = plan.points[i].ele
              if (a === null || b === null) continue
              const d = b - a
              if (d > 0) ascent += d
              else descent += -d
            }
            plan.stats.ascentM = Math.round(ascent)
            plan.stats.descentM = Math.round(descent)
            plan.notes.push({
              code: 'elevation-estimated',
              severity: 'info',
              message: 'La altitud procede del modelo digital de elevaciones (90 m).',
            })
          }
        }

        const forecastDays = forecastDaysFor(plan.departureMs, plan.arrivalMs)
        const forecasts = await fetchPointForecasts(
          plan.points.map((p) => ({ lat: p.lat, lon: p.lon, elevation: p.ele })),
          { forecastDays },
        )

        const weather = buildPointWeather(plan, forecasts)

        const outCount = weather.filter((w) => w.outOfRange).length
        if (outCount > 0) {
          plan.notes.push({
            code: 'out-of-horizon',
            severity: 'warning',
            message:
              `${outCount} punto${outCount > 1 ? 's' : ''} queda${outCount > 1 ? 'n' : ''} fuera del ` +
              `horizonte de previsión disponible (${forecastDays} días).`,
          })
        }

        const clothing = recommendClothing(buildClothingInput(plan, weather, settings.sensitivity))

        return { plan, weather, clothing, computedAt: Date.now() }
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  return { busy, calculate }
}
