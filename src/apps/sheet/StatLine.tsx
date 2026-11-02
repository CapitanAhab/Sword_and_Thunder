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

// Línea de solo lectura: ETIQUETA a la izquierda y el total a la derecha; debajo, el desglose sin ceros y las
// condicionales. testids: el número (texto limpio: "+3"), `-parts` (el desglose) y `-conditional`.
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
        <span className="stat-parts" data-testid={`${testId}-parts`}>
          {parts}
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

// Cajita (como las de los atributos): rótulo, total y, si `withParts`, el desglose corto adentro (salvaciones).
// Mismos testids que StatLine.
export function StatBox({ label, stat, signed = true, testId, withParts = false }: Omit<Props, 'suffix'> & { withParts?: boolean }) {
  const { t, lang } = useT()
  const parts = withParts ? statParts(t, stat, signed, (s) => localSource(lang, s)) : ''
  return (
    <div className="stat-box">
      <span className="stat-label">{label}</span>
      <span className="stat-box-value" data-testid={testId}>
        {formatValue(stat.total, signed)}
      </span>
      {parts && (
        <span className="stat-parts" data-testid={`${testId}-parts`}>
          {parts}
        </span>
      )}
      {withParts &&
        conditionalTexts(t, stat, signed).map((c) => (
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
