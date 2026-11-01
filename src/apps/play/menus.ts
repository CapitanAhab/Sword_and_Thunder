import type { AttackLine, AttackVariant, ComputedSheet } from '../../core/compute'
import type { Character } from '../../core/schema'
import type { Lang } from '../../i18n/useT'
import { BASIC_ACTIONS, CONDITIONS, STANCES, type ActionKind, type ConditionId, type StanceId } from '../../core/rules/pf1e/actions'
import { defensiveCastingDc, spellDamageText, spellRangeFt } from '../../core/rules/pf1e/spells'
import {
  applyAction, castInfoFor, castSpell, castsLeft, charge, checkAction, consumeItem, currentHp, dropHeld, endBuff, endCharge, endCombat, endEnhancement,
  enhanceWeapon, hpState, isCantrip, itemsLeft, preparedTotal, recallCost, recallSpell, resourceLeft, rest, slotsLeft, slotsPerDay, spellActionKind,
  spendResource, startCombat, timesCast, timesPrepared, toggleCondition, toggleDefensive, toggleStance, touchHit, undoDeath, revive, type Session,
  type SpellCounts,
} from '../../core/session'
import { spells } from '../../data/spells'
import { localName, localNote, localSource, localSpell } from '../../data/names'
import type { FxEvent } from './fx/effects'
import { actionNoteLabel, componentLabel, formatValue, minus, prettyCrit, SKILL_SEP, slotLabel, statParts, type Translate } from '../sheet/labels'

// Árbol del menú de #/play a partir de la ficha calculada + la sesión. Solo arma textos y acciones:
// los números salen de computeSheet y las reglas de core/session.ts.

type Update = (s: Session) => Session

// Adónde va la pantalla cuando termina el efecto: 'root' = menú principal, 'stay' = se queda,
// { menu } = el menú principal + ese submenú (ej. ¿Pegó? después de un conjuro de toque).
export type After = 'root' | 'stay' | { menu: string; label: string }

export type ItemAction =
  | { type: 'open'; menu: string }
  // Acción completa: aplica `update`, dispara UN efecto (Regla A) y navega según `after`.
  | { type: 'execute'; fx: FxEvent; update?: Update; after: After; noAnim?: boolean; slash?: boolean } // slash: el Tajo se ve, sin sonido
  | { type: 'toggle'; update: Update; on: boolean } // ON/OFF: no navega
  | { type: 'rest' } // se confirma manteniendo apretado (hold)
  | { type: 'commit'; update: Update } // pantalla de muerte (hold): aplica el cambio sin efecto y vuelve al menú principal
  | { type: 'prepare' } // fila de Preparar: se cambia con − / +
  | { type: 'skills-toggle' }
  | { type: 'none' }

// Columna del panel de detalle: rótulo chico arriba, valor abajo. `id` va al testid.
export interface DetailStat {
  id: string
  label: string
  value: string
}

export interface MenuItem {
  id: string
  label: string
  section?: string // encabezado que va antes de este ítem
  badge?: { text: string; tone?: 'mana' | 'gold' | 'muted' | 'on' }
  // warn: aviso que va primero en la descripción (moribundo / incapacitado, ver gate())
  detail: { title: string; tag?: string; stats?: DetailStat[]; line?: string; note?: string; extra?: string; warn?: string }
  spell?: { level: string; name: string } // si está, tocar el detalle abre la tarjeta
  hold?: boolean // se confirma manteniendo apretado (CONFIRMAR o la fila)
  act?: ActionKind // tipo de acción en el turno (gate() → core: checkAction / applyAction)
  blocked?: boolean // bloqueada por los PG (gate): la fila se ve apagada y CONFIRMAR no hace nada
  action: ItemAction
}

export interface MenuCtx {
  t: Translate
  lang: Lang
  sheet: ComputedSheet
  session: Session
  character: Character
  draft: SpellCounts // borrador de Preparar
  showAllSkills: boolean
}

const sv = (n: number) => formatValue(n, true)
const diamonds = (left: number, total: number) => '◆'.repeat(left) + '◇'.repeat(Math.max(0, total - left))
const byNumber = (a: string, b: string) => Number(a) - Number(b)
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const onOff = (on: boolean): MenuItem['badge'] => ({ text: on ? 'ON' : 'OFF', tone: on ? 'on' : 'muted' })

const weaponStats = (t: Translate, a: AttackLine, v: AttackVariant, attack = sv(v.attack.total)): DetailStat[] => [
  { id: 'attack', label: t('play.col.attack'), value: attack },
  { id: 'damage', label: t('play.col.damage'), value: minus(v.damageText) },
  { id: 'crit', label: t('play.col.crit'), value: prettyCrit(a.critical) },
]
const actionTag = (t: Translate, kind: ActionKind) => t(kind === 'full' ? 'play.fullRoundShort' : 'play.standardAction')
// "Ataque: +4 −2 (Combate con conjuros)": el ataque normal y lo que suma o resta la variante (los dos salen de computeSheet).
const variantAttackNote = (c: MenuCtx, std: AttackVariant, v: AttackVariant): string | undefined => {
  if (v.id === std.id) return undefined
  const own = v.attack.applied.filter((m) => m.source === v.name && m.value !== 0)
  if (own.length === 0) return undefined
  const parts = own.map((m) => componentLabel(c.t, m, false, (s) => localSource(c.lang, s)))
  return `${c.t('play.col.attack')}: ${[sv(std.attack.total), ...parts].join(' ')}`
}
const levelLabel = (t: Translate, level: string) => (isCantrip(level) ? t('play.cantrips') : `${t('play.level')} ${level}`)
// Nombre visible del conjuro (la clave interna sigue en inglés: sesión, testids, src/data/spells.ts)
const sn = (c: MenuCtx, name: string) => localSpell(c.lang, name)
const casterLevel = (c: MenuCtx) => c.sheet.spellcasting[0]?.casterLevel.total ?? 1

