import { z } from 'zod'
import type { ComputedSheet, SessionContext } from './compute'
import type { Modifier } from './modifiers'
import type { Character, ModifierInput } from './schema'
import { CHARGE, CHARGED, CONDITIONS, STANCES, type ActionKind, type ConditionId, type StanceId } from './rules/pf1e/actions'

// Sesión de juego (#/play): lo que cambia en la mesa y no toca character.json.
// Funciones puras: reciben la sesión y devuelven una nueva. Si una acción no se puede hacer, devuelven la misma.

const countsSchema = z.record(z.string(), z.record(z.string(), z.number().int().nonnegative()))
export type SpellCounts = z.infer<typeof countsSchema> // nivel → conjuro → cantidad

export const sessionSchema = z.object({
  version: z.literal(1),
  damage: z.number().int().nonnegative().default(0), // HP perdidos: HP actual = máximo − damage
  resourcesUsed: z.record(z.string(), z.number().int().nonnegative()).default({}),
  prepared: countsSchema.default({}), // se mantiene de un día al otro
  cast: countsSchema.default({}), // lanzados desde el último descanso
  stance: z.string().nullable().default(null),
  conditions: z.array(z.string()).default([]),
  // rounds: rondas que quedan (solo si se activó en combate; sin rounds no vence sola)
  enhancement: z.object({ weaponId: z.string(), bonus: z.number().int().positive(), rounds: z.number().int().positive().optional() }).nullable().default(null),
  itemsUsed: z.record(z.string(), z.number().int().nonnegative()).default({}),
  castDefensively: z.boolean().default(false),
  // Conjuro de toque con carga en la mano (Shocking Grasp: 1; Frostbite: 1 por nivel). Se gasta al pegar.
  held: z.object({ level: z.string(), name: z.string(), charges: z.number().int().positive() }).nullable().default(null),
  buffs: z.array(z.string()).default([]), // conjuros activos que suman modifiers (Shield)
  buffRounds: z.record(z.string(), z.number().int().positive()).default({}), // rondas que le quedan a cada buff (solo en combate)
  // Modo combate: round 0 = arrancó el combate pero todavía no te tocó. Se avanza con MI TURNO.
  combat: z.object({ round: z.number().int().nonnegative() }).nullable().default(null),
  charging: z.boolean().default(false), // cargaste: −2 CA hasta tu próximo turno
  beforeDeath: z.number().int().nonnegative().nullable().default(null), // `damage` de antes del golpe que lo mató (para "Me equivoqué")
})
export type Session = z.infer<typeof sessionSchema>

export const emptySession = (): Session => sessionSchema.parse({ version: 1 })

// Sesión nueva de un personaje: arranca con su preparación por defecto (`defaultPrepared` del JSON).
// Los conjuros que no están en el spellbook de ese nivel se saltean (computeSheet lo avisa como issue).
export function newSession(character: Character): Session {
  let prepared: SpellCounts = {}
  for (const [level, names] of Object.entries(character.defaultPrepared)) {
    const book = character.spellbook[level] ?? []
    for (const name of names) {
      const n = count(prepared, level, name) + 1
      if (book.includes(name) && !(isCantrip(level) && n > 1)) prepared = setCount(prepared, level, name, n)
    }
  }
  return { ...emptySession(), prepared }
}

// Si lo guardado no valida, se usa `fallback` (por defecto, una sesión vacía).
export function parseSession(json: unknown, fallback: () => Session = emptySession): Session {
  const result = sessionSchema.safeParse(json)
  return result.success ? result.data : fallback()
}

const isStance = (id: string): id is StanceId => id in STANCES
const isCondition = (id: string): id is ConditionId => id in CONDITIONS
const withSource = (list: readonly ModifierInput[], source: string): Modifier[] => list.map((m) => ({ ...m, source }))

// Lo que la sesión cambia del personaje antes de calcular (hoy: la mejora del Arcane Pool, que se acumula con la del arma hasta +5).
export function applySession(character: Character, s: Session): Character {
  const e = s.enhancement
  if (!e) return character
  const weapons = character.equipment.weapons.map((w) =>
    w.id === e.weaponId ? { ...w, enhancement: Math.min(5, w.enhancement + e.bonus) } : w,
  )
  return { ...character, equipment: { ...character.equipment, weapons } }
}

