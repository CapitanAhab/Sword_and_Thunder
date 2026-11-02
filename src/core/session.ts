import { z } from 'zod'
import type { ComputedSheet, SessionContext } from './compute'
import type { Modifier } from './modifiers'
import { modifierInputSchema, type Character, type ModifierInput } from './schema'
import {
  CHARGE, CHARGED, COMMON_EFFECTS, CONDITIONS, FREE_TARGETS, HALF_SPEED, NO_CHARGE, PRONE_AC, REST_CLEARS, STANCES,
  type ActionKind, type CommonEffectId, type ConditionId, type FreeField, type StanceId,
} from './rules/pf1e/actions'

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
  // Combate con conjuros a la defensiva: puntos de ataque cambiados por concentración (el tope lo pone computeSheet)
  spellCombatTrade: z.number().int().nonnegative().default(0),
  // Conjuro de toque con carga en la mano (Shocking Grasp: 1; Frostbite: 1 por nivel). Se gasta al pegar.
  held: z.object({ level: z.string(), name: z.string(), charges: z.number().int().positive() }).nullable().default(null),
  buffs: z.array(z.string()).default([]), // conjuros activos que suman modifiers (Shield)
  buffRounds: z.record(z.string(), z.number().int().positive()).default({}), // rondas que le quedan a cada buff (solo en combate)
  // Bonos y penalizadores ajenos (Bendecir, flanqueo, el −2 CA de un enemigo). id = uno común ('bless') o 'free-N'.
  // Sin rounds, duran hasta Terminar combate (o Descansar); con rounds, bajan con MI TURNO.
  external: z
    .array(z.object({ id: z.string(), mods: z.array(modifierInputSchema), rounds: z.number().int().positive().optional() }))
    .default([]),
  // Modo combate: round 0 = arrancó el combate pero todavía no te tocó. Se avanza con MI TURNO.
  combat: z.object({ round: z.number().int().nonnegative() }).nullable().default(null),
  surprise: z.boolean().default(false), // ronda sorpresa: hasta el primer MI TURNO, solo una acción estándar o de movimiento
  // Última acción del turno hecha en este combate (menú + fila), para repetirla desde el menú principal
  lastAction: z.object({ menu: z.string(), item: z.string() }).nullable().default(null),
  charging: z.boolean().default(false), // cargaste: −2 CA hasta tu próximo turno
  readied: z.boolean().default(false), // preparaste una acción: dura hasta que actuás o hasta tu próximo turno
  beforeDeath: z.number().int().nonnegative().nullable().default(null), // `damage` de antes del golpe que lo mató (para "Me equivoqué")
  // Deshacer (un paso): qué fue lo último y cómo estaba la sesión antes. `before` se valida al deshacer.
  undo: z.object({ label: z.string(), before: z.unknown() }).nullable().default(null),
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

// --- Deshacer (un solo paso) ---
// Se deshace solo lo que gasta o devuelve recursos: PG, usos de recursos (⚡), conjuros lanzados (◆), objetos usados
// y la carga en la mano. Todo lo demás (atacar, ON/OFF, combate, MI TURNO, Preparar suelto) borra lo que había, porque
// deshacer después volvería atrás también eso.
const RESOURCE_KEYS = ['damage', 'resourcesUsed', 'cast', 'itemsUsed', 'held'] as const
export const changesResources = (before: Session, after: Session): boolean =>
  RESOURCE_KEYS.some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))

