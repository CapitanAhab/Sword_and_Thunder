import { ABILITIES, type Ability } from '../../core/schema'
import { valueOf, type ValueKind } from '../../core/session'
import { formatValue } from '../sheet/labels'
import type { MenuCtx, MenuItem } from './menus'

// PG temporales, daño no letal y daño de atributo: filas de Estado y su editor − / + (la misma barra que Preparar).
const label = (c: MenuCtx, kind: ValueKind) =>
  kind === 'temp-hp' ? c.t('play.tempHp') : kind === 'nonlethal' ? c.t('play.nonlethal') : `${c.t('play.abilityDamageOf')} ${c.t(`ability.${kind}`)}`

const note = (c: MenuCtx, kind: ValueKind) =>
  kind === 'temp-hp' ? c.t('play.tempHpNote') : kind === 'nonlethal' ? c.t('play.nonlethalNote') : c.t('play.abilityDamageNote')

const shown = (kind: ValueKind, n: number) => (kind === 'temp-hp' ? formatValue(n, true) : n === 0 ? '0' : `−${n}`)

function valueRow(c: MenuCtx, kind: ValueKind, prefix: string): MenuItem {
  const n = valueOf(c.session, kind)
  const title = label(c, kind)
  return {
    id: `${prefix}-${kind}`,
    label: title,
    ...(n > 0 ? { badge: { text: shown(kind, n) } } : {}),
    detail: { title, line: note(c, kind) },
    action: { type: 'open', menu: `value:${kind}` },
  }
}

// Lo que está activo, para la sección "Tenés" de Estado
export const activeValueRows = (c: MenuCtx): MenuItem[] =>
  (['temp-hp', 'nonlethal', ...ABILITIES] as ValueKind[]).filter((k) => valueOf(c.session, k) > 0).map((k) => valueRow(c, k, 'have'))

// Las filas para cargar valores, en la sección "Agregar"
export const addValueRows = (c: MenuCtx): MenuItem[] => [
  valueRow(c, 'temp-hp', 'add'),
  valueRow(c, 'nonlethal', 'add'),
  {
    id: 'add-ability-damage',
    label: c.t('play.abilityDamage'),
    detail: { title: c.t('play.abilityDamage'), line: c.t('play.abilityDamageNote') },
    action: { type: 'open', menu: 'ability-damage' },
  },
]

export const abilityDamageMenu = (c: MenuCtx): MenuItem[] =>
  ABILITIES.map((a: Ability) => valueRow(c, a, 'damage'))

export function valueMenu(c: MenuCtx, kind: ValueKind): MenuItem[] {
  const n = valueOf(c.session, kind)
  return [{
    id: 'value-edit',
    label: label(c, kind),
    badge: { text: shown(kind, n) },
    detail: { title: label(c, kind), line: note(c, kind), note: c.t('play.valueNote') },
    action: { type: 'prepare' },
  }]
}
