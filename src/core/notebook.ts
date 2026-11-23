import { z } from 'zod'
import { computeSheet, type ComputedSheet } from './compute'
import type { RulesDb } from './defs'
import { featsByLevel } from './rules/pf1e/progression'
import { arcanaSchema, itemSchema, type Character } from './schema'
import { parseSessionFields, type Session } from './session'

// Libreta: lo que el jugador anota en la mesa (XP, oro, notas, inventario). Guarda cambios sobre character.json,
// que nunca se toca. Vive en el navegador, separada de la sesión. Funciones puras.

export const COINS = ['pp', 'gp', 'sp', 'cp'] as const
export type Coin = (typeof COINS)[number]

const delta = z.number().int().default(0)

// Un nivel subido en la mesa. El último puede ser un borrador (done = false): se ve en el asistente, no en la ficha.
export const levelUpSchema = z.object({
  hp: z.number().int().positive().nullable().default(null), // lo que dio el dado, sin CON
  fcb: z.enum(['hp', 'skill']).default('hp'),
  skills: z.record(z.string(), z.number().int().positive()).default({}), // rangos nuevos por skill id
  spells: z.array(z.object({ level: z.string(), name: z.string() })).default([]),
  feat: z.string().nullable().default(null),
  arcana: arcanaSchema.nullable().default(null),
  done: z.boolean().default(false),
})
export type LevelUp = z.infer<typeof levelUpSchema>

export const notebookSchema = z.object({
  version: z.literal(1),
  xp: delta,
  wealth: z.object({ pp: delta, gp: delta, sp: delta, cp: delta }).default({ pp: 0, gp: 0, sp: 0, cp: 0 }),
  notes: z.string().nullable().default(null), // null = las del JSON
  addedItems: z.array(itemSchema).default([]),
  quantity: z.record(z.string(), z.number().int().nonnegative()).default({}), // id → cantidad total
  removedItems: z.array(z.string()).default([]),
  unequipped: z.array(z.string()).default([]),
  armorOff: z.boolean().default(false),
  shieldOff: z.boolean().default(false),
  weaponsOff: z.array(z.string()).default([]),
  levelUps: z.array(levelUpSchema).default([]),
})
export type Notebook = z.infer<typeof notebookSchema>

export const emptyNotebook = (): Notebook => notebookSchema.parse({ version: 1 })

// Los niveles subidos, encima de los del JSON (con la clase del primer nivel).
function withLevelUps(character: Character, ups: readonly LevelUp[]): Character {
  if (!ups.length) return character
  const cls = character.levels[0]!.class
  const skills = { ...character.skills }
  const spellbook: Record<string, string[]> = { ...character.spellbook }
  for (const u of ups) {
    for (const [id, n] of Object.entries(u.skills)) skills[id] = (skills[id] ?? 0) + n
    for (const sp of u.spells) spellbook[sp.level] = [...(spellbook[sp.level] ?? []), sp.name]
  }
  return {
    ...character,
    levels: [...character.levels, ...ups.map((u) => ({ class: cls, hp: u.hp ?? 1, fcb: u.fcb }))],
    skills,
    spellbook,
    feats: [...character.feats, ...ups.flatMap((u) => (u.feat ? [{ id: u.feat }] : []))],
    arcana: [...character.arcana, ...ups.flatMap((u) => (u.arcana ? [u.arcana] : []))],
  }
}

// El personaje con lo anotado encima. Con la libreta vacía, los mismos datos que el JSON.
export function applyNotebook(json: Character, nb: Notebook): Character {
  const character = withLevelUps(json, nb.levelUps.filter((u) => u.done))
  const items = [...character.equipment.items, ...nb.addedItems]
    .filter((i) => !nb.removedItems.includes(i.id))
    .map((i) => ({ ...i, quantity: nb.quantity[i.id] ?? i.quantity, equipped: i.equipped && !nb.unequipped.includes(i.id) }))
  const equipment = { ...character.equipment, items, weapons: character.equipment.weapons.filter((w) => !nb.weaponsOff.includes(w.id)) }
  if (nb.armorOff) delete equipment.armor
  if (nb.shieldOff) delete equipment.shield
  const { pp, gp, sp, cp } = character.wealth
  const coin = (base: number, d: number) => Math.max(0, base + d)
  return {
    ...character,
    xp: coin(character.xp, nb.xp),
    wealth: { pp: coin(pp, nb.wealth.pp), gp: coin(gp, nb.wealth.gp), sp: coin(sp, nb.wealth.sp), cp: coin(cp, nb.wealth.cp) },
    equipment,
    ...(nb.notes === null ? {} : { notes: nb.notes }),
  }
}