// inFlow: el paso es parte de un flujo que ya guardó qué deshacer (¿Le pegaste? después de lanzar, Preparar después
// de Descansar). Ahí se conserva la sesión de antes del flujo y su nombre: deshacer vuelve atrás el flujo entero.
export function trackUndo(before: Session, after: Session, label: string, inFlow: boolean): Session {
  if (inFlow && before.undo) return after.undo === before.undo ? after : { ...after, undo: before.undo }
  if (changesResources(before, after)) return { ...after, undo: { label, before: { ...before, undo: null } } }
  return clearUndo(after)
}
export const clearUndo = (s: Session): Session => (s.undo ? { ...s, undo: null } : s)
// ¿Es el mismo deshacer? (por contenido: el mismo paso puede armarse dos veces con objetos distintos)
export const sameUndo = (a: Session['undo'], b: Session['undo']): boolean =>
  a !== null && b !== null && a.label === b.label && JSON.stringify(a.before) === JSON.stringify(b.before)
// Vuelve a la sesión de antes. Si lo guardado no valida, no cambia nada.
export function undoLast(s: Session): Session {
  if (!s.undo) return s
  const result = sessionSchema.safeParse(s.undo.before)
  return result.success ? { ...result.data, undo: null } : clearUndo(s)
}

// Si lo guardado no valida, se usa `fallback` (por defecto, una sesión vacía).
export function parseSession(json: unknown, fallback: () => Session = emptySession): Session {
  const result = sessionSchema.safeParse(json)
  return result.success ? result.data : fallback()
}

// Lo guardado, campo por campo: un campo que no valida vuelve a su valor inicial y el resto se conserva.
// `dropped` son los campos descartados. null si no es una sesión (otra versión o algo que no es un objeto).
export function parseSessionFields(json: unknown): { session: Session; dropped: string[] } | null {
  if (!json || typeof json !== 'object' || (json as { version?: unknown }).version !== 1) return null
  const whole = sessionSchema.safeParse(json)
  if (whole.success) return { session: whole.data, dropped: [] }
  const raw = json as Record<string, unknown>
  const kept: Record<string, unknown> = { version: 1 }
  const dropped: string[] = []
  for (const [key, field] of Object.entries(sessionSchema.shape)) {
    if (key === 'version' || !(key in raw)) continue
    const r = field.safeParse(raw[key])
    if (r.success) kept[key] = r.data
    else dropped.push(key)
  }
  const result = sessionSchema.safeParse(kept)
  return result.success ? { session: result.data, dropped } : null
}

// --- Sesión ↔ personaje ---
// La sesión no guarda de qué personaje es: se compara siempre con el personaje actual (ficha sin sesión) y se
// ajusta solo lo que ya no cierra. Los PG no cambian (se guarda el daño: si sube el máximo, suben con él).
export type SessionFix =
  | { kind: 'spell-removed'; name: string } // ya no está en el libro: sale de preparados, lanzados, carga y buffs
  | { kind: 'prepared-trimmed'; level: string; max: number } // más preparados que espacios por día
  | { kind: 'resource-capped'; id: string; name: string; from: number; to: number }
  | { kind: 'resource-removed'; id: string }
  | { kind: 'item-removed'; id: string }
  | { kind: 'item-capped'; id: string; name: string; to: number }
  | { kind: 'enhancement-off' } // el arma mejorada ya no está
  | { kind: 'field-dropped'; field: string } // dato guardado que no validaba

