import type { AttackLine, AttackVariant, ComputedSheet } from '../../core/compute'
import type { Stat } from '../../core/modifiers'
import type { Character, ModifierInput } from '../../core/schema'
import type { MessageKey } from '../../i18n/es'
import {
  BASIC_ACTIONS, BASIC_AOO, COMMON_EFFECTS, CONDITIONS, STANCES,
  type ActionKind, type CommonEffectId, type ConditionId, type FreeField, type StanceId,
} from '../../core/rules/pf1e/actions'
import {
  castingDcBase, concentrationCase, defensiveCastingDc, entangledCastingDc, spellAoO, spellDamageText, spellRangeFt,
  type SpellAoO,
} from '../../core/rules/pf1e/spells'
import {
  applyAction, castInfoFor, castSpell, castsLeft, charge, checkAction, applyItem, currentHp, dropHeld, endBuff, endCharge, endEnhancement,
  enhanceWeapon, hpState, isCantrip, itemsLeft, preparedTotal, recallCost, recallSpell, resourceLeft, rest, slotsLeft, slotsPerDay, spellActionKind,
  setSpellCombatTrade, spendResource, timesCast, timesPrepared, toggleCondition, toggleDefensive, togglePowerAttack, toggleSpellstrike, toggleStance, touchHit, undoDeath, revive, type Session,
  chargeBlock, chargeDistance, chargeKind, currentSpeed, emptyFreeDraft, removeExternal, toggleCommonEffect,
  proneAc,
  turnUrgent,
  type FreeDraft, type SpellCounts,
} from '../../core/session'
import { spells } from '../../data/spells'
import { localBuff, localName, localNote, localSource, localSpell } from '../../data/names'
import { items as itemDefs } from '../../data/items'
import { abilityDamageMenu, activeValueRows, addValueRows, valueMenu } from './valueMenus'
import type { FxEvent } from './fx/effects'
import type { ValueKind } from '../../core/session'
import type { Notebook } from '../../core/notebook'
import type { FormSpec } from './FormCard'
import { bookMenu, type Book } from './notebookMenus'
import { levelUpMenu, levelUpRow } from './levelUpMenus'
import { actionNoteLabel, componentLabel, formatValue, minus, prettyCrit, SKILL_SEP, slotLabel, statParts, statRows, type StatRow, type Translate } from '../sheet/labels'

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
  | { type: 'toggle'; update: Update; on: boolean; after?: 'root' } // ON/OFF: no navega (salvo after: 'root')
  | { type: 'rest' } // se confirma manteniendo apretado (hold)
  | { type: 'commit'; update: Update } // pantalla de muerte (hold): aplica el cambio sin efecto y vuelve al menú principal
  | { type: 'prepare' } // fila de Preparar: se cambia con − / +
  | { type: 'skills-toggle' }
  | { type: 'book'; update: (nb: Notebook) => Notebook; on: boolean; back?: boolean } // cambia la libreta; back: vuelve un nivel
  | { type: 'form'; form: FormSpec; copy?: string } // abre un formulario; copy: lo copia al portapapeles
  | { type: 'none' }

// Columna del panel de detalle: rótulo chico arriba, valor abajo. `id` va al testid.
export interface DetailStat {
  id: string
  label: string
  value: string
}

// Un renglón de las tiradas: el número que tirás (grande, en columna) y qué es. Sin número, es un renglón de apoyo.
export interface DetailStep {
  roll?: string
  text: string
}
export interface DetailSteps {
  title?: string
  lines: DetailStep[]
}

export interface MenuItem {
  id: string
  label: string
  section?: string // encabezado que va antes de este ítem
  badge?: { text: string; tone?: 'mana' | 'gold' | 'muted' | 'on' }
  hint?: string // texto apagado antes del badge (el atributo de una habilidad: "INT")
  // warn: aviso que va primero en la descripción (moribundo / incapacitado, ver gate())
  // parts: el desglose en filas, solo para la tarjeta (en la franja se ve como `note`)
  // steps: las tiradas en grupos (título + renglones); la franja crece solo cuando las hay
  detail: { title: string; tag?: string; stats?: DetailStat[]; line?: string; note?: string; extra?: string; warn?: string; parts?: StatRow[]; steps?: DetailSteps[] }
  spell?: { level: string; name: string } // si está, tocar el detalle abre la tarjeta
  hold?: boolean // se confirma manteniendo apretado (CONFIRMAR o la fila)
  act?: ActionKind // tipo de acción en el turno (gate() → core: checkAction / applyAction)
  heals?: boolean // cura (poción): a 0 PG no cuesta el PG y, al usarla, se abre el editor de PG para sumar la cura
  offensive?: boolean // ataca o lanza sobre alguien: corta lo que termina al atacar (core: afterAction)
  blocked?: boolean // bloqueada por los PG (gate): la fila se ve apagada y CONFIRMAR no hace nada
  // Qué hace la fila, para señalizarla (lo pone buildMenu): 'submenu' lleva › a la derecha; 'info' es solo para leer
  // (se ve apagada y el 2do toque abre la tarjeta del detalle).
  nav?: 'submenu' | 'info'
  field?: string // editor del modificador Libre: qué valor cambian − / +
  action: ItemAction
}

export interface MenuCtx {
  t: Translate
  sheet: ComputedSheet
  session: Session
  character: Character
  draft: SpellCounts // borrador de Preparar
  showAllSkills: boolean
  free?: FreeDraft // borrador del modificador Libre
  book?: Book // la libreta (solo en #/play)
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
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const actionTag = (t: Translate, kind: ActionKind) => t(kind === 'full' ? 'play.fullRoundShort' : 'play.standardAction')
// Qué pasa, en castellano llano: "Acción estándar, provoca".
const aooTag = (t: Translate, kind: ActionKind, aoo = 0) => (aoo > 0 ? `${actionTag(t, kind)}, ${t('play.provokes')}` : actionTag(t, kind))
// En los conjuros, por qué provoca: "lanzar provoca", "el toque a distancia provoca", los dos o "no provoca".
const spellAoOText = (t: Translate, aoo: SpellAoO) =>
  t(aoo.cast && aoo.attack ? 'play.aooBoth' : aoo.cast ? 'play.aooCast' : aoo.attack ? 'play.aooAttack' : 'play.noProvoke')
const spellAoOTag = (t: Translate, kind: ActionKind, aoo: SpellAoO) => `${actionTag(t, kind)}, ${spellAoOText(t, aoo)}`

// Las tiradas del arma: un renglón por ataque (el número a tirar → el daño) y el crítico debajo.
function weaponSteps(t: Translate, a: AttackLine, v: AttackVariant, rolls: number[] = [v.attack.total]): DetailStep[] {
  const damage = minus(v.damageText)
  return [
    ...rolls.map((r, i): DetailStep => ({
      roll: sv(r),
      text: rolls.length > 1 ? fill(t('play.step.nth'), { n: String(i + 1), damage }) : fill(t('play.step.hit'), { damage }),
    })),
    { text: fill(t('play.step.crit'), { crit: prettyCrit(a.critical) }) },
  ]
}
const levelLabel = (t: Translate, level: string) => (isCantrip(level) ? t('play.cantrips') : `${t('play.level')} ${level}`)
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
  return d ? `${spellDamageText(d, casterLevel(c))} ${d.type}` : ''
}

// "Toque +3" / "Toque a distancia +1", según la variante (Spell Combat aplica su −2).
function touchText(c: MenuCtx, name: string, variant: string): string {
  const kind = spells[name]?.attack
  const touch = c.sheet.touch[variant] ?? c.sheet.touch.standard
  if (!kind || !touch) return ''
  return kind === 'melee-touch' ? `${c.t('play.touch')} ${sv(touch.melee.total)}` : `${c.t('play.rangedTouch')} ${sv(touch.ranged.total)}`
}

