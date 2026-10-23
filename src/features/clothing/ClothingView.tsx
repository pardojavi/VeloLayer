import { fmtTemp } from '../../domain/format'
import type { ClothingGroup, ClothingRecommendation, ThermalSensitivity } from '../../domain/types'

export interface ClothingViewProps {
  clothing: ClothingRecommendation
  sensitivity: ThermalSensitivity
  onSensitivityChange: (s: ThermalSensitivity) => void
}

const GROUP_ORDER: { group: ClothingGroup; label: string; icon: string }[] = [
  { group: 'head', label: 'Cabeza', icon: '🧢' },
  { group: 'torso', label: 'Torso', icon: '🎽' },
  { group: 'hands', label: 'Manos', icon: '🧤' },
  { group: 'legs', label: 'Piernas', icon: '🦵' },
  { group: 'feet', label: 'Pies', icon: '👟' },
  { group: 'pocket', label: 'Llevar en el bolsillo', icon: '🎒' },
]

const SENSITIVITY_LABELS: Record<ThermalSensitivity, string> = {
  friolero: 'Friolero',
  normal: 'Normal',
  caluroso: 'Caluroso',
}

const SEVERITY_ICONS: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  danger: '⛔',
}

export default function ClothingView({
  clothing,
  sensitivity,
  onSensitivityChange,
}: ClothingViewProps) {
  return (
    <div className="clothing-view">
      <div className="card ref-card">
        <div>
          <span className="stat-label">Sensación de referencia</span>
          <div className="big-temp">
            {fmtTemp(clothing.referenceTempC)}
            <span className="hint">
              {' '}
              (media {fmtTemp(clothing.meanApparentC)} · mín. {fmtTemp(clothing.minApparentC)} ·
              máx. {fmtTemp(clothing.maxApparentC)})
            </span>
          </div>
        </div>
        <div className="field compact">
          <span className="label-text">Sensibilidad</span>
          <div className="segmented" role="group" aria-label="Sensibilidad térmica">
            {(['friolero', 'normal', 'caluroso'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={sensitivity === s ? 'active' : ''}
                onClick={() => onSensitivityChange(s)}
              >
                {SENSITIVITY_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {GROUP_ORDER.map(({ group, label, icon }) => {
        const items = clothing.items.filter((i) => i.group === group)
        if (items.length === 0) return null
        return (
          <section key={group} className="card">
            <h2>
              <span aria-hidden="true">{icon}</span> {label}
            </h2>
            <ul className="item-list">
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.label}</strong>
                  <p className="reason">{item.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {clothing.warnings.length > 0 ? (
        <section className="card">
          <h2>⚠️ Avisos</h2>
          <ul className="item-list">
            {clothing.warnings.map((a) => (
              <li key={a.id} className={`advice ${a.severity}`}>
                <strong>
                  {SEVERITY_ICONS[a.severity]} {a.title}
                </strong>
                <p className="reason">{a.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="hint">
        Cada prenda indica el dato, el tramo y la hora que la justifican. Los umbrales son
        valores de partida configurables en <code>src/rules/clothing.json</code>: calíbralos con
        tu experiencia.
      </p>
    </div>
  )
}