export function reconcileSession(character: Character, sheet: ComputedSheet, s: Session): { session: Session; fixes: SessionFix[] } {
  const fixes: SessionFix[] = []
  const removedSpells = new Set<string>()
  const book = character.spellbook
  const inBook = (level: string, name: string) => (book[level] ?? []).includes(name)
  const inAnyBook = (name: string) => Object.values(book).some((list) => list.includes(name))
  const perDay = sheet.spellcasting[0]?.spellsPerDay ?? []

  // Preparados: fuera del libro se sacan; trucos, 1 de cada uno; nunca más que los espacios por día del nivel
  let prepared: SpellCounts = {}
  for (const [level, spells] of Object.entries(s.prepared)) {
    const max = perDay[Number(level)] ?? 0
    let used = 0
    let trimmed = false
    for (const [name, n] of Object.entries(spells)) {
      if (!inBook(level, name)) {
        removedSpells.add(name)
        continue
      }
      const want = isCantrip(level) ? Math.min(n, 1) : n
      const room = Math.max(0, max - used)
      const keep = Math.min(want, room)
      if (keep < want) trimmed = true
      if (keep > 0) prepared = setCount(prepared, level, name, keep)
      used += keep
    }
    if (trimmed) fixes.push({ kind: 'prepared-trimmed', level, max })
  }

  // Lanzados: nunca más que lo preparado (lo que ya no está preparado se va)
  let cast: SpellCounts = {}
  for (const [level, spells] of Object.entries(s.cast)) {
    for (const [name, n] of Object.entries(spells)) {
      if (!inBook(level, name)) removedSpells.add(name)
      const keep = Math.min(n, count(prepared, level, name))
      if (keep > 0) cast = setCount(cast, level, name, keep)
    }
  }

  // Recursos usados: tope = el máximo nuevo; un recurso que ya no existe se saca
  const resourcesUsed: Record<string, number> = {}
  for (const [id, used] of Object.entries(s.resourcesUsed)) {
    const res = sheet.resources.find((r) => r.id === id)
    if (!res) {
      fixes.push({ kind: 'resource-removed', id })
      continue
    }
    const to = Math.min(used, res.max.total)
    if (to < used) fixes.push({ kind: 'resource-capped', id, name: res.name, from: used, to })
    resourcesUsed[id] = to
  }

  // Objetos usados: el objeto tiene que existir y no se usan más de los que hay
  const itemsUsed: Record<string, number> = {}
  for (const [id, used] of Object.entries(s.itemsUsed)) {
    const item = character.equipment.items.find((i) => i.id === id)
    if (!item) {
      fixes.push({ kind: 'item-removed', id })
      continue
    }
    const to = Math.min(used, item.quantity)
    if (to < used) fixes.push({ kind: 'item-capped', id, name: item.name, to })
    itemsUsed[id] = to
  }

  // Carga en la mano y buffs: el conjuro tiene que seguir en el libro (o, si el buff es de un objeto, el objeto existir)
  let held = s.held
  if (held && !inBook(held.level, held.name)) {
    removedSpells.add(held.name)
    held = null
  }
  const buffs = s.buffs.filter((b) => {
    if (inAnyBook(b) || character.equipment.items.some((i) => i.id === b)) return true
    removedSpells.add(b)
    return false
  })
  const buffRounds = Object.fromEntries(Object.entries(s.buffRounds).filter(([b]) => buffs.includes(b)))

  // Mejora del arma: el arma tiene que existir
  let enhancement = s.enhancement
  if (enhancement && !character.equipment.weapons.some((w) => w.id === enhancement?.weaponId)) {
    enhancement = null
    fixes.push({ kind: 'enhancement-off' })
  }

  // Postura y condiciones que la app ya no conoce: se sacan sin aviso
  const stance = s.stance && isStance(s.stance) ? s.stance : null
  const conditions = s.conditions.filter(isCondition)

  for (const name of removedSpells) fixes.unshift({ kind: 'spell-removed', name })
  const next: Session = { ...s, prepared, cast, resourcesUsed, itemsUsed, held, buffs, buffRounds, enhancement, stance, conditions }
  // Sin cambios, la misma sesión (así no se vuelve a guardar ni a dibujar). Los niveles vacíos ({}) no cuentan.
  const dropEmpty = (c: SpellCounts) => Object.fromEntries(Object.entries(c).filter(([, row]) => Object.keys(row).length > 0))
  if (JSON.stringify(next) === JSON.stringify({ ...s, prepared: dropEmpty(s.prepared), cast: dropEmpty(s.cast) })) return { session: s, fixes: [] }
  // Si algo cambió, deshacer volvería a una foto con cosas que ya no existen
  return { session: { ...next, undo: null }, fixes }
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
      ...s.external.flatMap((e) => withSource(e.mods, e.id)),
    ],
    conditions: s.castDefensively ? [...s.conditions, 'casting-defensively'] : s.conditions,
    // El cambio de ataque por concentración solo vale a la defensiva
    defensiveTrade: s.castDefensively ? s.spellCombatTrade : 0,
  }
}