// Concentración de cada conjuro, con la CD del caso (core: concentrationCase). El total ya trae lo que suman la
// defensiva o el apresado (Combat Casting): sale de computeSheet con la sesión.
// Con una variante (Combate con conjuros), la de esa variante si tiene ataque cambiado por concentración.
const concFor = (c: MenuCtx, variant?: string) => {
  const sc = c.sheet.spellcasting[0]
  return (variant ? sc?.concentrationBy[variant] : undefined) ?? sc?.concentration
}
function concStep(c: MenuCtx, level: string, variant?: string): DetailStep | null {
  const conc = concFor(c, variant)
  if (!conc) return null
  const tr = c.t
  const l = Number(level)
  const roll = sv(conc.total)
  switch (concentrationCase(c.session.conditions, c.session.castDefensively)) {
    case 'damage': return { roll, text: fill(tr('play.step.ifDamaged'), { dc: String(castingDcBase(l)) }) }
    case 'defensive': return { roll, text: fill(tr('play.step.conc'), { dc: String(defensiveCastingDc(l)) }) }
    case 'entangled': return { roll, text: fill(tr('play.step.conc'), { dc: `${entangledCastingDc(l)} (${tr('play.concEntangled')})` }) }
    case 'grappled': return { roll, text: fill(tr('play.step.conc'), { dc: `${castingDcBase(l)} + ${tr('sheet.cmb')} (${tr('play.concGrappled')})` }) }
  }
}

// El toque del conjuro (Combate con conjuros aplica su −2): el número a tirar → el daño o lo que hace.
function touchStep(c: MenuCtx, name: string, variant: string): DetailStep | null {
  const kind = spells[name]?.attack
  const touch = c.sheet.touch[variant] ?? c.sheet.touch.standard
  if (!kind || !touch) return null
  const melee = kind === 'melee-touch'
  return {
    roll: sv(melee ? touch.melee.total : touch.ranged.total),
    text: fill(c.t('play.step.touch'), { touch: c.t(melee ? 'play.touch' : 'play.rangedTouch'), effect: spellDamage(c, name) || spellSummary(c, name) }),
  }
}

// Las tiradas de un conjuro: la concentración, el toque (o el daño) y la salvación del rival. Sin `withTouch`, el
// toque no va (lo reemplaza el ataque del arma de Impacto con conjuro).
function spellSteps(c: MenuCtx, level: string, name: string, variant: string, withTouch = true): DetailStep[] {
  const def = spells[name]
  const lines: DetailStep[] = []
  const conc = concStep(c, level, variant)
  if (conc) lines.push(conc)
  const touch = withTouch ? touchStep(c, name, variant) : null
  const damage = spellDamage(c, name)
  if (touch) lines.push(touch)
  else if (damage && withTouch) lines.push({ text: fill(c.t('play.step.damage'), { damage }) })
  if (def?.save) lines.push({ text: fill(c.t('play.step.save'), { save: def.save, dc: String(spellDc(c, level, name) ?? '—') }) })
  return lines
}

function spellHead(c: MenuCtx, level: string, name: string): string {
  const dc = spellDc(c, level, name)
  return [levelLabel(c.t, level), dc === null ? '' : `${c.t('sheet.dc')} ${dc}`, spellRangeText(c, name)].filter(Boolean).join(', ')
}

const spellEffect = (c: MenuCtx, name: string, variant: string) =>
  [spellDamage(c, name), touchText(c, name, variant)].filter(Boolean).join(', ')
const spellSummary = (c: MenuCtx, name: string) => spells[name]?.summary ?? c.t('play.unknownSpell')

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

// Detalle: la Conc de ese momento (OFF +5, ON +9; no anticipa el valor de prenderlo). Con ON, además, lo que suma
// lanzar a la defensiva, con la fuente nombrada ("+4 (Lanzar conjuros en combate)"). Las CD van en cada conjuro
// (concStep). Los totales salen de computeSheet.
const isDefensive = (condition: string | undefined) => Boolean(condition?.split('|').includes('casting-defensively'))