export function spellRangeText(c: MenuCtx, name: string): string {
  const def = spells[name]
  if (!def) return ''
  if (def.range === 'personal') return c.t('spell.personal')
  if (def.range === 'touch') return c.t('spell.touch')
  const ft = spellRangeFt(def.range, casterLevel(c))
  return ft === null ? '' : `${ft} ${c.t('sheet.ft')}`
}

export function spellDc(c: MenuCtx, level: string, name: string): number | null {
  return spells[name]?.save ? (c.sheet.spellcasting[0]?.dcs[Number(level)] ?? null) : null
}

// "1d6 electricidad", con el daño ya escalado por el nivel de lanzador.
export function spellDamage(c: MenuCtx, name: string): string {
  const d = spells[name]?.damage
  return d ? `${spellDamageText(d, casterLevel(c))} ${d.type[c.lang]}` : ''
}

// "Toque +3" / "Toque a distancia +1", según la variante (Spell Combat aplica su −2).
function touchText(c: MenuCtx, name: string, variant: string): string {
  const kind = spells[name]?.attack
  const touch = c.sheet.touch[variant] ?? c.sheet.touch.standard
  if (!kind || !touch) return ''
  return kind === 'melee-touch' ? `${c.t('play.touch')} ${sv(touch.melee.total)}` : `${c.t('play.rangedTouch')} ${sv(touch.ranged.total)}`
}

// Concentración para lanzar a la defensiva: con la opción ON ya está aplicada; si no, sale del condicional.
function defensiveConcentration(c: MenuCtx): number {
  const conc = c.sheet.spellcasting[0]?.concentration
  if (!conc) return 0
  if (c.session.castDefensively) return conc.total
  return conc.conditional.find((x) => x.condition.split('|').includes('casting-defensively'))?.total ?? conc.total
}

function concText(c: MenuCtx, level: string): string | undefined {
  if (!c.session.castDefensively) return undefined
  return `${c.t('play.concShort')} ${sv(defensiveConcentration(c))} vs ${c.t('sheet.dc')} ${defensiveCastingDc(Number(level))}`
}

function spellHead(c: MenuCtx, level: string, name: string): string {
  const dc = spellDc(c, level, name)
  return [levelLabel(c.t, level), dc === null ? '' : `${c.t('sheet.dc')} ${dc}`, spellRangeText(c, name)].filter(Boolean).join(' · ')
}

const spellEffect = (c: MenuCtx, name: string, variant: string) =>
  [spellDamage(c, name), touchText(c, name, variant)].filter(Boolean).join(' · ')
const spellSummary = (c: MenuCtx, name: string) => spells[name]?.summary[c.lang] ?? c.t('play.unknownSpell')

// Conjuros preparados de menor a mayor nivel, en el orden del spellbook.
function preparedSpells(c: MenuCtx): { level: string; name: string }[] {
  return Object.keys(c.session.prepared)
    .sort(byNumber)
    .flatMap((level) => {
      const book = c.character.spellbook[level] ?? []
      const prepared = Object.keys(c.session.prepared[level] ?? {})
      const ordered = [...book.filter((s) => prepared.includes(s)), ...prepared.filter((s) => !book.includes(s))]
      return ordered.filter((name) => timesPrepared(c.session, level, name) > 0).map((name) => ({ level, name }))
    })
}

// Detalle: la Conc de ese momento (OFF: "+5 → +9 al prenderlo") y lo que suma lanzar a la defensiva, con la fuente
// nombrada ("+4 (Lanzar conjuros en combate)"). Las CD van en cada conjuro (concText). Los totales salen de computeSheet.
const isDefensive = (condition: string | undefined) => Boolean(condition?.split('|').includes('casting-defensively'))

function defensiveItem(c: MenuCtx): MenuItem {
  const on = c.session.castDefensively
  const conc = c.sheet.spellcasting[0]?.concentration
  const cond = on ? undefined : conc?.conditional.find((x) => isDefensive(x.condition))
  const extra = cond ? cond.modifiers : (conc?.applied.filter((m) => isDefensive(m.condition)) ?? [])
  const sources = extra.map((m) => componentLabel(c.t, m, false, (s) => localSource(c.lang, s))).join(' ')
  const total = conc ? `${c.t('play.concShort')} ${sv(conc.total)}${cond ? ` → ${sv(cond.total)} ${c.t('play.whenOn')}` : ''}` : undefined
  return {
    id: 'cast-defensively',
    label: c.t('play.castDefensively'),
    badge: onOff(on),
    detail: { title: c.t('play.castDefensively'), line: total, note: [sources, c.t('play.defensiveNote')].filter(Boolean).join(' · ') },
    action: { type: 'toggle', on: !on, update: toggleDefensive },
  }
}

