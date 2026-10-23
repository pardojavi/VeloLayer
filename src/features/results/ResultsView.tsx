import { useState } from 'react'
import ChartsPanel from '../charts/ChartsPanel'
import ClothingView from '../clothing/ClothingView'
import SummaryView from './SummaryView'
import type { AnalysisResult } from '../../hooks/useAnalysis'
import type { AxisMode, MapColorMode, ResultTab, ThermalSensitivity } from '../../domain/types'

export interface ResultsViewProps {
  result: AnalysisResult
  tab: ResultTab
  onTabChange: (tab: ResultTab) => void
  selectedIndex: number
  onSelectIndex: (index: number) => void
  axisMode: AxisMode
  onAxisModeChange: (mode: AxisMode) => void
  sensitivity: ThermalSensitivity
  onSensitivityChange: (sensitivity: ThermalSensitivity) => void
  onNewPlan: () => void
}

const TABS: { id: ResultTab; label: string }[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'charts', label: 'Gráficas' },
  { id: 'clothing', label: 'Ropa' },
]

export default function ResultsView({
  result,
  tab,
  onTabChange,
  selectedIndex,
  onSelectIndex,
  axisMode,
  onAxisModeChange,
  sensitivity,
  onSensitivityChange,
  onNewPlan,
}: ResultsViewProps) {
  const [colorMode, setColorMode] = useState<MapColorMode>('temperature')

  return (
    <div className="results-view">
      <header className="results-header">
        <button type="button" className="ghost" onClick={onNewPlan}>
          ← Nueva salida
        </button>
        <div className="segmented tabs" role="tablist" aria-label="Resultados">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'summary' ? (
        <SummaryView
          result={result}
          selectedIndex={selectedIndex}
          onSelectIndex={onSelectIndex}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
        />
      ) : null}

      {tab === 'charts' ? (
        <ChartsPanel
          plan={result.plan}
          weather={result.weather}
          axisMode={axisMode}
          onAxisModeChange={onAxisModeChange}
          selectedIndex={selectedIndex}
          onSelectIndex={onSelectIndex}
        />
      ) : null}

      {tab === 'clothing' ? (
        <ClothingView
          clothing={result.clothing}
          sensitivity={sensitivity}
          onSensitivityChange={onSensitivityChange}
        />
      ) : null}
    </div>
  )
}