// Suma o resta sin bajar de 0: se guarda la diferencia con el JSON (`base`).
const moved = (base: number, saved: number, by: number) => Math.max(0, base + saved + by) - base

export const addXp = (nb: Notebook, base: Character, by: number): Notebook => ({ ...nb, xp: moved(base.xp, nb.xp, by) })

export const addCoins = (nb: Notebook, base: Character, c: Coin, by: number): Notebook => ({
  ...nb,
  wealth: { ...nb.wealth, [c]: moved(base.wealth[c], nb.wealth[c], by) },
})

export const setNotes = (nb: Notebook, notes: string): Notebook => ({ ...nb, notes })

export function addItem(nb: Notebook, item: { name: string; quantity: number; weight?: number }): Notebook {
  const next = Math.max(0, ...nb.addedItems.map((i) => Number(i.id.replace('custom-', '')) || 0)) + 1
  return { ...nb, addedItems: [...nb.addedItems, itemSchema.parse({ ...item, id: `custom-${next}` })] }
}

export const setQuantity = (nb: Notebook, id: string, n: number): Notebook => ({ ...nb, quantity: { ...nb.quantity, [id]: Math.max(0, n) } })

export function removeItem(nb: Notebook, id: string): Notebook {
  const { [id]: _, ...quantity } = nb.quantity
  const added = nb.addedItems.some((i) => i.id === id)
  return {
    ...nb,
    quantity,
    unequipped: nb.unequipped.filter((x) => x !== id),
    addedItems: nb.addedItems.filter((i) => i.id !== id),
    removedItems: added ? nb.removedItems : [...nb.removedItems, id],
  }
}