// Lista de conjuros para lanzar. Con `attack` es la de Spell Combat / Spellstrike (el detalle muestra el ataque;
// `kind` es el tipo de acción de esa acción de clase).
function castableItems(c: MenuCtx, attack?: { title: string; stats: DetailStat[]; variant: string; kind: ActionKind; weaponId: string }): MenuItem[] {
  const variant = attack?.variant ?? 'standard'
  let lastLevel = ''
  const items = preparedSpells(c).map(({ level, name }): MenuItem => {
    const section = level !== lastLevel ? levelLabel(c.t, level) : undefined
    lastLevel = level
    const effect = spellEffect(c, name, variant)
    const left = isCantrip(level) ? Infinity : castsLeft(c.session, level, name)
    const detail: MenuItem['detail'] = attack
      ? { title: attack.title, tag: actionTag(c.t, attack.kind), stats: attack.stats, line: `+ ${sn(c, name)} · ${effect || spellSummary(c, name)}`, note: concText(c, level) }
      : { title: sn(c, name), line: spellHead(c, level, name), note: effect || spellSummary(c, name), extra: concText(c, level) ?? (effect ? spellSummary(c, name) : undefined) }
    if (left <= 0) detail.note = c.t('play.noUsesLeft')
    const info = castInfoFor(spells[name], casterLevel(c))
    // Con Combate con conjuros, ¿Le pegaste? recibe también el arma, para mostrar el ataque que viene después
    const touchId = attack ? `touch:${variant}:${attack.weaponId}` : `touch:${variant}`
    const after: After = info.touchCharges ? { menu: touchId, label: c.t('play.didItHit') } : 'root'
    return {
      id: `spell-${level}-${name}`,
      label: sn(c, name),
      section,
      spell: { level, name },
      badge: isCantrip(level) ? { text: '∞', tone: 'muted' } : { text: diamonds(left, timesPrepared(c.session, level, name)), tone: 'mana' },
      detail,
      act: spellActionKind(spells[name], attack?.kind),
      action:
        left > 0
          ? isCantrip(level)
            ? { type: 'execute', fx: 'actionExecute', update: (s) => castSpell(s, level, name, info), after }
            : { type: 'execute', fx: 'resourceSpend', slash: true, update: (s) => castSpell(s, level, name, info), after }
          : { type: 'none' },
    }
  })
  return [defensiveItem(c), ...items]
}

// --- Menús ---

function root(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  const items: MenuItem[] = []
  const main = sheet.attacks[0]
  const std = main?.variants[0]
  items.push({
    id: 'attack',
    label: tr('play.root.attack'),
    detail: main && std ? { title: localName(c.lang, main.id, main.name), tag: tr('play.standardAction'), stats: weaponStats(tr, main, std) } : { title: tr('play.root.attack') },
    action: { type: 'open', menu: 'attack' },
  })
  const casting = sheet.spellcasting[0]
  if (casting) {
    const levels = casting.spellsPerDay.map((n, i) => (i === 0 ? `${tr('play.cantrips')} ${tr('play.atWill')}` : `${tr('play.level')} ${i}: ${n}${tr('sheet.perDay')}`))
    const left = casting.spellsPerDay.reduce((n, _, i) => (i === 0 ? n : n + slotsLeft(session, String(i))), 0)
    const total = casting.spellsPerDay.reduce((n, _, i) => (i === 0 ? n : n + preparedTotal(session.prepared, String(i))), 0)
    items.push({
      id: 'spells',
      label: tr('play.root.spells'),
      badge: total ? { text: diamonds(left, total), tone: 'mana' } : undefined,
      detail: { title: tr('sheet.spells'), line: levels.join(' · '), note: casting.dcs[1] ? `${tr('sheet.dc')} ${casting.dcs[1]} (${tr('play.level')} 1)` : undefined },
      action: { type: 'open', menu: 'spells' },
    })
  }
  for (const r of sheet.resources) {
    if (!sheet.actions.some((a) => a.menu === 'pool' && a.cost?.resource === r.id)) continue
    const left = resourceLeft(sheet, session, r.id)
    const maxEnh = r.details.maxEnhancement
    items.push({
      id: `pool-${r.id}`,
      label: localName(c.lang, r.id, r.name),
      badge: { text: `${left}/${r.max.total}`, tone: 'gold' },
      detail: { title: localName(c.lang, r.id, r.name), line: `${left}/${r.max.total}`, note: maxEnh ? `${tr('play.maxEnhancement')} +${maxEnh}` : undefined },
      action: { type: 'open', menu: `pool:${r.id}` },
    })
  }
  items.push({
    id: 'skills',
    label: tr('play.root.skills'),
    detail: { title: tr('play.root.skills'), line: tr('play.diceNote') },
    action: { type: 'open', menu: 'skills' },
  })
  items.push({
    id: 'items',
    label: tr('play.root.items'),
    detail: { title: tr('play.root.items'), line: `${c.character.equipment.items.length}` },
    action: { type: 'open', menu: 'items' },
  })
  items.push({ id: 'status', label: tr('play.root.status'), detail: statusDetail(c), action: { type: 'open', menu: 'status' } })
  return items
}

