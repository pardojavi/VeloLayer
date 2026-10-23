import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTime } from '../../domain/format'
import { weatherCodeInfo } from '../../domain/forecast/weatherCodes'
import type { AxisMode, PointWeather, RoutePlan } from '../../domain/types'
import { useTheme } from '../../hooks/useTheme'

export interface ChartsPanelProps {
  plan: RoutePlan
  weather: PointWeather[]
  axisMode: AxisMode
  onAxisModeChange: (mode: AxisMode) => void
  selectedIndex: number
  onSelectIndex: (index: number) => void
}

const CHART_H = 150
const SYNC_KEY = 'velolayer'

interface LegendChip {
  color: string
  label: string
}

interface ChartSpec {
  title: string
  chips: LegendChip[]
  series: uPlot.Series[]
  scales?: uPlot.Scales
  axes?: uPlot.Axis[]
  /** Devuelve una columna (array por punto) por cada serie de datos. */
  getCols: (weather: PointWeather[]) => (number | null)[][]
}

function fmtNum(digits = 1) {
  return (_u: uPlot, v: number | null): string =>
    v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 10 ** digits) / 10 ** digits}`
}

const CHART_SPECS: ChartSpec[] = [
  {
    title: 'Temperatura y sensación térmica en bici (°C)',
    chips: [
      { color: '#f59e0b', label: 'Aire' },
      { color: '#38bdf8', label: 'Sensación estimada en bici' },
    ],
    getCols: (w) => [w.map((p) => p.temperature), w.map((p) => p.feltApparentC)],
    series: [
      { label: 'Hora' },
      {
        label: 'Temperatura del aire',
        stroke: '#f59e0b',
        width: 2,
        value: fmtNum(),
      },
      {
        label: 'Sensación en bici (estimada)',
        stroke: '#38bdf8',
        width: 2,
        dash: [6, 4],
        value: fmtNum(),
      },
    ],
  },
  {
    title: 'Viento (km/h): intensidad, rachas y componente de frente/cola',
    chips: [
      { color: '#22d3ee', label: 'Viento' },
      { color: '#a78bfa', label: 'Rachas' },
      { color: '#f97316', label: 'Frente (+) / cola (−)' },
    ],
    getCols: (w) => [
      w.map((p) => p.windSpeed),
      w.map((p) => p.windGust),
      w.map((p) => p.relativeWind?.headKmh ?? null),
    ],
    series: [
      { label: 'Hora' },
      { label: 'Viento', stroke: '#22d3ee', width: 2, value: fmtNum() },
      { label: 'Rachas', stroke: '#a78bfa', width: 1.5, dash: [5, 4], value: fmtNum() },
      { label: 'Componente frente/cola', stroke: '#f97316', width: 2, value: fmtNum() },
    ],
  },
  {
    title: 'Precipitación (mm/h) y probabilidad (%)',
    chips: [
      { color: '#3b82f6', label: 'Precipitación (mm/h)' },
      { color: '#94a3b8', label: 'Probabilidad (%)' },
    ],
    getCols: (w) => [w.map((p) => p.precipitation), w.map((p) => p.precipitationProbability)],
    series: [
      { label: 'Hora' },
      {
        label: 'Precipitación',
        stroke: '#3b82f6',
        fill: 'rgba(59,130,246,0.55)',
        paths: uPlot.paths.bars?.({ size: [0.7, 24] }),
        scale: 'mm',
        value: fmtNum(),
      },
      {
        label: 'Probabilidad de lluvia',
        stroke: '#94a3b8',
        width: 2,
        dash: [4, 3],
        scale: 'pct',
        value: fmtNum(0),
      },
    ],
    scales: {
      mm: { auto: true },
      pct: { auto: false, range: [0, 100] },
    },
    axes: [
      {},
      { scale: 'mm' },
      { scale: 'pct', side: 1, grid: { show: false } },
    ],
  },
  {
    title: 'Perfil de altitud (m)',
    chips: [{ color: '#34d399', label: 'Altitud' }],
    // El perfil real se toma de `plan.points` (elevations) en el bucle de
    // construcción; esta columna solo existe para respetar la firma.
    getCols: (w) => [w.map(() => null as number | null)],
    series: [
      { label: 'Hora' },
      {
        label: 'Altitud',
        stroke: '#34d399',
        fill: 'rgba(52,211,153,0.18)',
        width: 2,
        value: fmtNum(0),
      },
    ],
  },
]

interface IconTick {
  left: number
  icon: string
  time: number
}

interface ChangeMarker {
  left: number
  text: string
}

/** Cambios relevantes para la ropa entre puntos consecutivos. */
function computeChangeMarkers(
  plan: RoutePlan,
  weather: PointWeather[],
  x: number[],
  posOf: (xv: number) => number | null,
): ChangeMarker[] {
  const out: ChangeMarker[] = []
  for (let i = 1; i < plan.points.length; i++) {
    const prev = weather[i - 1]
    const cur = weather[i]
    if (!prev || !cur) continue
    const text =
      describeChange(plan, prev, cur) ?? describeDescent(plan, i)
    if (!text) continue
    const left = posOf(x[i])
    if (left === null) continue
    const last = out[out.length - 1]
    if (last && Math.abs(last.left - left) < 46) continue
    out.push({ left, text })
  }
  return out.slice(0, 10)
}

function describeChange(plan: RoutePlan, prev: PointWeather, cur: PointWeather): string | null {
  const time = fmtTime(cur.timeMs)
  if (
    prev.feltApparentC != null &&
    cur.feltApparentC != null &&
    Math.abs(cur.feltApparentC - prev.feltApparentC) >= 4
  ) {
    const d = Math.round(cur.feltApparentC - prev.feltApparentC)
    return `Cambio de ${d} °C de sensación a las ${time}`
  }
  if (
    prev.precipitation != null &&
    cur.precipitation != null &&
    cur.precipitation >= 0.5 &&
    prev.precipitation < 0.5
  ) {
    return `Empieza a llover (${Math.round(cur.precipitation * 10) / 10} mm/h) a las ${time}`
  }
  void plan
  return null
}

function describeDescent(plan: RoutePlan, i: number): string | null {
  const a = plan.points[i - 1]
  const b = plan.points[i]
  if (a.ele === null || b.ele === null) return null
  const drop = a.ele - b.ele
  if (drop >= 100) {
    return `Descenso de ${Math.round(drop)} m desde el km ${Math.round(a.cumKm)}`
  }
  return null
}

export default function ChartsPanel({
  plan,
  weather,
  axisMode,
  onAxisModeChange,
  selectedIndex,
  onSelectIndex,
}: ChartsPanelProps) {
  const timeAxis = plan.source === 'static' ? true : axisMode === 'time'
  const theme = useTheme()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hostRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])
  const plotsRef = useRef<(uPlot | null)[]>([null, null, null, null])
  const lastIndexRef = useRef(selectedIndex)
  const onSelectRef = useRef(onSelectIndex)
  onSelectRef.current = onSelectIndex

  const [width, setWidth] = useState(640)
  const [buildVersion, setBuildVersion] = useState(0)
  const [iconTicks, setIconTicks] = useState<IconTick[]>([])
  const [changeMarkers, setChangeMarkers] = useState<ChangeMarker[]>([])

  const xs = useMemo(
    () => plan.points.map((p) => (timeAxis ? p.arrivalMs / 1000 : p.cumKm)),
    [plan.points, timeAxis],
  )

  // Ancho del contenedor (responsive).
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const apply = () => setWidth(Math.max(260, Math.floor(el.clientWidth)))
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Construcción de las cuatro gráficas.
  useEffect(() => {
    if (width < 100) return
    const elevations = plan.points.map((p) => p.ele)

    // Ejes y rejilla con los colores del tema activo (claro/noche): uPlot
    // pinta en canvas y no lee las variables CSS.
    const axisStroke = theme === 'dark' ? 'rgba(233,239,236,0.55)' : 'rgba(16,21,18,0.5)'
    const gridStroke = theme === 'dark' ? 'rgba(233,239,236,0.08)' : 'rgba(16,21,18,0.07)'
    const themedAxis = (a: uPlot.Axis): uPlot.Axis => ({
      ...a,
      stroke: a.stroke ?? axisStroke,
      grid: a.grid ?? { stroke: gridStroke },
      ticks: a.ticks ?? { stroke: gridStroke },
    })

    const specs = CHART_SPECS.map((spec, i) => {
      const cols = i === 3 ? [elevations] : spec.getCols(weather)
      const axes: uPlot.Axis[] = (spec.axes ?? [{}, {}]).map(themedAxis)
      const xAxis = axes[0] ?? {}
      const opts: uPlot.Options = {
        width,
        height: CHART_H,
        legend: { show: false },
        padding: [8, 8, 0, 0],
        cursor: {
          // El eje x comparte valores entre las cuatro gráficas: la
          // sincronización por valores mantiene el cursor alineado.
          sync: { key: SYNC_KEY },
          focus: { prox: 24 },
          drag: { x: false, y: false, setScale: false },
          points: { size: 6 },
        },
        scales: { ...(spec.scales ?? {}), x: { time: timeAxis } },
        axes: [
          timeAxis ? xAxis : { ...xAxis, label: 'km' },
          ...axes.slice(1),
        ],
        series: spec.series,
        hooks: {
          setCursor: [
            (u) => {
              const idx = u.cursor.idx
              if (idx != null && idx !== lastIndexRef.current && idx >= 0 && idx < plan.points.length) {
                lastIndexRef.current = idx
                onSelectRef.current(idx)
              }
            },
          ],
        },
      }
      return { opts, data: [xs, ...cols] as uPlot.AlignedData }
    })

    const created: (uPlot | null)[] = [null, null, null, null]
    specs.forEach(({ opts, data }, i) => {
      const el = hostRefs.current[i]
      if (!el) return
      // Limpia restos de construcciones anteriores.
      el.innerHTML = ''
      created[i] = new uPlot(opts, data, el)
    })
    plotsRef.current = created
    setBuildVersion((v) => v + 1)

    // Iconos meteorológicos alineados con el eje horizontal.
    const u0 = created[0]
    if (u0) {
      const step = Math.max(1, Math.ceil(xs.length / 8))
      const ticks: IconTick[] = []
      for (let i = 0; i < xs.length; i += step) {
        const left = u0.valToPos(xs[i], 'x', true)
        if (!Number.isFinite(left)) continue
        ticks.push({
          left,
          icon: weatherCodeInfo(weather[i]?.weatherCode ?? null).icon,
          time: plan.points[i].arrivalMs,
        })
      }
      setIconTicks(ticks)
      setChangeMarkers(
        computeChangeMarkers(plan, weather, xs, (xv) => {
          const l = u0.valToPos(xv, 'x', true)
          return Number.isFinite(l) ? l : null
        }),
      )
    }

    return () => {
      created.forEach((u) => u?.destroy())
      plotsRef.current = [null, null, null, null]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, weather, timeAxis, width, theme])

  // Selección externa (mapa / panel de ropa) → cursor en las cuatro gráficas.
  useEffect(() => {
    const u0 = plotsRef.current[0]
    const x = xs[selectedIndex]
    if (!u0 || x === undefined) return
    lastIndexRef.current = selectedIndex
    const left = u0.valToPos(x, 'x', true)
    if (!Number.isFinite(left)) return
    const rect = u0.over.getBoundingClientRect()
    // Un mousemove sintético sincroniza las cuatro vía el hub de uPlot.
    u0.over.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: rect.left + left,
        clientY: rect.top + 10,
      }),
    )
  }, [selectedIndex, xs, buildVersion])

  const showToggle = plan.source !== 'static'

  return (
    <div className="charts-panel" ref={wrapperRef}>
      <div className="charts-toolbar">
        {showToggle ? (
          <div className="segmented" role="group" aria-label="Eje horizontal">
            <button
              type="button"
              className={timeAxis ? 'active' : ''}
              onClick={() => onAxisModeChange('time')}
            >
              Hora
            </button>
            <button
              type="button"
              className={!timeAxis ? 'active' : ''}
              onClick={() => onAxisModeChange('km')}
            >
              Kilómetro
            </button>
          </div>
        ) : (
          <span className="hint">Sin ruta: el eje es la hora.</span>
        )}
        <span className="hint">El cursor está sincronizado con el mapa.</span>
      </div>

      <div className="chart-block">
        <div className="icon-strip" aria-hidden="true">
          {iconTicks.map((t, i) => (
            <span key={i} className="icon-tick" style={{ left: t.left }} title={fmtTime(t.time)}>
              {t.icon}
            </span>
          ))}
          {changeMarkers.map((m, i) => (
            <span key={`c${i}`} className="change-marker" style={{ left: m.left }} title={m.text}>
              !
            </span>
          ))}
        </div>
        <ChartBlock spec={CHART_SPECS[0]} hostRef={(el) => (hostRefs.current[0] = el)} />
      </div>

      <ChartBlock spec={CHART_SPECS[1]} hostRef={(el) => (hostRefs.current[1] = el)} />
      <ChartBlock spec={CHART_SPECS[2]} hostRef={(el) => (hostRefs.current[2] = el)} />
      <ChartBlock
        spec={CHART_SPECS[3]}
        hostRef={(el) => (hostRefs.current[3] = el)}
        note={plan.points.some((p) => p.ele !== null) ? undefined : 'Sin datos de altitud en la ruta.'}
      />

      <p className="hint chart-hint">
        Las marcas “!” señalan cambios relevantes para la ropa (caídas de temperatura, inicio de
        lluvia o descensos largos). Los valores entre horas son interpolaciones: la previsión real
        tiene resolución horaria.
      </p>
    </div>
  )
}

interface ChartBlockProps {
  spec: ChartSpec
  hostRef: (el: HTMLDivElement | null) => void
  note?: string
}

function ChartBlock({ spec, hostRef, note }: ChartBlockProps) {
  return (
    <div className="chart-card">
      <div className="chart-title">{spec.title}</div>
      <div className="chart-legend">
        {spec.chips.map((c) => (
          <span key={c.label} className="legend-chip">
            <span className="legend-dot" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
        {note ? <span className="hint">{note}</span> : null}
      </div>
      <div className="chart-host" ref={hostRef} />
    </div>
  )
}