// --- Bonos y penalizadores ajenos ---
// Uno común se prende y se apaga (no se repite); los "Libre" se agregan cada uno con su id.
export function toggleCommonEffect(s: Session, id: CommonEffectId): Session {
  const on = s.external.some((e) => e.id === id)
  return { ...s, external: on ? s.external.filter((e) => e.id !== id) : [...s.external, { id, mods: [...COMMON_EFFECTS[id]] }] }
}

// Libre: un valor sin tipo por blanco (los 0 no van) y rondas (0 = hasta terminar el combate). Si todo es 0, no agrega nada.
export type FreeDraft = Record<FreeField, number> & { rounds: number }
export const emptyFreeDraft = (): FreeDraft => ({ attack: 0, ac: 0, damage: 0, saves: 0, rounds: 0 })
export function addFreeEffect(s: Session, d: FreeDraft): Session {
  const mods: ModifierInput[] = (Object.keys(FREE_TARGETS) as FreeField[])
    .filter((f) => d[f] !== 0)
    .map((f) => ({ target: FREE_TARGETS[f], type: 'untyped', value: d[f] }))
  if (mods.length === 0) return s
  const n = Math.max(0, ...s.external.map((e) => Number(e.id.startsWith('free-') ? e.id.slice(5) : 0) || 0)) + 1
  return { ...s, external: [...s.external, { id: `free-${n}`, mods, ...(d.rounds > 0 ? { rounds: d.rounds } : {}) }] }
}

export const removeExternal = (s: Session, id: string): Session => ({ ...s, external: s.external.filter((e) => e.id !== id) })

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

// Qué acciones le quedan (PF1e):
//   'any'    en pie;
//   'single' turno restringido: una sola acción estándar o de movimiento, nada de ronda completa.
//            Incapacitado (0 PG; la estándar le saca 1 PG después) o ronda sorpresa (sin costo);
//   'none'   moribundo: inconsciente, sin acciones.
// Muerto tiene su propia pantalla.
export type ActionLimit = 'any' | 'single' | 'none'
export function actionLimit(sheet: ComputedSheet, s: Session): ActionLimit {
  const state = hpState(sheet, s)
  if (state === 'dying') return 'none'
  return state === 'disabled' || (s.surprise && s.combat) ? 'single' : 'any'
}

// ¿Se puede hacer una acción de ese tipo?
//   moribundo     → nada;
//   incapacitado  → nada de ronda completa; lo estándar se puede y cuesta 1 PG (después de hacerlo);
//                   lo rápido y lo de fuera del turno (Descansar, Preparar) se puede sin costo;
//   ronda sorpresa → nada de ronda completa, sin costo.
// heals: la acción cura (una poción); a 0 PG no cuesta el PG, porque te deja con más.
export type ActionCheck = { allowed: false; reason: 'dying' | 'disabled-full' | 'surprise-full' } | { allowed: true; hpCost: 0 | 1 }
export function checkAction(sheet: ComputedSheet, s: Session, kind: ActionKind, heals = false): ActionCheck {
  const limit = actionLimit(sheet, s)
  const disabled = hpState(sheet, s) === 'disabled'
  if (limit === 'none') return { allowed: false, reason: 'dying' }
  if (limit === 'single' && kind === 'full') return { allowed: false, reason: disabled ? 'disabled-full' : 'surprise-full' }
  return { allowed: true, hpCost: disabled && kind === 'standard' && !heals ? 1 : 0 }
}

