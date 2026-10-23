import { useEffect, useState } from 'react'
import { AppError } from './domain/errors'
import { buildClothingInput } from './domain/analysis'
import { recommendClothing } from './domain/clothing/clothingEngine'
import type {
  AppView,
  AxisMode,
  GeoPoint,
  ResultTab,
  ThermalSensitivity,
  ThemeMode,
  TrackRecord,
} from './domain/types'
import { errorMessage, useSettings } from './hooks/useSettings'
import { useAnalysis } from './hooks/useAnalysis'
import type { AnalysisResult } from './hooks/useAnalysis'
import { useGeolocation } from './hooks/useGeolocation'
import PlanningView from './features/planning/PlanningView'
import ResultsView from './features/results/ResultsView'
import SettingsView from './features/settings/SettingsView'
import { getTrack } from './storage/tracksRepository'

export default function App() {
  const { settings, ready, update, reset, storageWarning } = useSettings()
  const geo = useGeolocation()
  const { calculate, busy } = useAnalysis()

  const [view, setView] = useState<AppView>('plan')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [axisMode, setAxisMode] = useState<AxisMode>('time')
  const [resultTab, setResultTab] = useState<ResultTab>('summary')
  const [planError, setPlanError] = useState<string | null>(null)
  const [track, setTrack] = useState<TrackRecord | null>(null)

  // Restaurar el último track utilizado.
  useEffect(() => {
    if (!ready) return
    const id = settings.lastTrackId
    if (!id) return
    let alive = true
    getTrack(id)
      .then((t) => {
        if (alive && t) setTrack((prev) => prev ?? t)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [ready, settings.lastTrackId])

  // Restaurar preferencias de visualización (solo al iniciar).
  useEffect(() => {
    if (!ready) return
    setAxisMode(settings.axisMode)
    setResultTab(settings.lastResultTab === 'clothing' ? 'clothing' : 'summary')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Tema visual (claro/blanco-verde o noche/negro-verde).
  const theme: ThemeMode = ready ? settings.theme : 'light'
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // Espejo en localStorage para poder aplicarlo antes del primer pintado
    // (lo lee index.html). La fuente de verdad sigue siendo IndexedDB.
    try {
      localStorage.setItem('velolayer-theme', theme)
    } catch {
      // Modos privados sin localStorage: no es crítico.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0a0d0c' : '#f3f6f4')
  }, [theme])

  const handleCalculate = async () => {
    setPlanError(null)
    try {
      if (settings.planMode === 'gpx' && !track) {
        throw new AppError('gpx-invalid', 'Selecciona o importa un track GPX para calcular.')
      }
      if (settings.planMode === 'place' && !settings.place) {
        throw new AppError(
          'no-start-point',
          'Elige un lugar de salida: búscalo o selecciónalo en el mapa.',
        )
      }
      let location: GeoPoint | null = null
      if (settings.planMode === 'location') {
        // La geolocalización se solicita solo al calcular, si no hay posición.
        location = geo.position ?? (await geo.request())
      }
      const analysis = await calculate(
        settings,
        settings.planMode === 'gpx' ? (track ? track.points : null) : null,
        location,
      )
      setResult(analysis)
      setSelectedIndex(0)
      setResultTab('summary')
      setView('results')
    } catch (e) {
      setPlanError(errorMessage(e))
    }
  }

  const handleSensitivity = (s: ThermalSensitivity) => {
    update({ sensitivity: s })
    // Se recalcula la recomendación al instante con los datos ya obtenidos.
    setResult((prev) =>
      prev
        ? {
            ...prev,
            clothing: recommendClothing(buildClothingInput(prev.plan, prev.weather, s)),
          }
        : prev,
    )
  }

  const showPlanning = view === 'plan' || (view === 'results' && !result)

  return (
    <div className="app">
      {storageWarning ? <div className="banner warning">{storageWarning}</div> : null}

      <header className="app-topbar">
        <span className="brand">VeloLayer</span>
        <button
          type="button"
          className="icon-btn"
          aria-label={theme === 'dark' ? 'Cambiar al tema claro' : 'Cambiar al tema noche'}
          onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })}
        >
          <ThemeIcon dark={theme === 'dark'} />
        </button>
      </header>

      <main className="app-main">
        {!ready ? (
          <div className="hint center loading">Cargando tus preferencias…</div>
        ) : showPlanning ? (
          <PlanningView
            settings={settings}
            update={update}
            onCalculate={() => void handleCalculate()}
            busy={busy}
            error={planError}
            track={track}
            onTrackChange={(t) => {
              setTrack(t)
              update({ lastTrackId: t ? t.id : null })
            }}
            geo={geo}
          />
        ) : view === 'results' && result ? (
          <ResultsView
            result={result}
            tab={resultTab}
            onTabChange={(t) => {
              setResultTab(t)
              update({ lastResultTab: t })
            }}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            axisMode={axisMode}
            onAxisModeChange={(m) => {
              setAxisMode(m)
              update({ axisMode: m })
            }}
            sensitivity={settings.sensitivity}
            onSensitivityChange={handleSensitivity}
            onNewPlan={() => setView('plan')}
          />
        ) : (
          <SettingsView
            settings={settings}
            onReset={reset}
            storageWarning={null}
            onThemeChange={(t) => void update({ theme: t })}
          />
        )}

        <footer className="app-footer">
          Datos:{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>{' '}
          · Mapa:{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap
          </a>{' '}
          · Previsión con resolución horaria: es una estimación.
        </footer>
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button
          type="button"
          className={showPlanning ? 'active' : ''}
          onClick={() => setView('plan')}
        >
          <span className="nav-icon" aria-hidden="true">
            🧭
          </span>
          <span>Planear</span>
        </button>
        <button
          type="button"
          disabled={!result}
          className={view === 'results' && result ? 'active' : ''}
          onClick={() => result && setView('results')}
        >
          <span className="nav-icon" aria-hidden="true">
            📊
          </span>
          <span>Resultados</span>
        </button>
        <button
          type="button"
          className={view === 'settings' ? 'active' : ''}
          onClick={() => setView('settings')}
        >
          <span className="nav-icon" aria-hidden="true">
            ⚙️
          </span>
          <span>Ajustes</span>
        </button>
      </nav>
    </div>
  )
}

/** Icono del conmutador de tema: luna en tema claro, sol en tema noche. */
function ThemeIcon({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
    </svg>
  )
}