// Posturas, condiciones y buffs → modifiers para computeSheet. La carga va siempre como condicional ('charge');
// después de cargar (`charging`) queda solo el −2 a la CA, sin condición (el +2 al ataque era de ese ataque).
// buffMods: los modifiers de cada buff por nombre de conjuro (salen de src/data, core no conoce los conjuros).
// Lanzar a la defensiva activa la condición 'casting-defensively' (ej. el +4 de Combat Casting).
export function toSessionContext(s: Session, buffMods: Readonly<Record<string, readonly ModifierInput[]>> = {}): SessionContext {
  return {
    modifiers: [
      ...withSource(CHARGE, 'charge'),
      ...(s.charging ? withSource(CHARGED, 'charge') : []),
      ...(s.stance && isStance(s.stance) ? withSource(STANCES[s.stance], s.stance) : []),
      ...s.conditions.filter(isCondition).flatMap((c) => withSource(CONDITIONS[c], c)),
      ...s.buffs.flatMap((b) => withSource(buffMods[b] ?? [], b)),
    ],
    conditions: s.castDefensively ? [...s.conditions, 'casting-defensively'] : s.conditions,
  }
}

// --- HP ---
export type HpState = 'ok' | 'disabled' | 'dying' | 'dead'

export const currentHp = (sheet: ComputedSheet, s: Session) => sheet.hp.total - s.damage
// Muere al llegar a −CON (la puntuación, no el modificador).
export const minHp = (sheet: ComputedSheet) => -sheet.abilities.con.score.total

export function clampHp(sheet: ComputedSheet, hp: number): number {
  return Math.max(minHp(sheet), Math.min(sheet.hp.total, hp))
}

// Si te morís, te morís: muerto no se cura ni descansa (solo undoDeath o revive). El golpe que mata guarda el daño de antes.
export function changeHp(sheet: ComputedSheet, s: Session, delta: number): Session {
  if (hpState(sheet, s) === 'dead') return s
  const hp = clampHp(sheet, currentHp(sheet, s) + delta)
  const next = { ...s, damage: sheet.hp.total - hp }
  return hpState(sheet, next) === 'dead' ? { ...next, beforeDeath: s.damage } : next
}

export function hpState(sheet: ComputedSheet, s: Session): HpState {
  const hp = currentHp(sheet, s)
  if (hp <= minHp(sheet)) return 'dead'
  if (hp < 0) return 'dying'
  if (hp === 0) return 'disabled'
  return 'ok'
}

// Qué acciones le quedan según los PG (PF1e):
//   'any'    en pie;
//   'single' incapacitado (0 PG): una sola acción estándar o de movimiento, nada de ronda completa (la estándar le saca 1 PG después);
//   'none'   moribundo: inconsciente, sin acciones.
// Muerto tiene su propia pantalla.
export type ActionLimit = 'any' | 'single' | 'none'
export function actionLimit(sheet: ComputedSheet, s: Session): ActionLimit {
  const state = hpState(sheet, s)
  return state === 'dying' ? 'none' : state === 'disabled' ? 'single' : 'any'
}

// ¿Se puede hacer una acción de ese tipo con los PG actuales?
//   moribundo    → nada;
//   incapacitado → nada de ronda completa; lo estándar se puede y cuesta 1 PG (después de hacerlo);
//                  lo rápido y lo de fuera del turno (Descansar, Preparar) se puede sin costo.
export type ActionCheck = { allowed: false; reason: 'dying' | 'disabled-full' } | { allowed: true; hpCost: 0 | 1 }
export function checkAction(sheet: ComputedSheet, s: Session, kind: ActionKind): ActionCheck {
  const limit = actionLimit(sheet, s)
  if (limit === 'none') return { allowed: false, reason: 'dying' }
  if (limit === 'single' && kind === 'full') return { allowed: false, reason: 'disabled-full' }
  return { allowed: true, hpCost: limit === 'single' && kind === 'standard' ? 1 : 0 }
}