// --- Movimiento y carga ---
// Velocidad de ese momento: enredado se mueve a la mitad (redondeado a 5 pies).
export function currentSpeed(sheet: ComputedSheet, s: Session): number {
  const speed = sheet.speed.total
  return s.conditions.some((c) => (HALF_SPEED as readonly string[]).includes(c)) ? Math.floor(speed / 10) * 5 : speed
}

// Carga: ronda completa, hasta el doble de la velocidad. En un turno restringido (incapacitado, ronda sorpresa)
// es una acción estándar y llega hasta la velocidad.
export const chargeKind = (sheet: ComputedSheet, s: Session): ActionKind => (actionLimit(sheet, s) === 'single' ? 'standard' : 'full')
export function chargeDistance(sheet: ComputedSheet, s: Session): number {
  const speed = currentSpeed(sheet, s)
  return chargeKind(sheet, s) === 'standard' ? speed : speed * 2
}
// Tumbado: la CA contra cuerpo a cuerpo y contra distancia (la del HUD no cambia). null = no está tumbado.
export function proneAc(sheet: ComputedSheet, s: Session): { melee: number; ranged: number } | null {
  if (!s.conditions.includes('prone')) return null
  const ac = sheet.ac.normal.total
  return { melee: ac + PRONE_AC.melee, ranged: ac + PRONE_AC.ranged }
}

// Qué condición impide cargar (enredado no carga; apresado no se mueve; tumbado se levanta primero). null = se puede.
export function chargeBlock(s: Session): ConditionId | null {
  return NO_CHARGE.find((c) => s.conditions.includes(c)) ?? null
}

// Hace la acción (`update`) si está permitida y después cobra el PG del incapacitado. Si no se puede, devuelve la misma sesión.
export function applyAction(sheet: ComputedSheet, s: Session, kind: ActionKind, update: (s: Session) => Session = (x) => x, heals = false): Session {
  const check = checkAction(sheet, s, kind, heals)
  if (!check.allowed) return s
  const next = update(s)
  return check.hpCost ? changeHp(sheet, next, -check.hpCost) : next
}

// "Me equivoqué": deshace el golpe que lo mató.
export const undoDeath = (s: Session): Session => (s.beforeDeath === null ? s : { ...s, damage: s.beforeDeath, beforeDeath: null })

// Revivir (lo decide el DM): PG = nivel de personaje, como Revivir a los muertos (PG = DG). Los niveles
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
    external: [],
    castDefensively: false,
    spellCombatTrade: 0,
    combat: null,
    surprise: false,
    lastAction: null,
    charging: false,
    readied: false,
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
// Al apagar la defensiva, el cambio de ataque por concentración vuelve a 0.
export const toggleDefensive = (s: Session): Session => ({ ...s, castDefensively: !s.castDefensively, spellCombatTrade: 0 })
// Cambio de ataque por concentración, entre 0 y el tope de la ficha.
export const setSpellCombatTrade = (sheet: ComputedSheet, s: Session, value: number): Session =>
  ({ ...s, spellCombatTrade: Math.max(0, Math.min(sheet.defensiveTrade?.max ?? 0, value)) })

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

// Lo que hace un objeto al usarlo (src/data/items.ts tiene esta forma; core no importa src/data).
export interface ItemRules {
  heals?: boolean // cura con un dado físico: el jugador suma la cura en el HUD
  buff?: readonly unknown[] // queda activo como buff, con el id del objeto
  rounds?: number // duración del buff en rondas (solo cuenta en combate, como los conjuros)
  endsOnAttack?: boolean // el buff se corta al atacar o lanzar sobre alguien (afterAction)
}

// Usar un objeto: se descuenta y, si deja un efecto, queda como buff (con sus rondas, si hay combate).
export function applyItem(character: Character, s: Session, itemId: string, rules: ItemRules = {}): Session {
  const used = consumeItem(character, s, itemId)
  if (used === s || !rules.buff) return used
  const buffs = used.buffs.includes(itemId) ? used.buffs : [...used.buffs, itemId]
  const buffRounds = rules.rounds && used.combat ? { ...used.buffRounds, [itemId]: rules.rounds } : used.buffRounds
  return { ...used, buffs, buffRounds }
}

