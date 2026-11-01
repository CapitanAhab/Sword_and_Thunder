import type { ReactNode } from 'react'
import type { Stat } from '../../core/modifiers'
import { useT } from '../../i18n/useT'
import { conditionalTexts, formatValue, statParts } from './labels'
import { localSource } from '../../data/names'

interface Props {
  label: ReactNode
  stat: Stat
  signed?: boolean
  suffix?: string
  testId: string
}

// Línea de solo lectura: ETIQUETA  total  = desglose sin ceros, y las condicionales debajo.
// testids: el número (texto limpio: "+3"), `-parts` (desglose sin el "=") y `-conditional`.
export function StatLine({ label, stat, signed = true, suffix, testId }: Props) {
  const { t, lang } = useT()
  const parts = statParts(t, stat, signed, (s) => localSource(lang, s))
  return (
    <div className="stat-line">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        <span data-testid={testId}>{formatValue(stat.total, signed)}</span>
        {suffix && <small> {suffix}</small>}
      </span>
      {parts && (
        <span className="stat-parts">
          <span aria-hidden>= </span>
          <span data-testid={`${testId}-parts`}>{parts}</span>
        </span>
      )}
      {conditionalTexts(t, stat, signed).map((c) => (
        <span key={c} className="stat-cond" data-testid={`${testId}-conditional`}>
          {c}
        </span>
      ))}
    </div>
  )
}

// Misma línea para valores que no son Stat (BAB, fallo arcano).
export function PlainLine({ label, value, testId }: { label: ReactNode; value: string; testId: string }) {
  return (
    <div className="stat-line">
      <span className="stat-label">{label}</span>
      <span className="stat-value" data-testid={testId}>
        {value}
      </span>
    </div>
  )
}