function statusDetail(c: MenuCtx): MenuItem['detail'] {
  const { sheet, session } = c
  return {
    title: c.t(`hpState.${hpState(sheet, session)}`),
    line: `${c.t('sheet.hp')} ${minus(String(currentHp(sheet, session)))}/${sheet.hp.total}`,
    note: session.conditions.length ? session.conditions.map((id) => localName(c.lang, id, capitalize(id))).join(', ') : c.t('play.noConditions'),
  }
}

function attack(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  const items: MenuItem[] = []
  const held = session.held
  if (held) {
    const touch = sheet.touch.standard
    items.push({
      id: 'discharge',
      label: `${tr('play.discharge')} (${sn(c, held.name)})`,
      badge: { text: touch ? sv(touch.melee.total) : '' },
      spell: { level: held.level, name: held.name },
      detail: { title: `${sn(c, held.name)}${held.charges > 1 ? ` ×${held.charges}` : ''}`, line: spellEffect(c, held.name, 'standard'), note: tr('play.dischargeNote') },
      // 'discharge': ¿Le pegaste? es la acción estándar (después de lanzar se llega con la variante, sin acción nueva)
      action: { type: 'open', menu: 'touch:discharge' },
      // el act de Descargar toque va en Le pegué / Erré (touchMenu), que es donde se hace
    })
  }
  for (const a of sheet.attacks) {
    const std = a.variants.find((v) => v.id === 'standard')
    if (!std) continue
    const suffix = sheet.attacks.length > 1 ? ` (${localName(c.lang, a.id, a.name)})` : ''
    const dmg = minus(std.damageText)
    items.push({
      id: `attack-${a.id}`,
      label: tr('play.attack') + suffix,
      badge: { text: sv(std.attack.total) },
      detail: { title: localName(c.lang, a.id, a.name), tag: actionTag(tr, BASIC_ACTIONS.attack), stats: weaponStats(tr, a, std) },
      act: BASIC_ACTIONS.attack,
      action: { type: 'execute', fx: 'actionExecute', after: 'root' },
    })
    items.push({
      id: `full-attack-${a.id}`,
      label: tr('play.fullAttack') + suffix,
      badge: { text: std.fullAttack.map(sv).join('/') },
      detail: { title: localName(c.lang, a.id, a.name), tag: actionTag(tr, BASIC_ACTIONS['full-attack']), stats: weaponStats(tr, a, std, std.fullAttack.map(sv).join('/')) },
      act: BASIC_ACTIONS['full-attack'],
      action: { type: 'execute', fx: 'actionExecute', after: 'root' },
    })
    for (const act of sheet.actions.filter((x) => x.menu === 'attack' && x.kind === 'spell-attack')) {
      const v = a.variants.find((x) => x.id === act.variant)
      if (!v) continue
      items.push({
        id: `${act.id}-${a.id}`,
        label: localName(c.lang, act.id, act.name) + suffix,
        badge: { text: `${sv(v.attack.total)} +◆` },
        detail: { title: `${localName(c.lang, act.id, act.name)} · ${localName(c.lang, a.id, a.name)}`, tag: actionTag(tr, act.actionType), stats: weaponStats(tr, a, v), line: actionNoteLabel(tr, act.id) || undefined, note: variantAttackNote(c, std, v) },
        act: act.actionType,
        action: { type: 'open', menu: `spell-attack:${act.id}:${a.id}` },
      })
    }
    const chargeAttack = std.attack.conditional.find((x) => x.condition === 'charge')
    const chargeAc = sheet.ac.normal.conditional.find((x) => x.condition === 'charge')
    if (chargeAttack && a.category !== 'ranged') {
      items.push({
        id: `charge-${a.id}`,
        label: tr('play.charge') + suffix,
        badge: { text: sv(chargeAttack.total) },
        detail: {
          title: tr('play.charge'),
          tag: actionTag(tr, BASIC_ACTIONS.charge),
          stats: [
            { id: 'attack', label: tr('play.col.attack'), value: sv(chargeAttack.total) },
            { id: 'damage', label: tr('play.col.damage'), value: dmg },
          ],
          note: `${tr('sheet.ac')} ${chargeAc?.total ?? sheet.ac.normal.total} ${tr('play.untilYourTurn')}`,
        },
        act: BASIC_ACTIONS.charge,
        action: { type: 'execute', fx: 'actionExecute', update: charge, after: 'root' },
      })
    }
  }
  items.push({
    id: 'maneuver',
    label: tr('play.maneuver'),
    badge: { text: `${tr('sheet.cmb')} ${sv(sheet.cmb.total)}` },
    detail: {
      title: tr('play.maneuver'),
      tag: actionTag(tr, BASIC_ACTIONS.maneuver),
      stats: [
        { id: 'cmb', label: tr('sheet.cmb'), value: sv(sheet.cmb.total) },
        { id: 'cmd', label: tr('sheet.cmd'), value: String(sheet.cmd.total) },
      ],
    },
    act: BASIC_ACTIONS.maneuver,
    action: { type: 'execute', fx: 'actionExecute', after: 'root' },
  })
  ;(Object.keys(STANCES) as StanceId[]).forEach((id, i) => {
    const on = session.stance === id
    items.push({
      id: `stance-${id}`,
      label: tr(`stance.${id}`),
      section: i === 0 ? tr('play.stance') : undefined,
      badge: onOff(on),
      detail: { title: tr(`stance.${id}`), line: tr(`stanceNote.${id}`), note: `${tr('sheet.ac')} ${sheet.ac.normal.total}` },
      action: { type: 'toggle', on: !on, update: (s) => toggleStance(s, id) },
    })
  })
  return items
}