// Preparar una acción: queda anotada hasta que actuás (afterAction) o hasta tu próximo turno (nextTurn).
export const ready = (s: Session): Session => ({ ...s, readied: true })
export const endReadied = (s: Session): Session => ({ ...s, readied: false })

// Después de una acción del turno: la acción preparada ya se usó (pasó lo que esperabas y actuaste) y, si fue
// ofensiva (atacar, o lanzar sobre alguien), se cortan los efectos que terminan al atacar (la invisibilidad).
// `endsOnAttack`: ids de esos efectos (salen de src/data).
export function afterAction(s: Session, offensive: boolean, endsOnAttack: readonly string[]): Session {
  const cut = offensive && s.buffs.some((b) => endsOnAttack.includes(b))
  if (!cut && !s.readied) return s
  if (!cut) return { ...s, readied: false }
  return {
    ...s,
    readied: false,
    buffs: s.buffs.filter((b) => !endsOnAttack.includes(b)),
    buffRounds: Object.fromEntries(Object.entries(s.buffRounds).filter(([b]) => !endsOnAttack.includes(b))),
  }
}

// --- Modo combate ---
function omit<T>(r: Record<string, T>, key: string): Record<string, T> {
  const next = { ...r }
  delete next[key]
  return next
}

// Iniciar combate. Lo que ya estaba prendido sin contador (lanzado fuera de combate) arranca a contar ahora,
// como si se hubiera lanzado justo antes: la mejora del arma con ENHANCEMENT_ROUNDS y cada buff con sus rondas
// (`prebuffRounds`: conjuro → rondas; salen de src/data, core no conoce los conjuros). Así vence solo.
export function startCombat(s: Session, prebuffRounds: Readonly<Record<string, number>> = {}): Session {
  const buffRounds = { ...s.buffRounds }
  for (const b of s.buffs) {
    const n = prebuffRounds[b]
    if (buffRounds[b] === undefined && n) buffRounds[b] = n
  }
  const e = s.enhancement
  const enhancement = e && !e.rounds ? { ...e, rounds: ENHANCEMENT_ROUNDS } : e
  return { ...s, combat: { round: 0 }, surprise: false, lastAction: null, buffRounds, enhancement }
}

// Ronda sorpresa: se marca solo antes del primer MI TURNO (ronda 0) y se apaga sola con MI TURNO.
export const toggleSurprise = (s: Session): Session => (s.combat?.round === 0 ? { ...s, surprise: !s.surprise } : s)

// Guarda la acción del turno que se acaba de hacer (menú + fila), para repetirla. Solo en combate.
export const recordAction = (s: Session, menu: string, item: string): Session => (s.combat ? { ...s, lastAction: { menu, item } } : s)

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
  // Lo ajeno con rondas también pierde una (supuesto: vence en tu turno, no en el de quien lo lanzó)
  const external = s.external.flatMap((x) => (!x.rounds ? [x] : x.rounds > 1 ? [{ ...x, rounds: x.rounds - 1 }] : []))
  // El turno nuevo no se deshace, y lo de antes ya no se puede deshacer (volvería atrás también el turno).
  return { ...s, combat: { round: s.combat.round + 1 }, surprise: false, charging: false, readied: false, stance: null, buffs, buffRounds, enhancement, external, undo: null }
}

// Resumen de MI TURNO, para el aviso del detalle: qué se apagó al empezar el turno, qué sigue prendido (con sus
// rondas) y lo urgente. Los textos los arma la vista.
export type TurnEffect =
  | { kind: 'buff'; id: string; rounds?: number }
  | { kind: 'enhancement'; bonus: number; rounds?: number }
  | { kind: 'external'; effect: Session['external'][number] }
  | { kind: 'stance'; id: string }
  | { kind: 'charging' }
  | { kind: 'surprise' }
  | { kind: 'readied' }
