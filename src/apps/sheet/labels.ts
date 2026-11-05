import { es, type MessageKey } from '../../i18n/es'
import { ABILITIES, type Ability } from '../../core/schema'
import { signed, type Modifier, type Stat } from '../../core/modifiers'
import type { Issue } from '../../core/compute'
import { warnMissing } from '../../data/names'

// Ids internos de core/ → texto de la UI. Solo traduce y formatea: no calcula nada.
// Lo que no es un id conocido (nombre de ítem, dote, raza) se muestra tal cual.

export type Translate = (key: MessageKey) => string

const isKey = (k: string): k is MessageKey => k in es
const isAbility = (s: string): s is Ability => (ABILITIES as readonly string[]).includes(s)

// Fuente interna (atributo o id de core) → abreviatura; null si es un nombre (ítem, dote, raza).
function internalSource(t: Translate, source: string): string | null {
  if (isAbility(source)) return t(`ability.${source}`)
  const key = `source.${source}`
  return isKey(key) ? t(key) : null
}

// Un componente del desglose: "10", "+3 FUE", "+1 r", "+4 arm (Chain shirt)", "+4 (Improved Initiative)".
// plain: sin signo (el valor de arranque de un total sin signo: 10 de la CA, 16 de FUE, 8 de los DG).
// named: cómo mostrar una fuente que no es un id (ítem, dote); sin él, tal cual.
export function componentLabel(t: Translate, m: Modifier, plain = false, named?: (source: string) => string): string {
  // Los rangos se cuentan, no se suman como bono: "1 rango", "2 rangos"
  if (m.source === 'ranks') return `${m.value} ${t(m.value === 1 ? 'source.ranks' : 'source.ranks.other')}`
  const internal = internalSource(t, m.source)
  const sourceName = internal === null ? `(${named ? named(m.source) : m.source})` : ''
  // Los tipos internos (base, ability) no se nombran: se ve la fuente
  const label = m.type === 'base' || m.type === 'ability' ? (internal ?? sourceName) : [t(`bonusType.${m.type}`), sourceName].filter(Boolean).join(' ')
  return [formatValue(m.value, !plain), label].filter(Boolean).join(' ')
}

// Desglose sin ceros. Vacío si no aporta nada (un único valor base: velocidad, NL, BAB…).
// sep: las habilidades usan " · " ("+4 INT · 1 rango · +3 de clase"); el resto, un espacio.
export function statParts(t: Translate, stat: Stat, isSigned: boolean, named?: (source: string) => string, sep = ' '): string {
  const mods = stat.applied.filter((m) => m.value !== 0)
  if (mods.length === 1 && mods[0]?.type === 'base') return ''
  return mods.map((m, i) => componentLabel(t, m, !isSigned && i === 0 && m.value >= 0, named)).join(sep)
}
export const SKILL_SEP = ' · '

// El mismo desglose que statParts, en filas para la tarjeta de detalle, con los nombres largos:
// { Base 10 } { Armadura +4, sub: Camisa de malla } { Destreza +1 }. Vacío en los mismos casos que statParts.
export interface StatRow {
  label: string
  value: string
  sub?: string
}
// Las abreviaturas internas van en minúscula ("base", "de clase"); en una fila, con mayúscula inicial
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export function statRows(t: Translate, stat: Stat, isSigned: boolean, named?: (source: string) => string): StatRow[] {
  const mods = stat.applied.filter((m) => m.value !== 0)
  if (mods.length === 1 && mods[0]?.type === 'base') return []
  return mods.map((m, i) => {
    if (m.source === 'ranks') return { label: t('card.ranks'), value: String(m.value) }
    const value = formatValue(m.value, !(!isSigned && i === 0 && m.value >= 0))
    const internal = internalSource(t, m.source)
    const name = internal === null ? (named ? named(m.source) : m.source) : undefined
    const source = internal || name || ''
    if (m.type === 'base' || m.type === 'ability') {
      const label = isAbility(m.source) ? t(`abilityLong.${m.source}`) : m.source === 'base' ? t('card.base') : source
      return { label: cap(label), value }
    }
    // Sin tipo: se nombra la fuente; con tipo: el tipo y, abajo, de dónde sale
    if (m.type === 'untyped') return { label: cap(source) || t('bonusTypeLong.untyped'), value }
    return { label: t(`bonusTypeLong.${m.type}`), value, ...(source ? { sub: cap(source) } : {}) }
  })
}

// "(+9 lanzando a la defensiva o apresado)", una por condición.
export function conditionalTexts(t: Translate, stat: Stat, isSigned: boolean): string[] {
  return stat.conditional.map((c) => `(${formatValue(c.total, isSigned)} ${conditionLabel(t, c.condition)})`)
}

export function conditionLabel(t: Translate, condition: string): string {
  return condition
    .split('|')
    .map((c) => {
      const key = `condition.${c}`
      if (!isKey(key)) warnMissing('clave', key)
      return isKey(key) ? t(key) : c
    })
    .join(` ${t('common.or')} `)
}

export function issueLabel(t: Translate, issue: Issue): string {
  return t(`issue.${issue.code}`) + (issue.detail ? ` (${issue.detail})` : '')
}

export function resourceDetailLabel(t: Translate, id: string): string {
  return keyOr(t, `resourceDetail.${id}`, id)
}

// Valores cortos del JSON con traducción en i18n; si no hay clave, tal cual (y en dev, aviso en la consola).
function keyOr(t: Translate, key: string, fallback: string): string {
  if (isKey(key)) return t(key)
  warnMissing('clave', key)
  return fallback
}
export const alignmentLabel = (t: Translate, alignment: string) => keyOr(t, `alignment.${alignment}`, alignment)
export const damageTypeLabel = (t: Translate, type: string) => keyOr(t, `damageType.${type}`, type)
export const slotLabel = (t: Translate, slot: string) => keyOr(t, `slot.${slot}`, slot)
// Nota breve de una acción de clase en #/play (por id: actionNote.spell-combat)
export const actionNoteLabel = (t: Translate, actionId: string) => keyOr(t, `actionNote.${actionId}`, '')

// Tipografía: "-2" → "−2", "19-20/x2" → "19-20/×2"
export const minus = (s: string) => s.replace(/^-/, '−')
export const prettyCrit = (crit: string) => crit.replace(/x(\d)/, '×$1')

export const formatValue = (n: number, isSigned: boolean) => minus(isSigned ? signed(n) : String(n))

// Miles a mano (Intl en 'es' no separa los de 4 cifras): 3000 → "3.000" / "3,000"
export const formatInt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
// Peso en kg: hasta 2 decimales, sin ceros de más (24,75 · 12,5 · 2); coma decimal en ES.
export const formatKg = (n: number) => {
  const s = String(Math.round(n * 100) / 100)
  return s.replace('.', ',')
}