// Hace la acción (`update`) si está permitida y después cobra el PG del incapacitado. Si no se puede, devuelve la misma sesión.
export function applyAction(sheet: ComputedSheet, s: Session, kind: ActionKind, update: (s: Session) => Session = (x) => x): Session {
  const check = checkAction(sheet, s, kind)
  if (!check.allowed) return s
  const next = update(s)
  return check.hpCost ? changeHp(sheet, next, -check.hpCost) : next
}

// "Me equivoqué": deshace el golpe que lo mató.
export const undoDeath = (s: Session): Session => (s.beforeDeath === null ? s : { ...s, damage: s.beforeDeath, beforeDeath: null })

// Revivir (lo decide el DM). Supuesto: PG = nivel de personaje, como Revivir a los muertos (PG = DG). Los niveles
// negativos (o la consunción de CON a nivel 1) no están modelados. Apaga lo mismo que el descanso, sin recuperar recursos.
export function revive(sheet: ComputedSheet, s: Session): Session {
  return {
    ...s,
    damage: Math.max(0, sheet.hp.total - sheet.level),
    beforeDeath: null,
    stance: null,
    enhancement: null,
    held: null,
    buffs: [],
    buffRounds: {},
    castDefensively: false,
    combat: null,
    charging: false,
  }
}

// --- Recursos (Arcane Pool…) ---
export function resourceLeft(sheet: ComputedSheet, s: Session, id: string): number {
  const r = sheet.resources.find((x) => x.id === id)
  return r ? Math.max(0, r.max.total - (s.resourcesUsed[id] ?? 0)) : 0
}

export function spendResource(sheet: ComputedSheet, s: Session, id: string, amount: number): Session {
  if (resourceLeft(sheet, s, id) < amount) return s
  return { ...s, resourcesUsed: { ...s.resourcesUsed, [id]: (s.resourcesUsed[id] ?? 0) + amount } }
}

// --- Conjuros ---
const count = (c: SpellCounts, level: string, spell: string) => c[level]?.[spell] ?? 0
const setCount = (c: SpellCounts, level: string, spell: string, n: number): SpellCounts => {
  const row = { ...c[level] }
  if (n > 0) row[spell] = n
  else delete row[spell]
  return { ...c, [level]: row }
}

export const isCantrip = (level: string) => level === '0'
export const timesPrepared = (s: Session, level: string, spell: string) => count(s.prepared, level, spell)
export const timesCast = (s: Session, level: string, spell: string) => count(s.cast, level, spell)
export const castsLeft = (s: Session, level: string, spell: string) =>
  Math.max(0, timesPrepared(s, level, spell) - timesCast(s, level, spell))

export const preparedTotal = (c: SpellCounts, level: string) =>
  Object.values(c[level] ?? {}).reduce((n, x) => n + x, 0)

export function slotsLeft(s: Session, level: string): number {
  return Object.keys(s.prepared[level] ?? {}).reduce((n, spell) => n + castsLeft(s, level, spell), 0)
}

// Cuántos se pueden preparar de ese nivel (trucos incluidos). Usa la primera clase lanzadora.
export const slotsPerDay = (sheet: ComputedSheet, level: string) => sheet.spellcasting[0]?.spellsPerDay[Number(level)] ?? 0

// Lo que el conjuro deja después de lanzarlo (sale de castInfoFor).
export interface CastInfo {
  touchCharges?: number // conjuro de toque: cargas en la mano
  buff?: boolean // queda activo sumando sus modifiers
  rounds?: number // duración del buff en rondas (solo cuenta en combate)
}

// Los datos de un conjuro que usan las reglas de la sesión (src/data/spells.ts → SpellDef tiene esta forma; core no importa src/data).
export interface SpellCastRules {
  castingTime: 'standard' | 'round'
  attack?: 'melee-touch' | 'ranged-touch'
  charges?: 'one' | 'perLevel'
  buff?: readonly unknown[]
  roundsPerLevel?: number
}