function spellAttack(c: MenuCtx, actionId: string, weaponId: string): MenuItem[] {
  const act = c.sheet.actions.find((a) => a.id === actionId)
  const weapon = c.sheet.attacks.find((a) => a.id === weaponId)
  const v = weapon?.variants.find((x) => x.id === act?.variant)
  if (!act || !weapon || !v) return []
  return castableItems(c, { title: `${localName(c.lang, act.id, act.name)} · ${localName(c.lang, weapon.id, weapon.name)}`, stats: weaponStats(c.t, weapon, v), variant: v.id, kind: act.actionType, weaponId: weapon.id })
}

// ¿Pegó? (después de lanzar un conjuro de toque o de Descargar toque)
function touchMenu(c: MenuCtx, variant: string, weaponId: string): MenuItem[] {
  const held = c.session.held
  if (!held) return []
  const title = `${sn(c, held.name)} · ${touchText(c, held.name, variant)}`
  const line = spellDamage(c, held.name) || spellSummary(c, held.name)
  // Con Combate con conjuros, el ataque con el arma que sigue al toque (mismos números que weaponStats)
  const weapon = weaponId ? c.sheet.attacks.find((a) => a.id === weaponId) : undefined
  const wv = weapon?.variants.find((x) => x.id === variant)
  const extra = weapon && wv
    ? `${c.t('play.thenWeapon')}: ${localName(c.lang, weapon.id, weapon.name)} ${sv(wv.attack.total)} · ${minus(wv.damageText)} · ${prettyCrit(weapon.critical)}`
    : undefined
  // Descargar toque es una acción estándar (cuenta para el incapacitado, gate); después de lanzar, el conjuro ya contó
  // (por eso Le pegué / Erré no se bloquean aunque el −1 del incapacitado lo haya dejado moribundo: es el mismo lanzamiento).
  const act = variant === 'discharge' ? BASIC_ACTIONS.discharge : undefined
  return [
    {
      id: 'touch-hit',
      label: c.t('play.hit'),
      spell: { level: held.level, name: held.name },
      detail: { title, line, note: held.charges > 1 ? `${c.t('play.chargesLeft')}: ${held.charges - 1}` : undefined, extra },
      act,
      action: { type: 'execute', fx: 'actionExecute', update: touchHit, after: 'root' },
    },
    {
      id: 'touch-miss',
      label: c.t('play.miss'),
      spell: { level: held.level, name: held.name },
      detail: { title, line, note: c.t('play.missNote'), extra },
      act,
      action: { type: 'execute', fx: 'back', noAnim: true, after: 'root' },
    },
  ]
}

function spellsMenu(c: MenuCtx): MenuItem[] {
  return [
    ...castableItems(c),
    {
      id: 'prepare',
      label: c.t('play.prepare'),
      section: c.t('play.spellbook'),
      detail: { title: c.t('play.prepare'), line: c.t('play.prepareNote') },
      act: 'downtime',
      action: { type: 'open', menu: 'prepare' },
    },
  ]
}

function prepareMenu(c: MenuCtx): MenuItem[] {
  const { sheet, draft } = c
  return Object.keys(c.character.spellbook)
    .sort(byNumber)
    .filter((level) => slotsPerDay(sheet, level) > 0)
    .flatMap((level) =>
      (c.character.spellbook[level] ?? []).map((name, i): MenuItem => {
        const n = draft[level]?.[name] ?? 0
        const used = timesCast(c.session, level, name) // no se puede preparar menos (core: adjustPrepared / prepare)
        return {
          id: `prep-${level}-${name}`,
          label: sn(c, name),
          section: i === 0 ? `${levelLabel(c.t, level)}   ${preparedTotal(draft, level)}/${slotsPerDay(sheet, level)}` : undefined,
          spell: { level, name },
          badge: isCantrip(level) ? { text: n ? '✓' : '·', tone: n ? 'on' : 'muted' } : { text: `×${n}`, tone: n ? 'on' : 'muted' },
          detail: {
            title: sn(c, name),
            line: spellHead(c, level, name),
            note: spellEffect(c, name, 'standard') || spellSummary(c, name),
            extra: used ? `${c.t('play.castToday')} ×${used}: ${c.t('play.castFloor')}` : undefined,
          },
          action: { type: 'prepare' },
        }
      }),
    )
}