function defensiveItem(c: MenuCtx): MenuItem {
  const on = c.session.castDefensively
  const conc = c.sheet.spellcasting[0]?.concentration
  const extra = on ? (conc?.applied.filter((m) => isDefensive(m.condition)) ?? []) : []
  const sources = extra.map((m) => componentLabel(c.t, m, false, (s) => localSource(s))).join(' ')
  const total = conc ? `${c.t('play.concShort')} ${sv(conc.total)}` : undefined
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
type SpellAttack = { weapon: string; variant: string; kind: ActionKind; weaponId: string }

// Ataca, daña o pide salvación: va arriba en Combate con conjuros
const attacksWith = (name: string) => {
  const def = spells[name]
  return Boolean(def?.attack || def?.damage || def?.save)
}

// Qué pasa al lanzar: "Acción estándar, gasta 1 ◆, lanzar provoca".
function castNote(c: MenuCtx, level: string, name: string, kind: ActionKind): string {
  const cost = c.t(isCantrip(level) ? 'play.cantripFree' : 'play.spendsSlot')
  return `${actionTag(c.t, kind)}, ${cost}, ${spellAoOText(c.t, spellAoO(spells[name]?.attack, c.session.castDefensively))}`
}

// --- Impacto con conjuro (Spellstrike) ---
// Un switch en las listas de conjuros (queda hasta apagarlo). Prendido, un conjuro de toque cuerpo a cuerpo se entrega
// con un ataque gratis del arma, con su mayor ataque base (en Combate con conjuros, con su −2): daño del arma + el
// conjuro. El crítico usa el rango del arma, pero el conjuro solo hace ×2.
const hasSpellstrike = (c: MenuCtx) => c.sheet.actions.some((a) => a.kind === 'spell-weapon')
const spellstrikeFits = (c: MenuCtx, name: string) =>
  c.session.spellstrike && hasSpellstrike(c) && spells[name]?.range === 'touch' && spells[name]?.attack === 'melee-touch'
// El arma de Impacto: la primera cuerpo a cuerpo, con la variante pedida (o la estándar)
function strikeWeapon(c: MenuCtx, variant: string): { a: AttackLine; v: AttackVariant } | null {
  const a = c.sheet.attacks.find((x) => x.category !== 'ranged')
  const v = a?.variants.find((x) => x.id === variant) ?? a?.variants.find((x) => x.id === 'standard')
  return a && v ? { a, v } : null
}
function strikeGroup(c: MenuCtx, name: string, variant: string): DetailSteps | null {
  const w = strikeWeapon(c, variant)
  if (!w) return null
  const [range = '', mult = ''] = prettyCrit(w.a.critical).split('/')
  const weapon = localName(w.a.id, w.a.name)
  return {
    title: fill(c.t('play.stepsStrike'), { weapon }),
    lines: [
      { roll: sv(w.v.attack.total), text: fill(c.t('play.step.strike'), { weapon: minus(w.v.damageText), spell: spellDamage(c, name) || spellSummary(c, name) }) },
      { text: fill(c.t('play.step.strikeCrit'), { range, mult }) },
    ],
  }
}
function spellstrikeItem(c: MenuCtx): MenuItem[] {
  if (!hasSpellstrike(c)) return []
  const on = c.session.spellstrike
  return [{
    id: 'spellstrike',
    label: c.t('play.spellstrike'),
    badge: onOff(on),
    detail: { title: c.t('play.spellstrike'), line: c.t('play.spellstrikeNote'), note: c.t('play.spellstrikeFits') },
    action: { type: 'toggle', on: !on, update: toggleSpellstrike },
  }]
}

// Combate con conjuros, al elegir el conjuro: su nombre de título y las tiradas en grupos: el conjuro y el arma,
// porque el conjuro va antes o después de los ataques; con Impacto, además, el ataque gratis del arma con el conjuro.
// Los números salen de computeSheet.
function spellCombatDetail(c: MenuCtx, level: string, name: string, attack: SpellAttack, kind: ActionKind): MenuItem['detail'] {
  const tr = c.t
  const a = c.sheet.attacks.find((x) => x.id === attack.weaponId)
  const v = a?.variants.find((x) => x.id === attack.variant)
  const cost = tr(isCantrip(level) ? 'play.cantripFree' : 'play.spendsSlot')
  const provokes = spellAoOText(tr, spellAoO(spells[name]?.attack, c.session.castDefensively))
  const strike = spellstrikeFits(c, name) ? strikeGroup(c, name, attack.variant) : null
  const groups: DetailSteps[] = [
    { title: tr('play.stepsSpell'), lines: spellSteps(c, level, name, attack.variant, !strike) },
    ...(strike ? [strike] : []),
    ...(a && v ? [{ title: attack.weapon, lines: weaponSteps(tr, a, v) }] : []),
  ]
  return {
    title: localSpell(name),
    line: fill(tr('play.withWeapon'), { weapon: attack.weapon, kind: lower(actionTag(tr, kind)) }),
    note: capitalize(`${cost}, ${provokes}`),
    steps: groups.filter((g) => g.lines.length),
    warn: c.session.conditions.includes('prone') ? `⚠ ${tr('play.step.prone')}` : undefined,
  }
}

// Un conjuro suelto (Pelea › Conjuros): nivel, CD y alcance; qué pasa al lanzarlo; qué hace; y las tiradas.
function spellDetail(c: MenuCtx, level: string, name: string, kind: ActionKind): MenuItem['detail'] {
  const strike = spellstrikeFits(c, name) ? strikeGroup(c, name, 'standard') : null
  const steps = spellSteps(c, level, name, 'standard', !strike)
  const groups: DetailSteps[] = [...(steps.length ? [{ lines: steps }] : []), ...(strike ? [strike] : [])]
  return {
    title: localSpell(name),
    line: spellHead(c, level, name),
    note: castNote(c, level, name, kind),
    extra: spellSummary(c, name),
    steps: groups.length ? groups : undefined,
  }
}

function castableItems(c: MenuCtx, attack?: SpellAttack): MenuItem[] {
  const variant = attack?.variant ?? 'standard'
  // En Combate con conjuros, los que atacan van primero; si no, por nivel
  const list = preparedSpells(c)
  const ordered = attack ? [...list.filter((s) => attacksWith(s.name)), ...list.filter((s) => !attacksWith(s.name))] : list
  let lastGroup = ''
  const items = ordered.map(({ level, name }): MenuItem => {
    const group = attack ? c.t(attacksWith(name) ? 'play.spellsOffensive' : 'play.spellsOther') : levelLabel(c.t, level)
    const section = group !== lastGroup ? group : undefined
    lastGroup = group
    const left = isCantrip(level) ? Infinity : castsLeft(c.session, level, name)
    const kind = spellActionKind(spells[name], attack?.kind)
    const detail: MenuItem['detail'] = attack ? spellCombatDetail(c, level, name, attack, kind) : spellDetail(c, level, name, kind)
    if (left <= 0) detail.note = c.t('play.noUsesLeft')
    const info = castInfoFor(spells[name], casterLevel(c))
    // Ofensivo: con el arma (Combate con conjuros) o un conjuro con ataque, daño o salvación (supuesto: va sobre alguien)
    const def = spells[name]
    const offensive = Boolean(attack || def?.attack || def?.damage || def?.save)
    // Con Combate con conjuros, ¿Le pegaste? recibe también el arma, para mostrar el ataque que viene después
    const touchId = attack ? `touch:${variant}:${attack.weaponId}` : `touch:${variant}`
    const after: After = info.touchCharges ? { menu: touchId, label: c.t('play.didItHit') } : 'root'
    return {
      id: `spell-${level}-${name}`,
      label: localSpell(name),
      section,
      spell: { level, name },
      badge: isCantrip(level) ? { text: '∞', tone: 'muted' } : { text: diamonds(left, timesPrepared(c.session, level, name)), tone: 'mana' },
      detail,
      act: kind,
      offensive,
      action:
        left > 0
          ? isCantrip(level)
            ? { type: 'execute', fx: 'actionExecute', update: (s) => castSpell(s, level, name, info), after }
            : { type: 'execute', fx: 'resourceSpend', slash: true, update: (s) => castSpell(s, level, name, info), after }
          : { type: 'none' },
    }
  })
  // A la defensiva, en una variante que lo permite (Combate con conjuros): la fila para cambiar ataque por concentración
  const trade = attack && c.session.castDefensively && c.sheet.defensiveTrade?.variants.includes(variant)
  return [defensiveItem(c), ...spellstrikeItem(c), ...(trade && attack ? [tradeItem(c, variant, attack.weaponId)] : []), ...items]
}

// --- Ataque por Conc (Combate con conjuros a la defensiva) ---
// El valor vive en la sesión. Cada toque de la fila resta 1 punto más al ataque (y lo suma a la Conc); después del
// tope vuelve a 0. Los números salen siempre de computeSheet.
function tradeItem(c: MenuCtx, variant: string, weaponId: string): MenuItem {
  const trade = c.sheet.defensiveTrade
  const value = trade?.value ?? 0
  const max = trade?.max ?? 0
  const next = value >= max ? 0 : value + 1
  const attack = c.sheet.attacks.find((a) => a.id === weaponId)?.variants.find((v) => v.id === variant)?.attack.total
  const conc = concFor(c, variant)?.total
  const sc = c.sheet.spellcasting[0]
  return {
    id: 'spell-combat-trade',
    label: c.t('play.trade'),
    badge: { text: value ? sv(-value) : '0', tone: value ? 'on' : 'muted' },
    detail: {
      title: c.t('play.trade'),
      // "Ataque −1 · Conc +11" (los de ese momento)
      line: [attack === undefined ? '' : `${c.t('play.col.attack')} ${sv(attack)}`, conc === undefined ? '' : `${c.t('play.concShort')} ${sv(conc)}`].filter(Boolean).join(' · '),
      note: fill(c.t('play.tradeTap'), { max: sv(-max), ability: sc ? c.t(`ability.${sc.ability}`) : '' }),
      extra: c.t('play.tradeNote'),
    },
    action: { type: 'toggle', on: next > 0, update: (s) => setSpellCombatTrade(c.sheet, s, next) },
  }
}

// --- Menús ---

// Menú principal: Combate con conjuros, Ataques, Conjuros, Reserva arcana, Objetos y Estado. Iniciar y terminar el
// combate están en el botón del HUD.
function root(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  const items: MenuItem[] = spellCombatRows(c)
  const main = sheet.attacks[0]
  const std = main?.variants[0]
  items.push({
    id: 'attack',
    label: tr('play.root.attack'),
    detail: main && std ? { title: localName(main.id, main.name), tag: tr('play.standardAction'), stats: weaponStats(tr, main, std) } : { title: tr('play.root.attack') },
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
    const poolActions = sheet.actions.filter((a) => a.menu === 'pool' && a.cost?.resource === r.id)
    if (!poolActions.length) continue
    const left = resourceLeft(sheet, session, r.id)
    const maxEnh = r.details.maxEnhancement
    items.push({
      id: `pool-${r.id}`,
      label: localName(r.id, r.name),
      badge: { text: `${left}/${r.max.total}`, tone: 'gold' },
      detail: { title: localName(r.id, r.name), line: poolActions.map((a) => localName(a.id, a.name)).join(' · '), note: maxEnh ? `${tr('play.maxEnhancement')} +${maxEnh}` : undefined },
      action: { type: 'open', menu: `pool:${r.id}` },
    })
  }
  items.push(itemsRow(c))
  // Estado: todo lo que tenés encima (condiciones y efectos), para quitarlo o agregar algo
  const active = activeCount(session) + session.conditions.length
  items.push({
    id: 'state',
    label: tr('play.state'),
    badge: active ? { text: String(active), tone: 'on' } : undefined,
    detail: statusDetail(c),
    action: { type: 'open', menu: 'state' },
  })
  return items
}

// Pestaña PERSONAJE: lo que no es pelear, por cuánto se usa. (▲ Subir de nivel), Habilidades, Libreta, Descansar,
// Preparar conjuros y Defensa.
function character(c: MenuCtx): MenuItem[] {
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
  return [
    ...levelUpRow(c),
    { id: 'skills', label: tr('play.root.skills'), detail: { title: tr('play.root.skills'), line: fill(tr('play.skillsRanked'), { n: String(sheet.skills.filter((s) => s.ranks > 0).length) }), note: tr('play.skillsNote') }, action: { type: 'open', menu: 'skills' } },
    ...(c.book
      ? [{ id: 'notebook', label: tr('play.notebook'), detail: { title: tr('play.notebook'), line: tr('play.notebookNote') }, action: { type: 'open', menu: 'notebook' } } satisfies MenuItem]
      : []),
    { id: 'rest', label: tr('play.rest'), hold: true, act: 'downtime', detail: { title: tr('play.rest'), line: preview, note: tr('play.holdToRest') }, action: { type: 'rest' } },
    ...(sheet.spellcasting[0]
      ? [{ id: 'prepare', label: tr('play.prepare'), detail: { title: tr('play.prepare'), line: tr('play.prepareNote') }, act: 'downtime', action: { type: 'open', menu: 'prepare' } } satisfies MenuItem]
      : []),
    {
      id: 'defense',
      label: tr('play.defense'),
      detail: { title: tr('play.defense'), line: `${tr('sheet.ac')} ${sheet.ac.normal.total} · ${tr('sheet.touch')} ${sheet.ac.touch.total} · ${tr('sheet.flatFooted')} ${sheet.ac.flatFooted.total}`, note: `${tr('sheet.cmd')} ${sheet.cmd.total} · ${tr('sheet.fort')} ${sv(sheet.saves.fort.total)} · ${tr('sheet.ref')} ${sv(sheet.saves.ref.total)} · ${tr('sheet.will')} ${sv(sheet.saves.will.total)}` },
      action: { type: 'open', menu: 'defense' },
    },
  ]
}

// Defensa: los valores en vivo (con buffs, postura y condiciones), uno por fila, para leer. El desglose va en el detalle.
// Filas del desglose para la tarjeta: sin filas (o sin stat), no se mandan
const partsOf = (rows: StatRow[] | null | undefined) => (rows && rows.length ? rows : undefined)

function defense(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  const named = (src: string) => localSource(src)
  const row = (id: string, label: string, stat: Stat | null, value: string, note?: string): MenuItem => ({
    id: `defense-${id}`,
    label,
    badge: { text: value },
    detail: { title: label, line: value, note: note ?? ((stat && statParts(tr, stat, false, named)) || undefined), parts: partsOf(stat && statRows(tr, stat, false, named)) },
    action: { type: 'none' },
  })
  const ac = sheet.ac.normal.total
  const items: MenuItem[] = [row('ac', tr('sheet.ac'), sheet.ac.normal, String(ac))]
  // Tumbado: la CA cambia según quién ataca (core: proneAc)
  const prone = proneAc(sheet, session)
  if (prone) {
    const why = (n: number) => `${ac} ${sv(n - ac)} (${localName('prone', 'Prone')})`
    items.push(row('ac-melee', tr('play.acMelee'), null, String(prone.melee), why(prone.melee)))
    items.push(row('ac-ranged', tr('play.acRanged'), null, String(prone.ranged), why(prone.ranged)))
  }
  items.push(
    row('touch', tr('sheet.touch'), sheet.ac.touch, String(sheet.ac.touch.total)),
    row('flat', tr('sheet.flatFooted'), sheet.ac.flatFooted, String(sheet.ac.flatFooted.total)),
    row('cmd', tr('sheet.cmd'), sheet.cmd, String(sheet.cmd.total)),
    row('fort', tr('play.save.fort'), sheet.saves.fort, sv(sheet.saves.fort.total)),
    row('ref', tr('play.save.ref'), sheet.saves.ref, sv(sheet.saves.ref.total)),
    row('will', tr('play.save.will'), sheet.saves.will, sv(sheet.saves.will.total)),
  )
  return items
}

// Objetos en el menú principal: el badge cuenta los usos que quedan de los consumibles (pociones).
function itemsRow(c: MenuCtx): MenuItem {
  const { character, session, t: tr } = c
  const consumables = character.equipment.items.filter((i) => i.consumable)
  const left = consumables.reduce((n, i) => n + itemsLeft(character, session, i.id), 0)
  const line = consumables.map((i) => `${localName(i.id, i.name)} ×${itemsLeft(character, session, i.id)}`).join(' · ')
  return {
    id: 'items',
    label: tr('play.root.items'),
    badge: consumables.length ? { text: `×${left}`, tone: left ? undefined : 'muted' } : undefined,
    detail: { title: tr('play.root.items'), line: line || `${character.equipment.items.length}` },
    action: { type: 'open', menu: 'items' },
  }
}

function statusDetail(c: MenuCtx): MenuItem['detail'] {
  const { sheet, session } = c
  return {
    title: c.t(`hpState.${hpState(sheet, session)}`),
    line: `${c.t('sheet.hp')} ${minus(String(currentHp(sheet, session)))}/${sheet.hp.total} · ${c.t('sheet.speed')} ${currentSpeed(sheet, session)} ${c.t('sheet.ft')}`,
    note: session.conditions.length ? session.conditions.map((id) => localName(id, capitalize(id))).join(', ') : c.t('play.noConditions'),
  }
}

function attack(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  const items: MenuItem[] = []
  const held = session.held
  if (held) {
    const touch = sheet.touch.standard
    // Con Impacto con conjuro, la carga se descarga con un ataque del arma
    const strike = spellstrikeFits(c, held.name) ? strikeGroup(c, held.name, 'standard') : null
    const strikeRoll = strike ? strikeWeapon(c, 'standard')?.v.attack.total : undefined
    items.push({
      id: 'discharge',
      label: `${tr('play.discharge')} (${localSpell(held.name)})`,
      badge: { text: strikeRoll !== undefined ? sv(strikeRoll) : touch ? sv(touch.melee.total) : '' },
      spell: { level: held.level, name: held.name },
      detail: {
        title: `${localSpell(held.name)}${held.charges > 1 ? ` ×${held.charges}` : ''}`,
        line: aooTag(tr, BASIC_ACTIONS.discharge),
        note: tr('play.dischargeNote'),
        steps: strike ? [strike] : [{ lines: [touchStep(c, held.name, 'standard')].filter((x): x is DetailStep => Boolean(x)) }],
      },
      // 'discharge': ¿Le pegaste? es la acción estándar (después de lanzar se llega con la variante, sin acción nueva)
      action: { type: 'open', menu: 'touch:discharge' },
      // el act de Descargar toque va en Le pegué / Erré (touchMenu), que es donde se hace
    })
  }
  for (const a of sheet.attacks) {
    const std = a.variants.find((v) => v.id === 'standard')
    if (!std) continue
    const suffix = sheet.attacks.length > 1 ? ` (${localName(a.id, a.name)})` : ''
    items.push({
      id: `attack-${a.id}`,
      label: tr('play.attack') + suffix,
      badge: { text: sv(std.attack.total) },
      detail: { title: localName(a.id, a.name), line: actionTag(tr, BASIC_ACTIONS.attack), steps: [{ lines: weaponSteps(tr, a, std) }] },
      act: BASIC_ACTIONS.attack,
      offensive: true,
      action: { type: 'execute', fx: 'actionExecute', after: 'root' },
    })
    // Con un solo ataque, Ataque completo da lo mismo que Atacar y gasta la ronda: no aparece
    if (std.fullAttack.length > 1) {
      items.push({
        id: `full-attack-${a.id}`,
        label: tr('play.fullAttack') + suffix,
        badge: { text: std.fullAttack.map(sv).join('/') },
        detail: { title: localName(a.id, a.name), line: actionTag(tr, BASIC_ACTIONS['full-attack']), steps: [{ lines: weaponSteps(tr, a, std, std.fullAttack) }] },
        act: BASIC_ACTIONS['full-attack'],
        offensive: true,
        action: { type: 'execute', fx: 'actionExecute', after: 'root' },
      })
    }
    const chargeAttack = std.attack.conditional.find((x) => x.condition === 'charge')
    const chargeAc = sheet.ac.normal.conditional.find((x) => x.condition === 'charge')
    if (chargeAttack && a.category !== 'ranged') {
      // En un turno restringido (incapacitado, tambaleante) es estándar y llega hasta la velocidad (core: chargeKind).
      const kind = chargeKind(sheet, session)
      const item: MenuItem = {
        id: `charge-${a.id}`,
        label: tr('play.charge') + suffix,
        badge: { text: sv(chargeAttack.total) },
        detail: {
          title: tr('play.charge'),
          line: actionTag(tr, kind),
          note: fill(tr('play.chargeDistance'), { n: String(chargeDistance(sheet, session)) }),
          extra: `${tr('sheet.ac')} ${chargeAc?.total ?? sheet.ac.normal.total} ${tr('play.untilYourTurn')}`,
          steps: [{ lines: weaponSteps(tr, a, std, [chargeAttack.total]) }],
        },
        act: kind,
        offensive: true,
        action: { type: 'execute', fx: 'actionExecute', update: charge, after: 'root' },
      }
      // Enredado no carga; apresado no se mueve (core: chargeBlock). gate() respeta este bloqueo.
      const no = chargeBlock(session)
      items.push(no ? blockItem(item, tr(no === 'grappled' ? 'play.noChargeGrappled' : no === 'prone' ? 'play.noChargeProne' : 'play.noChargeEntangled')) : item)
    }
  }
  items.push({
    id: 'maneuver',
    label: tr('play.maneuver'),
    badge: { text: `${tr('sheet.cmb')} ${sv(sheet.cmb.total)}` },
    detail: {
      title: tr('play.maneuver'),
      line: aooTag(tr, BASIC_ACTIONS.maneuver, BASIC_AOO.maneuver),
      note: fill(tr('play.yourCmd'), { n: String(sheet.cmd.total) }),
      steps: [{ lines: [{ roll: sv(sheet.cmb.total), text: tr('play.step.cmb') }] }],
    },
    act: BASIC_ACTIONS.maneuver,
    offensive: true,
    action: { type: 'execute', fx: 'actionExecute', after: 'root' },
  })
  // Modos, abajo: Ataque poderoso y las posturas, todos ON/OFF (prender una postura apaga la otra: core toggleStance)
  const modes = items.length
  // Ataque poderoso: ON/OFF que queda hasta apagarlo. Los números salen de la ficha (prendido o como condicional).
  const pa = sheet.feats.find((f) => f.id === 'power-attack' && f.known)
  const melee = sheet.attacks.find((a) => a.category !== 'ranged')?.variants.find((v) => v.id === 'standard')
  if (pa && melee) {
    const paValue = (st: Stat) =>
      [...st.applied, ...st.conditional.flatMap((x) => x.modifiers)].find((m) => m.source === pa.name)?.value ?? 0
    const on = session.powerAttack
    items.push({
      id: 'power-attack',
      label: tr('play.powerAttack'),
      badge: onOff(on),
      detail: {
        title: tr('play.powerAttack'),
        line: `${tr('play.col.attack')} ${sv(paValue(melee.attack))} · ${tr('play.col.damage')} ${sv(paValue(melee.damage))}`,
        note: tr('play.powerAttackNote'),
      },
      action: { type: 'toggle', on: !on, update: togglePowerAttack },
    })
  }
  ;(Object.keys(STANCES) as StanceId[]).forEach((id) => {
    const on = session.stance === id
    items.push({
      id: `stance-${id}`,
      label: tr(`stance.${id}`),
      badge: onOff(on),
      detail: { title: tr(`stance.${id}`), line: tr(`stanceNote.${id}`), note: `${tr('sheet.ac')} ${sheet.ac.normal.total}` },
      action: { type: 'toggle', on: !on, update: (s) => toggleStance(s, id) },
    })
  })
  const firstMode = items[modes]
  if (firstMode) items[modes] = { ...firstMode, section: tr('play.modes') }
  return items
}

// Combate con conjuros (las acciones de clase que lanzan con el arma): primeras en Pelea, con la primera arma cuerpo a
// cuerpo. Abren la lista de conjuros de esa variante.
function spellCombatRows(c: MenuCtx): MenuItem[] {
  const { sheet, session, t: tr } = c
  const a = sheet.attacks.find((x) => x.category !== 'ranged')
  const std = a?.variants.find((v) => v.id === 'standard')
  if (!a || !std) return []
  return sheet.actions
    .filter((x) => x.menu === 'attack' && x.kind === 'spell-attack')
    .flatMap((act): MenuItem[] => {
      const v = a.variants.find((x) => x.id === act.variant)
      if (!v) return []
      return [{
        id: `${act.id}-${a.id}`,
        label: localName(act.id, act.name),
        badge: { text: `${sv(v.attack.total)} +◆` },
        // Provoca por el conjuro (salvo a la defensiva); el de un toque a distancia se ve al elegir el conjuro
        // El desglose del ataque (lo que resta la variante) va en la tarjeta ⓘ
        detail: { title: `${localName(act.id, act.name)} · ${localName(a.id, a.name)}`, tag: spellAoOTag(tr, act.actionType, spellAoO(undefined, session.castDefensively)), stats: weaponStats(tr, a, v), line: actionNoteLabel(tr, act.id) || undefined, parts: partsOf(statRows(tr, v.attack, false, (s) => localSource(s))) },
        act: act.actionType,
        action: { type: 'open', menu: `spell-attack:${act.id}:${a.id}` },
      }]
    })
}

function spellAttack(c: MenuCtx, actionId: string, weaponId: string): MenuItem[] {
  const act = c.sheet.actions.find((a) => a.id === actionId)
  const weapon = c.sheet.attacks.find((a) => a.id === weaponId)
  const v = weapon?.variants.find((x) => x.id === act?.variant)
  if (!act || !weapon || !v) return []
  const weaponName = localName(weapon.id, weapon.name)
  return castableItems(c, { weapon: weaponName, variant: v.id, kind: act.actionType, weaponId: weapon.id })
}

// ¿Pegó? (después de lanzar un conjuro de toque o de Descargar toque)
function touchMenu(c: MenuCtx, variant: string, weaponId: string): MenuItem[] {
  const held = c.session.held
  if (!held) return []
  const title = localSpell(held.name)
  // El toque (o, con Impacto, el ataque del arma con el conjuro) y, con Combate con conjuros, el ataque con el arma que sigue
  const strike = spellstrikeFits(c, held.name) ? strikeGroup(c, held.name, variant) : null
  const touch = strike ? null : touchStep(c, held.name, variant)
  const weapon = weaponId ? c.sheet.attacks.find((a) => a.id === weaponId) : undefined
  const wv = weapon?.variants.find((x) => x.id === variant)
  const steps: DetailSteps[] = [
    ...(strike ? [strike] : touch ? [{ lines: [touch] }] : []),
    ...(weapon && wv ? [{ title: localName(weapon.id, weapon.name), lines: weaponSteps(c.t, weapon, wv) }] : []),
  ]
  // Descargar toque es una acción estándar (cuenta para el incapacitado, gate); después de lanzar, el conjuro ya contó
  // (por eso Le pegué / Erré no se bloquean aunque el −1 del incapacitado lo haya dejado moribundo: es el mismo lanzamiento).
  const act = variant === 'discharge' ? BASIC_ACTIONS.discharge : undefined
  return [
    {
      id: 'touch-hit',
      label: c.t('play.hit'),
      spell: { level: held.level, name: held.name },
      detail: { title, note: held.charges > 1 ? `${c.t('play.chargesLeft')}: ${held.charges - 1}` : undefined, steps },
      act,
      offensive: true,
      action: { type: 'execute', fx: 'actionExecute', update: touchHit, after: 'root' },
    },
    {
      id: 'touch-miss',
      label: c.t('play.miss'),
      spell: { level: held.level, name: held.name },
      detail: { title, note: c.t('play.missNote'), steps },
      act,
      offensive: true,
      action: { type: 'execute', fx: 'back', noAnim: true, after: 'root' },
    },
  ]
}

// Conjuros: solo para lanzar (Preparar está en la pestaña PERSONAJE)
function spellsMenu(c: MenuCtx): MenuItem[] {
  return castableItems(c)
}

// Preparar: el libro por nivel. Dentro de cada nivel, primero lo que ya tenías preparado (la sesión, no el borrador:
// así el orden no salta mientras tocás − / +) y después el resto, en el orden del libro.
function prepareMenu(c: MenuCtx): MenuItem[] {
  const { sheet, draft } = c
  return Object.keys(c.character.spellbook)
    .sort(byNumber)
    .filter((level) => slotsPerDay(sheet, level) > 0)
    .flatMap((level) => {
      const book = c.character.spellbook[level] ?? []
      const had = (name: string) => timesPrepared(c.session, level, name) > 0
      return [...book.filter(had), ...book.filter((name) => !had(name))].map((name, i): MenuItem => {
        const n = draft[level]?.[name] ?? 0
        const used = timesCast(c.session, level, name) // no se puede preparar menos (core: adjustPrepared / prepare)
        return {
          id: `prep-${level}-${name}`,
          label: localSpell(name),
          section: i === 0 ? `${levelLabel(c.t, level)}   ${preparedTotal(draft, level)}/${slotsPerDay(sheet, level)}` : undefined,
          spell: { level, name },
          badge: { text: `×${n}`, tone: n ? 'on' : 'muted' },
          detail: {
            title: localSpell(name),
            line: spellHead(c, level, name),
            note: spellEffect(c, name, 'standard') || spellSummary(c, name),
            extra: used ? `${c.t('play.castToday')} ×${used}: ${c.t('play.castFloor')}` : undefined,
          },
          action: { type: 'prepare' },
        }
      })
    })
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
        const suffix = sheet.attacks.length > 1 ? ` (${localName(a.id, a.name)})` : ''
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
      items.push({ id: act.id, label: localName(act.id, act.name), detail: { title: localName(act.id, act.name), line: tr('play.recallNote') }, act: act.actionType, action: { type: 'open', menu: `recall:${resource}` } })
    } else if (act.kind === 'spend') {
      items.push({
        id: act.id,
        label: localName(act.id, act.name),
        badge: { text: `${cost} ⚡`, tone: 'gold' },
        detail: { title: localName(act.id, act.name), line: `${cost} ⚡`, note: left < cost ? tr('play.poolEmpty') : undefined },
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
          label: localSpell(name),
          spell: { level, name },
          badge: { text: `${recallCost(level)} ⚡`, tone: 'gold' },
          detail: { title: localSpell(name), line: spellHead(c, level, name), note: left < recallCost(level) ? c.t('play.poolEmpty') : c.t('play.recallNote') },
          action:
            left >= recallCost(level)
              ? { type: 'execute', fx: 'resourceSpend', update: (s) => recallSpell(sheet, s, resource, level, name), after: 'root' }
              : { type: 'none' },
        })),
    )
}