// Cargas en la mano (toque cuerpo a cuerpo: 1, o 1 por nivel) y rondas del buff, según el nivel de lanzador.
export function castInfoFor(def: SpellCastRules | undefined, casterLevel: number): CastInfo {
  return {
    touchCharges: def?.attack === 'melee-touch' ? (def.charges === 'perLevel' ? casterLevel : 1) : undefined,
    buff: Boolean(def?.buff),
    rounds: def?.roundsPerLevel ? def.roundsPerLevel * casterLevel : undefined,
  }
}

// Tipo de acción al lanzar: un conjuro de 1 ronda es de ronda completa; si se lanza con una acción de clase
// (Spell Combat, Spellstrike), manda el tipo de esa acción.
export function spellActionKind(def: SpellCastRules | undefined, classAction?: ActionKind): ActionKind {
  return def?.castingTime === 'round' ? 'full' : (classAction ?? 'standard')
}

// Los trucos no gastan nada. Lanzar otro conjuro disipa la carga que tenías en la mano (PF1e).
export function castSpell(s: Session, level: string, spell: string, info: CastInfo = {}): Session {
  if (!isCantrip(level) && castsLeft(s, level, spell) <= 0) return s
  const cast = isCantrip(level) ? s.cast : setCount(s.cast, level, spell, timesCast(s, level, spell) + 1)
  const held = info.touchCharges ? { level, name: spell, charges: info.touchCharges } : null
  const buffs = info.buff && !s.buffs.includes(spell) ? [...s.buffs, spell] : s.buffs
  const buffRounds = info.buff && info.rounds && s.combat ? { ...s.buffRounds, [spell]: info.rounds } : s.buffRounds
  return { ...s, cast, held, buffs, buffRounds }
}

// Toque que pega: gasta una carga. El que falla no cambia nada (la carga queda en la mano).
export function touchHit(s: Session): Session {
  if (!s.held) return s
  return { ...s, held: s.held.charges > 1 ? { ...s.held, charges: s.held.charges - 1 } : null }
}

export const dropHeld = (s: Session): Session => ({ ...s, held: null })
export const endBuff = (s: Session, spell: string): Session => ({ ...s, buffs: s.buffs.filter((b) => b !== spell), buffRounds: omit(s.buffRounds, spell) })
export const toggleDefensive = (s: Session): Session => ({ ...s, castDefensively: !s.castDefensively })

// Spell Recall: recupera un conjuro lanzado gastando tantos puntos como su nivel.
export const recallCost = (level: string) => Number(level)

export function recallSpell(sheet: ComputedSheet, s: Session, resource: string, level: string, spell: string): Session {
  const cost = recallCost(level)
  if (timesCast(s, level, spell) <= 0 || resourceLeft(sheet, s, resource) < cost) return s
  const spent = spendResource(sheet, s, resource, cost)
  return { ...spent, cast: setCount(spent.cast, level, spell, timesCast(s, level, spell) - 1) }
}

// Preparar: ±1 dentro del límite por día. Un truco preparado se lanza a voluntad, así que va 0 o 1.
// floor: veces que ya se lanzó hoy (no se puede preparar menos: los espacios gastados vuelven solo al descansar).
export function adjustPrepared(sheet: ComputedSheet, draft: SpellCounts, level: string, spell: string, delta: number, floor = 0): SpellCounts {
  const current = count(draft, level, spell)
  const next = current + delta
  if (next < 0 || next < floor) return draft
  if (isCantrip(level) && next > 1) return draft
  if (delta > 0 && preparedTotal(draft, level) + delta > slotsPerDay(sheet, level)) return draft
  return setCount(draft, level, spell, next)
}

// Al confirmar la preparación, lo ya lanzado no se pierde: cada conjuro queda preparado al menos tantas veces
// como se lanzó hoy (si no, se recuperaban espacios sin descansar). `cast` no cambia.
// Moribundo o muerto no prepara (hace falta estar consciente: checkAction 'downtime').
export function prepare(sheet: ComputedSheet, s: Session, prepared: SpellCounts): Session {
  if (hpState(sheet, s) === 'dead' || !checkAction(sheet, s, 'downtime').allowed) return s
  let next = prepared
  for (const [level, row] of Object.entries(s.cast)) {
    for (const [spell, n] of Object.entries(row)) if (count(next, level, spell) < n) next = setCount(next, level, spell, n)
  }
  return { ...s, prepared: next }
}