function poolMenu(c: MenuCtx, resource: string): MenuItem[] {
  const { sheet, session, t: tr } = c
  const r = sheet.resources.find((x) => x.id === resource)
  if (!r) return []
  const left = resourceLeft(sheet, session, resource)
  const items: MenuItem[] = []
  for (const act of sheet.actions.filter((a) => a.menu === 'pool' && a.cost?.resource === resource)) {
    const cost = act.cost?.amount ?? 0
    if (act.kind === 'enhance-weapon') {
      const bonus = r.details.maxEnhancement ?? 1
      for (const a of sheet.attacks) {
        const suffix = sheet.attacks.length > 1 ? ` (${localName(c.lang, a.id, a.name)})` : ''
        const on = session.enhancement?.weaponId === a.id
        const label = `${tr('play.enhance')} +${on ? session.enhancement?.bonus : bonus}${suffix}`
        items.push({
          id: `${act.id}-${a.id}`,
          label,
          badge: on ? { text: 'ON', tone: 'on' } : { text: `${cost} ⚡`, tone: 'gold' },
          detail: { title: label, line: tr('play.enhanceNote'), note: on ? tr('play.active') : left < cost ? tr('play.poolEmpty') : undefined },
          act: act.actionType,
          action:
            !on && !session.enhancement && left >= cost
              ? { type: 'execute', fx: 'resourceSpend', update: (s) => enhanceWeapon(sheet, s, resource, cost, a.id, bonus), after: 'root' }
              : { type: 'none' },
        })
      }
      if (session.enhancement) {
        items.push({
          id: 'end-enhancement',
          label: tr('play.endEnhance'),
          detail: { title: tr('play.endEnhance'), line: tr('play.enhanceNote') },
          action: { type: 'toggle', on: false, update: endEnhancement },
        })
      }
    } else if (act.kind === 'spell-recall') {
      items.push({ id: act.id, label: localName(c.lang, act.id, act.name), detail: { title: localName(c.lang, act.id, act.name), line: tr('play.recallNote') }, act: act.actionType, action: { type: 'open', menu: `recall:${resource}` } })
    } else if (act.kind === 'spend') {
      items.push({
        id: act.id,
        label: localName(c.lang, act.id, act.name),
        badge: { text: `${cost} ⚡`, tone: 'gold' },
        detail: { title: localName(c.lang, act.id, act.name), line: `${cost} ⚡`, note: left < cost ? tr('play.poolEmpty') : undefined },
        act: act.actionType,
        action: left >= cost ? { type: 'execute', fx: 'resourceSpend', update: (s) => spendResource(sheet, s, resource, cost), after: 'root' } : { type: 'none' },
      })
    }
  }
  return items
}

function recallMenu(c: MenuCtx, resource: string): MenuItem[] {
  const { sheet, session } = c
  const left = resourceLeft(sheet, session, resource)
  return Object.keys(session.cast)
    .sort(byNumber)
    .flatMap((level) =>
      Object.keys(session.cast[level] ?? {})
        .filter((name) => timesCast(session, level, name) > 0)
        .map((name): MenuItem => ({
          id: `recall-${level}-${name}`,
          label: sn(c, name),
          spell: { level, name },
          badge: { text: `${recallCost(level)} ⚡`, tone: 'gold' },
          detail: { title: sn(c, name), line: spellHead(c, level, name), note: left < recallCost(level) ? c.t('play.poolEmpty') : c.t('play.recallNote') },
          action:
            left >= recallCost(level)
              ? { type: 'execute', fx: 'resourceSpend', update: (s) => recallSpell(sheet, s, resource, level, name), after: 'root' }
              : { type: 'none' },
        })),
    )
}

function skills(c: MenuCtx): MenuItem[] {
  const { sheet, t: tr } = c
  const list = sheet.skills.filter((s) => (c.showAllSkills ? s.usable : s.ranks > 0))
  return [
    ...list.map((s): MenuItem => ({
      id: `skill-${s.id}`,
      label: localName(c.lang, s.id, s.name),
      badge: { text: sv(s.stat.total) },
      detail: { title: localName(c.lang, s.id, s.name), line: sv(s.stat.total), note: statParts(tr, s.stat, true, (src) => localSource(c.lang, src), SKILL_SEP) },
      action: { type: 'none' },
    })),
    {
      id: 'skills-toggle',
      label: c.showAllSkills ? tr('play.showTrained') : tr('play.showAll'),
      detail: { title: tr('play.root.skills'), line: tr('play.diceNote') },
      action: { type: 'skills-toggle' },
    },
  ]
}

function itemsMenu(c: MenuCtx): MenuItem[] {
  const { character, session, t: tr } = c
  return character.equipment.items.map((item): MenuItem => {
    const usable = item.consumable || item.quantity > 1
    const left = itemsLeft(character, session, item.id)
    return {
      id: `item-${item.id}`,
      label: localName(c.lang, item.id, item.name),
      badge: usable ? { text: `×${left}`, tone: left ? undefined : 'muted' } : undefined,
      detail: { title: localName(c.lang, item.id, item.name), line: localNote(c.lang, item.id, item.notes) ?? (item.slot ? slotLabel(tr, item.slot) : ''), note: usable ? (left ? tr('play.use') : tr('play.noneLeft')) : undefined },
      act: usable ? BASIC_ACTIONS['use-item'] : undefined,
      action: usable && left > 0 ? { type: 'execute', fx: 'resourceSpend', update: (s) => consumeItem(character, s, item.id), after: 'root' } : { type: 'none' },
    }
  })
}