// Habilidades: primero las de clase y después las otras, cada una con su atributo (apagado) y el total.
function skills(c: MenuCtx): MenuItem[] {
  const { sheet, t: tr } = c
  const shown = sheet.skills.filter((s) => (c.showAllSkills ? s.usable : s.ranks > 0))
  const list = [...shown.filter((s) => s.classSkill), ...shown.filter((s) => !s.classSkill)]
  return [
    ...list.map((s, i): MenuItem => ({
      id: `skill-${s.id}`,
      label: localName(s.id, s.name),
      section: i === 0 || s.classSkill !== list[i - 1]?.classSkill ? tr(s.classSkill ? 'play.skills.class' : 'play.skills.other') : undefined,
      hint: tr(`ability.${s.ability}`),
      badge: { text: sv(s.stat.total) },
      detail: {
        title: localName(s.id, s.name),
        line: sv(s.stat.total),
        note: statParts(tr, s.stat, true, (src) => localSource(src), SKILL_SEP),
        parts: partsOf(statRows(tr, s.stat, true, (src) => localSource(src))),
      },
      action: { type: 'none' },
    })),
    {
      id: 'skills-toggle',
      label: c.showAllSkills ? tr('play.showTrained') : tr('play.showAll'),
      detail: { title: tr('play.root.skills'), line: tr(c.showAllSkills ? 'play.showTrainedNote' : 'play.showAllNote') },
      action: { type: 'skills-toggle' },
    },
  ]
}

