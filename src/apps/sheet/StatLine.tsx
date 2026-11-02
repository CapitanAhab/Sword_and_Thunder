import type { ReactNode } from 'react'
import type { Stat } from '../../core/modifiers'
import { useT } from '../../i18n/useT'
import { conditionalTexts, formatValue, statParts } from './labels'
import { localSource } from '../../data/names'

// Piezas del panel de la página 1. El número lleva el testid (texto limpio: "+3"); su desglose aparece al tocarlo,
// en un renglón aparte debajo del bloque (OpenParts), con el testid `{testid}-parts`. Las condicionales
// ("+9 lanzando a la defensiva") van siempre a la vista (Conds), con `{testid}-conditional`.

export interface PanelStat {
  testId: string
  label: string
  stat: Stat
  signed?: boolean
  suffix?: string
  icon?: string // ♥ ⛨ ⚡ (los del HUD), solo en los números grandes; va aparte del número, sin testid
  tone?: 'blood' | 'bolt' | 'plain' // color del ícono
}

// El desglose en texto, sin ceros; vacío si no hay nada que desglosar (un único valor base).
export function useParts() {
  const { t, lang } = useT()
  return (s: PanelStat) => statParts(t, s.stat, s.signed ?? true, (src) => localSource(lang, src))
}

interface TapProps {
  item: PanelStat
  open: boolean
  onToggle: (testId: string) => void
}

// Número grande de un trío: el ícono (si hay), el número y el rótulo debajo. PG, CA e Inic van grandes;
// las salvaciones, con `small`. Se toca solo si tiene desglose.
export function BigStat({ item, open, onToggle, small = false }: TapProps & { small?: boolean }) {
  const parts = useParts()(item)
  const cls = `tap-stat big-stat${small ? ' is-small' : ''}`
  const inner = (
    <>
      {item.icon && (
        <span className={`sheet-icon is-${item.tone ?? 'plain'}`} aria-hidden>
          {item.icon}
        </span>
      )}
      <span className="big-value" data-testid={item.testId}>
        {formatValue(item.stat.total, item.signed ?? true)}
      </span>
      <span className="stat-label">{item.label}</span>
    </>
  )
  return parts ? (
    <button type="button" className={cls} aria-expanded={open} onClick={() => onToggle(item.testId)}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

// Número chico en línea: "Fort +4", "BMC +3", "Velocidad 30 pies". Se toca solo si tiene desglose.
export function MiniStat({ item, open, onToggle }: TapProps) {
  const parts = useParts()(item)
  const inner = (
    <>
      <span className="stat-label">{item.label}</span>{' '}
      <b className="mini-value" data-testid={item.testId}>
        {formatValue(item.stat.total, item.signed ?? true)}
      </b>
      {item.suffix && <small className="muted"> {item.suffix}</small>}
    </>
  )
  return parts ? (
    <button type="button" className="tap-stat mini-stat" aria-expanded={open} onClick={() => onToggle(item.testId)}>
      {inner}
    </button>
  ) : (
    <span className="tap-stat mini-stat">{inner}</span>
  )
}

// Un valor que no es Stat (At. base, fallo arcano): mismo aspecto, sin desglose.
export function MiniPlain({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <span className="tap-stat mini-stat">
      <span className="stat-label">{label}</span>{' '}
      <b className="mini-value" data-testid={testId}>
        {value}
      </b>
    </span>
  )
}

// El desglose del número abierto, si es de este bloque: "CA = 10 +4 arm (Camisa de malla) +1 DES".
export function OpenParts({ items, open }: { items: PanelStat[]; open: string | null }) {
  const parts = useParts()
  const item = items.find((i) => i.testId === open)
  const text = item ? parts(item) : ''
  if (!item || !text) return null
  return (
    <p className="stat-parts panel-parts">
      {item.label} <span aria-hidden>= </span>
      <span data-testid={`${item.testId}-parts`}>{text}</span>
    </p>
  )
}

// Las condicionales del bloque, siempre a la vista: "Concentración (+9 lanzando a la defensiva o apresado)".
export function Conds({ items }: { items: PanelStat[] }) {
  const { t } = useT()
  return (
    <>
      {items.flatMap((i) =>
        conditionalTexts(t, i.stat, i.signed ?? true).map((c) => (
          <p key={i.testId + c} className="stat-cond" data-testid={`${i.testId}-conditional`}>
            {i.label} {c}
          </p>
        )),
      )}
    </>
  )
}

// Un bloque del panel: separado del siguiente por una línea fina, con un título opcional (en letra de inscripción;
// `arcane` lo pinta del color de lo mágico).
export function Block({ title, meta, arcane = false, children }: { title?: ReactNode; meta?: ReactNode; arcane?: boolean; children: ReactNode }) {
  return (
    <div className="panel-block">
      {title && (
        <p className={`block-title${arcane ? ' is-arcane' : ''}`}>
          <span>{title}</span>
          {meta && <span className="block-meta">{meta}</span>}
        </p>
      )}
      {children}
    </div>
  )
}