// Nivel del conjuro según el spellbook (para la tarjeta de un buff activo).
const bookLevel = (c: MenuCtx, name: string) =>
  Object.keys(c.character.spellbook).find((l) => c.character.spellbook[l]?.includes(name)) ?? '1'

// Todo lo que está prendido y se puede apagar desde un solo lugar.
function activeEffects(c: MenuCtx): MenuItem[] {
  const { session, t: tr } = c
  const items: MenuItem[] = []
  for (const name of session.buffs) {
    items.push({ id: `buff-${name}`, label: sn(c, name), badge: onOff(true), spell: { level: bookLevel(c, name), name }, detail: { title: sn(c, name), line: spellSummary(c, name), note: tr('play.turnOff') }, action: { type: 'toggle', on: false, update: (s) => endBuff(s, name) } })
  }
  if (session.enhancement) {
    const label = `${tr('play.enhance')} +${session.enhancement.bonus}`
    items.push({ id: 'effect-enhancement', label, badge: onOff(true), detail: { title: label, line: tr('play.enhanceNote'), note: tr('play.turnOff') }, action: { type: 'toggle', on: false, update: endEnhancement } })
  }
  if (session.held) {
    const label = `${tr('play.held')}: ${sn(c, session.held.name)}${session.held.charges > 1 ? ` ×${session.held.charges}` : ''}`
    items.push({ id: 'effect-held', label, badge: onOff(true), detail: { title: label, line: tr('play.dischargeNote'), note: tr('play.dropHeld') }, action: { type: 'toggle', on: false, update: dropHeld } })
  }
  if (session.castDefensively) items.push(defensiveItem(c))
  if (session.charging) {
    const label = tr('play.charged')
    items.push({ id: 'effect-charge', label, badge: onOff(true), detail: { title: label, line: `${tr('sheet.ac')} ${c.sheet.ac.normal.total} ${tr('play.untilYourTurn')}`, note: tr('play.turnOff') }, action: { type: 'toggle', on: false, update: endCharge } })
  }
  if (session.stance && session.stance in STANCES) {
    const id = session.stance as StanceId
    items.push({ id: `effect-stance`, label: tr(`stance.${id}`), badge: onOff(true), detail: { title: tr(`stance.${id}`), line: tr(`stanceNote.${id}`), note: tr('play.turnOff') }, action: { type: 'toggle', on: false, update: (s) => toggleStance(s, id) } })
  }
  return items
}

const activeCount = (s: Session) =>
  s.buffs.length + (s.enhancement ? 1 : 0) + (s.held ? 1 : 0) + (s.castDefensively ? 1 : 0) + (s.stance ? 1 : 0) + (s.charging ? 1 : 0)

// Iniciar / Terminar combate: primera fila de ESTADO. El turno se avanza con MI TURNO ▸ en el HUD.
function combatItem(c: MenuCtx): MenuItem {
  const { sheet, session, t: tr } = c
  if (session.combat) {
    return {
      id: 'combat-end',
      label: tr('play.combatEnd'),
      detail: { title: tr('play.combatEnd'), line: session.combat.round ? `${tr('play.round')} ${session.combat.round}` : tr('play.combat'), note: tr('play.combatEndNote') },
      action: { type: 'execute', fx: 'back', update: endCombat, after: 'root' },
    }
  }
  const init = sv(sheet.initiative.total)
  return {
    id: 'combat-start',
    label: tr('play.combatStart'),
    badge: { text: `${tr('sheet.init')} ${init}` },
    detail: { title: tr('play.combatStart'), line: `${tr('play.rollInit')} ${init}`, note: tr('play.combatStartNote') },
    action: { type: 'execute', fx: 'start', update: startCombat, after: 'root' },
  }
}

function status(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  // Vista previa del descanso: el mismo rest() del core sobre la sesión actual
  const after = rest(sheet, session)
  const preview = [
    `${c.t('sheet.hp')} ${minus(String(currentHp(sheet, session)))}→${minus(String(currentHp(sheet, after)))}`,
    ...sheet.resources.map((r) => `⚡ ${resourceLeft(sheet, session, r.id)}→${resourceLeft(sheet, after, r.id)}`),
    ...(sheet.spellcasting[0]?.spellsPerDay ?? [])
      .map((_, i) => String(i))
      .filter((l) => !isCantrip(l) && preparedTotal(session.prepared, l) > 0)
      .map((l) => `◆ ${slotsLeft(session, l)}→${slotsLeft(after, l)}`),
  ].join(' · ')
  const active = activeCount(session)
  return [
    combatItem(c),
    { id: 'conditions', label: tr('play.conditions'), detail: statusDetail(c), action: { type: 'open', menu: 'conditions' } },
    {
      id: 'effects',
      label: tr('play.activeEffects'),
      badge: active ? { text: String(active), tone: 'on' } : undefined,
      detail: { title: tr('play.activeEffects'), line: active ? `${active}` : tr('play.empty') },
      action: { type: 'open', menu: 'effects' },
    },
    { id: 'rest', label: tr('play.rest'), hold: true, act: 'downtime', detail: { title: tr('play.rest'), line: preview, note: tr('play.holdToRest') }, action: { type: 'rest' } },
  ]
}