// Objetos: primero los que se usan (pociones, raciones), después los que tienen un efecto para leer. El resto, en Inventario.
function itemsMenu(c: MenuCtx): MenuItem[] {
  const { character, session, t: tr } = c
  const usable = (i: (typeof character.equipment.items)[number]) => i.consumable || i.quantity > 1
  const list = [...character.equipment.items.filter(usable), ...character.equipment.items.filter((i) => !usable(i) && i.notes)]
  return list.map((item): MenuItem => {
    const canUse = usable(item)
    const left = itemsLeft(character, session, item.id)
    const rules = itemDefs[item.id]
    return {
      id: `item-${item.id}`,
      label: localName(item.id, item.name),
      badge: canUse ? { text: `×${left}`, tone: left ? undefined : 'muted' } : undefined,
      detail: { title: localName(item.id, item.name), tag: canUse ? aooTag(tr, BASIC_ACTIONS['use-item'], BASIC_AOO['use-item']) : undefined, line: localNote(item.id, item.notes) ?? (item.slot ? slotLabel(tr, item.slot) : ''), note: canUse ? (left ? tr(rules?.heals ? 'play.useHeal' : 'play.use') : tr('play.noneLeft')) : undefined, extra: rules?.endsOnAttack ? tr('play.invisibleDex') : undefined },
      act: canUse ? BASIC_ACTIONS['use-item'] : undefined,
      heals: rules?.heals,
      action: canUse && left > 0 ? { type: 'execute', fx: 'resourceSpend', update: (s) => applyItem(character, s, item.id, rules), after: 'root' } : { type: 'none' },
    }
  })
}