// Moribundo: la tirada para estabilizarse es de CON contra CD 10 + los PG negativos (dados físicos; si falla, −1 PG).
export type TurnUrgent = { kind: 'dying'; dc: number; conMod: number } | { kind: 'prone' } | { kind: 'held'; name: string }
export interface TurnSummary {
  round: number
  expired: TurnEffect[]
  active: TurnEffect[]
  urgent: TurnUrgent[]
}
export function turnSummary(sheet: ComputedSheet, before: Session, after: Session): TurnSummary {
  const expired: TurnEffect[] = []
  if (before.charging && !after.charging) expired.push({ kind: 'charging' })
  if (before.stance && !after.stance) expired.push({ kind: 'stance', id: before.stance })
  if (before.surprise && !after.surprise) expired.push({ kind: 'surprise' })
  if (before.readied && !after.readied) expired.push({ kind: 'readied' })
  for (const b of before.buffs) if (!after.buffs.includes(b)) expired.push({ kind: 'buff', id: b })
  if (before.enhancement && !after.enhancement) expired.push({ kind: 'enhancement', bonus: before.enhancement.bonus })
  for (const e of before.external) if (!after.external.some((x) => x.id === e.id)) expired.push({ kind: 'external', effect: e })
  const active: TurnEffect[] = [
    ...after.buffs.map((id): TurnEffect => ({ kind: 'buff', id, rounds: after.buffRounds[id] })),
    ...(after.enhancement ? [{ kind: 'enhancement', bonus: after.enhancement.bonus, rounds: after.enhancement.rounds } as const] : []),
    ...after.external.map((effect): TurnEffect => ({ kind: 'external', effect })),
  ]
  const urgent: TurnUrgent[] = []
  const hp = currentHp(sheet, after)
  if (hpState(sheet, after) === 'dying') urgent.push({ kind: 'dying', dc: 10 - hp, conMod: sheet.abilities.con.mod })
  if (after.conditions.includes('prone')) urgent.push({ kind: 'prone' })
  if (after.held) urgent.push({ kind: 'held', name: after.held.name })
  return { round: after.combat?.round ?? 0, expired, active, urgent }
}

// Terminar combate: se van la ronda, la carga, la postura, lo que duraba en rondas (supuesto: 1 minuto ya pasó)
// y todo lo ajeno.
export function endCombat(s: Session): Session {
  const timed = Object.keys(s.buffRounds)
  return {
    ...s,
    combat: null,
    surprise: false,
    lastAction: null,
    charging: false,
    readied: false,
    stance: null,
    spellCombatTrade: 0,
    buffs: s.buffs.filter((b) => !timed.includes(b)),
    buffRounds: {},
    external: [],
    enhancement: s.enhancement?.rounds ? null : s.enhancement,
  }
}

// Descanso de 8 horas: HP = nivel de personaje, recursos y slots completos, sin postura, mejora, carga ni buffs,
// y sin las condiciones que se van al descansar (fatiga). Los conjuros preparados quedan como estaban (se ajustan en
// Preparar). Muerto y moribundo no descansan.
export function rest(sheet: ComputedSheet, s: Session): Session {
  if (hpState(sheet, s) === 'dead' || !checkAction(sheet, s, 'downtime').allowed) return s
  return {
    ...changeHp(sheet, s, sheet.level),
    conditions: s.conditions.filter((c) => !(isCondition(c) && REST_CLEARS.includes(c))),
    resourcesUsed: {},
    cast: {},
    stance: null,
    enhancement: null,
    held: null,
    buffs: [],
    buffRounds: {},
    external: [],
    castDefensively: false,
    spellCombatTrade: 0,
    combat: null,
    surprise: false,
    lastAction: null,
    charging: false,
    readied: false,
  }
}