function conditions(c: MenuCtx): MenuItem[] {
  return (Object.keys(CONDITIONS) as ConditionId[]).map((id): MenuItem => {
    const on = c.session.conditions.includes(id)
    return {
      id: `condition-${id}`,
      label: localName(c.lang, id, capitalize(id)),
      badge: onOff(on),
      detail: { title: localName(c.lang, id, capitalize(id)), line: c.t(`conditionNote.${id}`) },
      action: { type: 'toggle', on: !on, update: (s) => toggleCondition(s, id) },
    }
  })
}

// Pantalla de muerte (PG ≤ −CON): reemplaza al menú. Las dos opciones se confirman manteniendo apretado.
function death(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  const hp = currentHp(sheet, session)
  const base = { title: `☠ ${sheet.name} ${tr('play.died')}`, line: `${tr('sheet.hp')} ${minus(String(hp))} (−${tr('ability.con')})` }
  const before = session.beforeDeath === null ? null : sheet.hp.total - session.beforeDeath
  return [
    {
      id: 'death-undo',
      label: tr('play.death.undo'),
      hold: before !== null,
      detail: { ...base, note: before === null ? tr('play.death.nothingToUndo') : `${tr('play.death.undoNote')} ${minus(String(before))}` },
      action: before === null ? { type: 'none' } : { type: 'commit', update: undoDeath },
    },
    {
      id: 'death-revive',
      label: tr('play.death.revive'),
      hold: true,
      detail: { ...base, note: tr('play.death.reviveNote') },
      action: { type: 'commit', update: (s) => revive(sheet, s) },
    },
  ]
}

export function buildMenu(id: string, c: MenuCtx): MenuItem[] {
  const [kind, a = '', b = ''] = id.split(':')
  let items: MenuItem[]
  switch (kind) {
    case 'root': items = root(c); break
    case 'attack': items = attack(c); break
    case 'spell-attack': items = spellAttack(c, a, b); break
    case 'touch': items = touchMenu(c, a, b); break
    case 'spells': items = spellsMenu(c); break
    case 'prepare': items = prepareMenu(c); break
    case 'pool': items = poolMenu(c, a); break
    case 'recall': items = recallMenu(c, a); break
    case 'skills': items = skills(c); break
    case 'items': items = itemsMenu(c); break
    case 'status': items = status(c); break
    case 'effects': items = activeEffects(c); break
    case 'conditions': items = conditions(c); break
    case 'death': items = death(c); break
    default: items = []
  }
  // Una lista vacía igual tiene una fila, para que el cursor y el detalle tengan algo que mostrar
  return items.length ? gate(items, c) : [{ id: 'empty', label: c.t('play.empty'), detail: { title: c.t('play.empty') }, action: { type: 'none' } }]
}

// PG bajos. La regla vive en core/session.ts (checkAction / applyAction); acá solo se apaga la fila y va el aviso:
//   moribundo    → se bloquea toda acción (act, incluidos Descansar y Preparar) y los menús que abren acciones;
//   incapacitado → se bloquea lo de ronda completa; lo estándar se puede, con el aviso, y al hacerlo resta 1 PG solo
//                  (pasa a moribundo). MI TURNO no resta: la tirada de estabilización del moribundo es manual.
// Quedan Habilidades (mirar), Estado (condiciones, efectos, combate) y los PG del HUD.
// Menús que abren listas de acciones: con moribundo se apagan enteros (es navegación: adentro todo estaría bloqueado).
const DYING_BLOCKED_MENUS = new Set(['attack', 'spells', 'items'])
const opensActions = (it: MenuItem) => DYING_BLOCKED_MENUS.has(it.id) || it.id.startsWith('pool-')

function gate(items: MenuItem[], c: MenuCtx): MenuItem[] {
  const dying = !checkAction(c.sheet, c.session, 'downtime').allowed
  const block = (it: MenuItem, warn: string): MenuItem => ({ ...it, blocked: true, hold: false, detail: { ...it.detail, warn }, action: { type: 'none' } })
  return items.map((it) => {
    const kind = it.act
    if (!kind) return dying && opensActions(it) ? block(it, c.t('play.dyingBlock')) : it
    const check = checkAction(c.sheet, c.session, kind)
    if (!check.allowed) return block(it, c.t(check.reason === 'dying' ? 'play.dyingBlock' : 'play.disabledFull'))
    if (!check.hpCost) return it
    const a = it.action
    // applyAction: primero la acción y después el −1 (sin efecto extra: suena el de la acción, Regla A).
    // Las `open` no se envuelven: el −1 va en lo que se haga adentro (también tiene act).
    const action: ItemAction = a.type === 'execute' ? { ...a, update: (s) => applyAction(c.sheet, s, kind, a.update) } : a
    return { ...it, detail: { ...it.detail, warn: c.t('play.disabledStd') }, action }
  })
}