// Nivel del conjuro según el spellbook (para la tarjeta de un buff activo).
const bookLevel = (c: MenuCtx, name: string) =>
  Object.keys(c.character.spellbook).find((l) => c.character.spellbook[l]?.includes(name)) ?? '1'

// Cuándo se va cada cosa que tenés encima (badge de la fila en Estado):
//   rounds → "quedan 9r" · turn → "hasta tu turno" (NUEVO TURNO lo saca) · combat → "fin del combate" · manual → "a mano"
type Until = { kind: 'rounds'; n: number } | { kind: 'turn' | 'combat' | 'manual' }
function untilBadge(c: MenuCtx, u: Until): MenuItem['badge'] {
  const text = u.kind === 'rounds' ? fill(c.t('play.until.rounds'), { n: String(u.n) }) : c.t(`play.until.${u.kind}`)
  return { text, tone: 'muted' }
}
const roundsOr = (n: number | undefined): Until => (n ? { kind: 'rounds', n } : { kind: 'combat' })

// Estado: arriba, todo lo que tenés encima (efectos y condiciones), cada uno con cuándo se va; CONFIRMAR lo quita.
// Abajo, agregar una condición o un efecto de otro.
function stateMenu(c: MenuCtx): MenuItem[] {
  const { session, t: tr } = c
  const remove = tr('play.remove')
  const items: MenuItem[] = []
  const add = (it: MenuItem, until: Until) => items.push({ ...it, badge: untilBadge(c, until) })
  for (const name of session.buffs) {
    const item = c.character.equipment.items.find((i) => i.id === name)
    const until = roundsOr(session.buffRounds[name])
    const action: ItemAction = { type: 'toggle', on: false, update: (s) => endBuff(s, name) }
    // El buff de un objeto (Invisible) no tiene tarjeta de conjuro: muestra su nota
    add(item
      ? { id: `buff-${name}`, label: localBuff(name), detail: { title: localBuff(name), line: localNote(item.id, item.notes), note: remove, extra: itemDefs[name]?.endsOnAttack ? tr('play.invisibleDex') : undefined }, action }
      : { id: `buff-${name}`, label: localSpell(name), spell: { level: bookLevel(c, name), name }, detail: { title: localSpell(name), line: spellSummary(c, name), note: remove }, action }, until)
  }
  if (session.enhancement) {
    const label = `${tr('play.enhance')} +${session.enhancement.bonus}`
    add({ id: 'effect-enhancement', label, detail: { title: label, line: tr('play.enhanceNote'), note: remove }, action: { type: 'toggle', on: false, update: endEnhancement } }, roundsOr(session.enhancement.rounds))
  }
  if (session.held) {
    const label = `${tr('play.held')}: ${localSpell(session.held.name)}${session.held.charges > 1 ? ` ×${session.held.charges}` : ''}`
    add({ id: 'effect-held', label, detail: { title: label, line: tr('play.dischargeNote'), note: tr('play.dropHeld') }, action: { type: 'toggle', on: false, update: dropHeld } }, { kind: 'manual' })
  }
  if (session.castDefensively) {
    const it = defensiveItem(c)
    add({ ...it, detail: { ...it.detail, note: [it.detail.note, remove].filter(Boolean).join(' · ') } }, { kind: 'manual' })
  }
  if (session.charging) {
    const label = tr('play.charged')
    add({ id: 'effect-charge', label, detail: { title: label, line: `${tr('sheet.ac')} ${c.sheet.ac.normal.total} ${tr('play.untilYourTurn')}`, note: remove }, action: { type: 'toggle', on: false, update: endCharge } }, { kind: 'turn' })
  }
  if (session.stance && session.stance in STANCES) {
    const id = session.stance as StanceId
    add({ id: `effect-stance`, label: tr(`stance.${id}`), detail: { title: tr(`stance.${id}`), line: tr(`stanceNote.${id}`), note: remove }, action: { type: 'toggle', on: false, update: (s) => toggleStance(s, id) } }, { kind: 'turn' })
  }
  // Lo ajeno (Bendecir, flanqueo, Libre)
  for (const e of session.external) {
    const label = externalLabel(tr, e)
    add({ id: `ext-${e.id}`, label, detail: { title: label, line: modsText(tr, e.mods, true), note: remove }, action: { type: 'toggle', on: false, update: (s) => removeExternal(s, e.id) } }, roundsOr(e.rounds))
  }
  // Condiciones prendidas: las mismas filas de la lista de condiciones
  for (const it of conditions(c)) {
    const id = it.id.replace(/^condition-/, '')
    if (session.conditions.includes(id as ConditionId)) add({ ...it, detail: { ...it.detail, extra: [it.detail.extra, remove].filter(Boolean).join(' · ') } }, { kind: 'manual' })
  }
  items.push(...activeValueRows(c))
  if (items[0]) items[0] = { ...items[0], section: tr('play.state.have') }
  items.push(
    { id: 'add-condition', label: tr('play.addCondition'), section: tr('play.state.add'), detail: { title: tr('play.addCondition'), line: tr('play.addConditionNote') }, action: { type: 'open', menu: 'conditions' } },
    { id: 'add-effect', label: tr('play.addEffect'), detail: { title: tr('play.addEffect'), line: tr('play.addEffectNote') }, action: { type: 'open', menu: 'effects-add' } },
    ...addValueRows(c),
  )
  return items
}