// --- Posturas, condiciones, mejora del arma, objetos ---
export const toggleStance = (s: Session, id: StanceId): Session => ({ ...s, stance: s.stance === id ? null : id })

export const toggleCondition = (s: Session, id: ConditionId): Session => ({
  ...s,
  conditions: s.conditions.includes(id) ? s.conditions.filter((c) => c !== id) : [...s.conditions, id],
})

// La mejora dura 1 minuto: en combate se cuenta en rondas.
export const ENHANCEMENT_ROUNDS = 10

export function enhanceWeapon(sheet: ComputedSheet, s: Session, resource: string, cost: number, weaponId: string, bonus: number): Session {
  if (s.enhancement || bonus <= 0 || resourceLeft(sheet, s, resource) < cost) return s
  const timed = s.combat ? { rounds: ENHANCEMENT_ROUNDS } : {}
  return { ...spendResource(sheet, s, resource, cost), enhancement: { weaponId, bonus, ...timed } }
}

export const endEnhancement = (s: Session): Session => ({ ...s, enhancement: null })

export function itemsLeft(character: Character, s: Session, itemId: string): number {
  const item = character.equipment.items.find((i) => i.id === itemId)
  return item ? Math.max(0, item.quantity - (s.itemsUsed[itemId] ?? 0)) : 0
}

export function consumeItem(character: Character, s: Session, itemId: string): Session {
  if (itemsLeft(character, s, itemId) <= 0) return s
  return { ...s, itemsUsed: { ...s.itemsUsed, [itemId]: (s.itemsUsed[itemId] ?? 0) + 1 } }
}

// --- Modo combate ---
function omit<T>(r: Record<string, T>, key: string): Record<string, T> {
  const next = { ...r }
  delete next[key]
  return next
}

export const startCombat = (s: Session): Session => ({ ...s, combat: { round: 0 } })
export const charge = (s: Session): Session => ({ ...s, charging: true })
export const endCharge = (s: Session): Session => ({ ...s, charging: false })

// MI TURNO (se toca cuando el DM te da el turno): avanza la ronda, se va lo que duraba "hasta tu próximo turno"
// (carga y postura) y los efectos con duración pierden una ronda; al llegar a 0 se apagan.
export function nextTurn(s: Session): Session {
  if (!s.combat) return s
  const buffRounds: Record<string, number> = {}
  let buffs = s.buffs
  for (const [name, n] of Object.entries(s.buffRounds)) {
    if (n > 1) buffRounds[name] = n - 1
    else buffs = buffs.filter((b) => b !== name)
  }
  const e = s.enhancement
  const enhancement = e?.rounds ? (e.rounds > 1 ? { ...e, rounds: e.rounds - 1 } : null) : e
  return { ...s, combat: { round: s.combat.round + 1 }, charging: false, stance: null, buffs, buffRounds, enhancement }
}

// Terminar combate: se van la ronda, la carga, la postura y lo que duraba en rondas (supuesto: 1 minuto ya pasó).
export function endCombat(s: Session): Session {
  const timed = Object.keys(s.buffRounds)
  return {
    ...s,
    combat: null,
    charging: false,
    stance: null,
    buffs: s.buffs.filter((b) => !timed.includes(b)),
    buffRounds: {},
    enhancement: s.enhancement?.rounds ? null : s.enhancement,
  }
}

// Descanso de 8 horas: HP = nivel de personaje, recursos y slots completos, sin postura, mejora, carga ni buffs.
// Los conjuros preparados quedan como estaban (se ajustan en Preparar). Muerto y moribundo no descansan.
export function rest(sheet: ComputedSheet, s: Session): Session {
  if (hpState(sheet, s) === 'dead' || !checkAction(sheet, s, 'downtime').allowed) return s
  return {
    ...changeHp(sheet, s, sheet.level),
    resourcesUsed: {},
    cast: {},
    stance: null,
    enhancement: null,
    held: null,
    buffs: [],
    buffRounds: {},
    castDefensively: false,
    combat: null,
    charging: false,
  }
}