const flip = (list: readonly string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

export const toggleEquipped = (nb: Notebook, id: string): Notebook => ({ ...nb, unequipped: flip(nb.unequipped, id) })
export const toggleArmor = (nb: Notebook): Notebook => ({ ...nb, armorOff: !nb.armorOff })
export const toggleShield = (nb: Notebook): Notebook => ({ ...nb, shieldOff: !nb.shieldOff })
export const toggleWeapon = (nb: Notebook, id: string): Notebook => ({ ...nb, weaponsOff: flip(nb.weaponsOff, id) })

// --- Subir de nivel ---
// El asistente llega hasta acá: el nivel 4 trae el aumento de atributo, que no está.
export const MAX_LEVEL_UP = 3

export const levelUpDraft = (nb: Notebook): LevelUp | null => {
  const last = nb.levelUps.at(-1)
  return last && !last.done ? last : null
}

// Con la XP del siguiente nivel, hasta el tope del asistente.
export const canLevelUp = (sheet: ComputedSheet): boolean =>
  sheet.xp.next !== null && sheet.xp.current >= sheet.xp.next && sheet.level < MAX_LEVEL_UP

export const startLevelUp = (nb: Notebook): Notebook =>
  levelUpDraft(nb) ? nb : { ...nb, levelUps: [...nb.levelUps, levelUpSchema.parse({})] }

const editDraft = (nb: Notebook, fn: (u: LevelUp) => LevelUp): Notebook => {
  const draft = levelUpDraft(nb)
  return draft ? { ...nb, levelUps: [...nb.levelUps.slice(0, -1), fn(draft)] } : nb
}

export const setLevelHp = (nb: Notebook, hp: number): Notebook => editDraft(nb, (u) => ({ ...u, hp }))
export const setLevelFcb = (nb: Notebook, fcb: LevelUp['fcb']): Notebook => editDraft(nb, (u) => ({ ...u, fcb }))
export const setLevelFeat = (nb: Notebook, feat: string | null): Notebook => editDraft(nb, (u) => ({ ...u, feat }))
export const setLevelArcana = (nb: Notebook, arcana: LevelUp['arcana']): Notebook => editDraft(nb, (u) => ({ ...u, arcana }))

export function addLevelRank(nb: Notebook, id: string, by: number): Notebook {
  return editDraft(nb, (u) => {
    const { [id]: now = 0, ...rest } = u.skills
    const next = Math.max(0, now + by)
    return { ...u, skills: next ? { ...rest, [id]: next } : rest }
  })
}

export function toggleLevelSpell(nb: Notebook, level: string, name: string): Notebook {
  return editDraft(nb, (u) => {
    const has = u.spells.some((s) => s.level === level && s.name === name)
    return { ...u, spells: has ? u.spells.filter((s) => !(s.level === level && s.name === name)) : [...u.spells, { level, name }] }
  })
}

export const confirmLevelUp = (nb: Notebook): Notebook => editDraft(nb, (u) => ({ ...u, done: true }))

// Borra el último nivel subido (y el borrador, si había uno).
export function undoLevelUp(nb: Notebook): Notebook {
  const done = nb.levelUps.filter((u) => u.done)
  return { ...nb, levelUps: done.slice(0, -1) }
}

// El personaje con el borrador aplicado como si estuviera confirmado: con él computeSheet dice lo que falta.
export const levelUpPreview = (json: Character, nb: Notebook): Character =>
  applyNotebook(json, { ...nb, levelUps: nb.levelUps.map((u) => ({ ...u, done: true })) })

export type LevelUpMissing = 'hp' | 'ranks' | 'feat' | 'arcana'
export interface LevelUpStatus {
  level: number // el nivel nuevo
  hitDie: number
  ranksLeft: number // negativo si sobran (al pasar la clase favorecida a PG)
  rankCap: number // rangos máximos por skill
  feat: boolean // este nivel da una dote
  featChoices: string[] // ids de dotes con datos que no tiene
  arcana: boolean // este nivel da un Arcano
  spells: number // conjuros que se suman al libro
  spellChoices: { level: string; name: string }[] // de la lista de la clase, que no están en el libro
  missing: LevelUpMissing[]
}

// preview = computeSheet(levelUpPreview(...)); before = el personaje sin el borrador.
export function levelUpStatus(before: Character, preview: ComputedSheet, draft: LevelUp, rules: RulesDb): LevelUpStatus {
  const level = preview.level
  const def = rules.classes[before.levels[0]!.class]
  const classLevel = preview.classes.find((c) => c.id === def?.id)?.level ?? level
  const feat = featsByLevel(level) > featsByLevel(level - 1) || (def?.bonusFeatLevels ?? []).includes(classLevel)
  const arcana = (def?.features ?? []).some((f) => f.level === classLevel && f.choice === 'arcana')
  const sc = def?.spellcasting
  const maxSpellLevel = (sc?.spellsPerDay[classLevel - 1]?.length ?? 0) - 1
  const inBook = (lv: string, name: string) => (before.spellbook[lv] ?? []).includes(name)
  const spellChoices = Object.entries(sc?.list ?? {})
    .filter(([name, lv]) => lv <= maxSpellLevel && !inBook(String(lv), name))
    .map(([name, lv]) => ({ level: String(lv), name }))
  const ranksLeft = preview.skillRanks.available - preview.skillRanks.spent
  const missing: LevelUpMissing[] = []
  if (draft.hp === null) missing.push('hp')
  if (ranksLeft !== 0) missing.push('ranks')
  if (feat && !draft.feat) missing.push('feat')
  if (arcana && !draft.arcana) missing.push('arcana')
  return {
    level,
    hitDie: def?.hitDie ?? 0,
    ranksLeft,
    rankCap: level,
    feat,
    featChoices: Object.keys(rules.feats).filter((id) => !before.feats.some((f) => f.id === id)),
    arcana,
    spells: sc?.spellsPerLevelUp ?? 0,
    spellChoices,
    missing,
  }
}

// El asistente completo: el borrador (vacío si todavía no se tocó nada), la ficha con él aplicado y lo que falta.
// Las ediciones arrancan el borrador solas (startLevelUp), así abrir el asistente no anota nada.
export function levelUpState(json: Character, nb: Notebook, rules: RulesDb) {
  const started = startLevelUp(nb)
  const draft = levelUpDraft(started)!
  const preview = computeSheet(levelUpPreview(json, started), rules)
  return { draft, preview, status: levelUpStatus(applyNotebook(json, nb), preview, draft, rules) }
}

// ± rangos en el borrador, sin pasar los que da el nivel ni el tope por habilidad (= nivel).
export function stepLevelRank(json: Character, nb: Notebook, rules: RulesDb, id: string, by: number): Notebook {
  const { draft, preview, status } = levelUpState(json, nb, rules)
  if (by < 0 && !draft.skills[id]) return nb
  const ranks = preview.skills.find((s) => s.id === id)?.ranks ?? 0
  if (by > 0 && (status.ranksLeft <= 0 || ranks >= status.rankCap)) return nb
  return addLevelRank(startLevelUp(nb), id, by)
}

// --- Respaldo: un texto para copiar y pegar ---
const BACKUP_APP = 'sword-and-thunder'

export const backupText = (nb: Notebook, session: Session): string =>
  JSON.stringify({ app: BACKUP_APP, version: 1, notebook: nb, session: { ...session, undo: null } })

// null si el texto no es un respaldo válido.
export function parseBackup(text: string): { notebook: Notebook; session: Session } | null {
  let json: { app?: unknown; notebook?: unknown; session?: unknown }
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  if (json?.app !== BACKUP_APP) return null
  const notebook = notebookSchema.safeParse(json.notebook)
  const session = parseSessionFields(json.session)
  return notebook.success && session ? { notebook: notebook.data, session: session.session } : null
}