// --- Bonos y penalizadores ajenos ---
const SHORT_TARGET: Partial<Record<string, MessageKey>> = {
  attack: 'play.modShort.attack',
  'attack.melee': 'play.modShort.melee',
  ac: 'play.modShort.ac',
  damage: 'play.modShort.damage',
  saves: 'play.modShort.saves',
  'save.ref': 'play.modShort.ref',
}
const EFFECT_NAME: Record<CommonEffectId, MessageKey> = {
  bless: 'effect.bless',
  flanking: 'effect.flanking',
  'inspire-courage': 'effect.inspire-courage',
  haste: 'effect.haste',
}
// "+1 atq · +1 CA" (con tipo: "+1 atq (mor)")
export function modsText(t: Translate, mods: readonly ModifierInput[], withType = false): string {
  return mods
    .map((m) => {
      const key = SHORT_TARGET[m.target]
      const type = withType && m.type !== 'untyped' ? ` (${t(`bonusType.${m.type}`)})` : ''
      return `${sv(m.value)} ${key ? t(key) : m.target}${type}`
    })
    .join(' · ')
}
// Nombre de un efecto ajeno: el del común, o sus valores si es Libre.
export function externalLabel(t: Translate, e: Session['external'][number]): string {
  return e.id in COMMON_EFFECTS ? t(EFFECT_NAME[e.id as CommonEffectId]) : modsText(t, e.mods)
}

// Agregar: los comunes se prenden y apagan acá (ON/OFF); Libre abre el editor.
function effectsAdd(c: MenuCtx): MenuItem[] {
  const { session, t: tr } = c
  const items: MenuItem[] = (Object.keys(COMMON_EFFECTS) as CommonEffectId[]).map((id) => {
    const on = session.external.some((e) => e.id === id)
    const name = tr(EFFECT_NAME[id])
    return {
      id: `common-${id}`,
      label: `${name}  ${modsText(tr, COMMON_EFFECTS[id])}`,
      badge: onOff(on),
      detail: { title: name, line: modsText(tr, COMMON_EFFECTS[id], true), note: tr('play.untilCombatEnd') },
      // Se queda en la lista: se prenden varios seguidos
      action: { type: 'toggle', on: !on, update: (s) => toggleCommonEffect(s, id) },
    }
  })
  items.push({ id: 'free', label: tr('play.freeEffect'), detail: { title: tr('play.freeEffect'), line: tr('play.freeEffectNote') }, action: { type: 'open', menu: 'effect-free' } })
  return items
}

// Libre: cada fila se cambia con − / + (barra de Preparar) y LISTO lo agrega (PlayScreen → addFreeEffect).
function effectFree(c: MenuCtx): MenuItem[] {
  const d = c.free ?? emptyFreeDraft()
  const tr = c.t
  const row = (field: FreeField | 'rounds', label: string, value: string): MenuItem => ({
    id: `free-${field}`,
    label,
    badge: { text: value, tone: value === '0' || value === '∞' ? 'muted' : undefined },
    field,
    detail: { title: tr('play.freeEffect'), line: modsText(tr, freePreview(d)) || '—', note: d.rounds ? `${d.rounds}r` : tr('play.untilCombatEnd') },
    action: { type: 'prepare' },
  })
  return [
    row('attack', tr('play.mod.attack'), sv(d.attack)),
    row('ac', tr('play.mod.ac'), sv(d.ac)),
    row('damage', tr('play.mod.damage'), sv(d.damage)),
    row('saves', tr('play.mod.saves'), sv(d.saves)),
    row('rounds', tr('play.mod.rounds'), d.rounds ? String(d.rounds) : '∞'),
  ]
}
const freePreview = (d: FreeDraft): ModifierInput[] =>
  (['attack', 'ac', 'damage', 'saves'] as const).filter((f) => d[f] !== 0).map((f) => ({ target: f, type: 'untyped', value: d[f] }))

const activeCount = (s: Session) =>
  s.buffs.length + (s.enhancement ? 1 : 0) + (s.held ? 1 : 0) + (s.castDefensively ? 1 : 0) + (s.stance ? 1 : 0) + (s.charging ? 1 : 0) + s.external.length

// Rondas de cada buff prendido, por si se lanzó fuera de combate: Iniciar combate le pone el contador (core: startCombat).
export function prebuffRounds(c: MenuCtx): Record<string, number> {
  const rounds: Record<string, number> = {}
  for (const b of c.session.buffs) {
    const n = itemDefs[b]?.rounds ?? castInfoFor(spells[b], casterLevel(c)).rounds
    if (n) rounds[b] = n
  }
  return rounds
}

function conditions(c: MenuCtx): MenuItem[] {
  return (Object.keys(CONDITIONS) as ConditionId[]).map((id): MenuItem => {
    const on = c.session.conditions.includes(id)
    // Tumbado prendido: las dos CA de ese momento (core: proneAc) y que levantarse provoca
    const prone = id === 'prone' ? proneAc(c.sheet, c.session) : null
    const proneLine = prone ? `${c.t('play.proneMelee')} · ${fill(c.t('play.proneAc'), { melee: String(prone.melee), ranged: String(prone.ranged) })}` : undefined
    return {
      id: `condition-${id}`,
      label: localName(id, capitalize(id)),
      badge: onOff(on),
      detail: { title: localName(id, capitalize(id)), line: proneLine ?? c.t(`conditionNote.${id}`), note: id === 'prone' ? c.t('play.proneStand') : undefined, extra: id === 'prone' ? c.t('play.proneCrawl') : undefined },
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
  const items = rawMenu(id, c)
  // Una lista vacía igual tiene una fila, para que el cursor y el detalle tengan algo que mostrar
  if (!items.length) return [withNav({ id: 'empty', label: c.t('play.empty'), detail: { title: c.t('play.empty') }, action: { type: 'none' } })]
  const gated = gate(items, c).map(withNav)
  // En combate, lo urgente va en el detalle de la primera fila (Ataques): es la del cursor con NUEVO TURNO
  const urgent = id === 'root' && c.session.combat ? urgentWarn(c) : undefined
  const first = gated[0]
  if (urgent && first) gated[0] = { ...first, detail: { ...first.detail, warn: [urgent, first.detail.warn].filter(Boolean).join(' · ') } }
  return gated
}

// Señalización de la fila (después de gate, que puede apagarla): submenú → ›; solo lectura → apagada.
function withNav(it: MenuItem): MenuItem {
  if (it.action.type === 'open' || it.action.type === 'form') return { ...it, nav: 'submenu' }
  if (it.action.type === 'none' && !it.blocked) return { ...it, nav: 'info' }
  return it
}

// Las filas de un menú, sin gate ni señalización.
function rawMenu(id: string, c: MenuCtx): MenuItem[] {
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
    case 'character': items = character(c); break
    case 'defense': items = defense(c); break
    case 'state': items = stateMenu(c); break
    case 'conditions': items = conditions(c); break
    case 'effects-add': items = effectsAdd(c); break
    case 'effect-free': items = effectFree(c); break
    case 'ability-damage': items = abilityDamageMenu(c); break
    case 'notebook':
    case 'inventory':
    case 'stock':
    case 'qty':
    case 'purse':
    case 'backup': items = bookMenu(kind, c, a); break
    case 'levelup':
    case 'levelup-ranks':
    case 'levelup-spells':
    case 'levelup-feat': items = levelUpMenu(kind, c); break
    case 'value': items = valueMenu(c, a as ValueKind); break
    case 'death': items = death(c); break
    default: items = []
  }
  return items
}

// Lo urgente en combate (moribundo, tumbado, carga en la mano), en amarillo en el detalle de la fila de contexto de
// Pelea: es lo primero que ves con NUEVO TURNO. Sale de la sesión de ahora (core: turnUrgent), así que también sigue
// después de recargar.
function urgentWarn(c: MenuCtx): string | undefined {
  const tr = c.t
  const texts = turnUrgent(c.sheet, c.session).map((u) => {
    switch (u.kind) {
      case 'dying': return fill(tr('play.turn.dying'), { mod: sv(u.conMod), dc: String(u.dc) })
      case 'prone': return tr('play.turn.prone')
      case 'held': return fill(tr('play.turn.held'), { spell: localSpell(u.name) })
    }
  })
  return texts.length ? `⚠ ${texts.join(' · ')}` : undefined
}
const fill = (text: string, vars: Record<string, string>) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text)

// PG bajos y turno restringido. La regla vive en core/session.ts (checkAction / applyAction); acá solo se apaga la fila
// y va el aviso:
//   moribundo      → se bloquea toda acción (act, incluidos Descansar y Preparar) y los menús que abren acciones;
//   incapacitado   → se bloquea lo de ronda completa; lo estándar se puede, con el aviso, y al hacerlo resta 1 PG solo
//                    (pasa a moribundo). NUEVO TURNO no resta: la tirada de estabilización del moribundo es manual;
//   tambaleante    → se bloquea lo de ronda completa, sin costo.
// Quedan Personaje (habilidades para mirar, condiciones, efectos), Terminar combate y los PG del HUD.
// Una fila que ya viene bloqueada (ej. Cargar enredado) conserva su aviso, salvo con moribundo.
// Menús que abren listas de acciones: con moribundo se apagan enteros (es navegación: adentro todo estaría bloqueado).
const DYING_BLOCKED_MENUS = new Set(['attack', 'spells', 'items'])
const opensActions = (it: MenuItem) => DYING_BLOCKED_MENUS.has(it.id) || it.id.startsWith('pool-')

const blockItem = (it: MenuItem, warn: string): MenuItem => ({ ...it, blocked: true, hold: false, detail: { ...it.detail, warn }, action: { type: 'none' } })

const BLOCK_WARN = {
  dying: 'play.dyingBlock', stunned: 'play.stunnedBlock', nauseated: 'play.nauseatedBlock',
  'disabled-full': 'play.disabledFull', 'staggered-full': 'play.staggeredFull',
} as const

function gate(items: MenuItem[], c: MenuCtx): MenuItem[] {
  const dying = !checkAction(c.sheet, c.session, 'downtime').allowed
  const block = blockItem
  return items.map((it) => {
    if (it.blocked && !dying) return it
    const kind = it.act
    if (!kind) return dying && opensActions(it) ? block(it, c.t('play.dyingBlock')) : it
    const check = checkAction(c.sheet, c.session, kind, it.heals)
    if (!check.allowed) return block(it, c.t(BLOCK_WARN[check.reason]))
    if (!check.hpCost) return it
    const a = it.action
    // applyAction: primero la acción y después el −1 (sin efecto extra: suena el de la acción, Regla A).
    // Las `open` no se envuelven: el −1 va en lo que se haga adentro (también tiene act).
    const action: ItemAction = a.type === 'execute' ? { ...a, update: (s: Session) => applyAction(c.sheet, s, kind, a.update, it.heals) } : a
    return { ...it, detail: { ...it.detail, warn: c.t('play.disabledStd') }, action }
  })
}
