import { z } from 'zod'
import { itemSchema, type Character } from './schema'
import { parseSessionFields, type Session } from './session'

// Libreta: lo que el jugador anota en la mesa (XP, oro, notas, inventario). Guarda cambios sobre character.json,
// que nunca se toca. Vive en el navegador, separada de la sesión. Funciones puras.

export const COINS = ['pp', 'gp', 'sp', 'cp'] as const
export type Coin = (typeof COINS)[number]

const delta = z.number().int().default(0)

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
})
export type Notebook = z.infer<typeof notebookSchema>

export const emptyNotebook = (): Notebook => notebookSchema.parse({ version: 1 })

// El personaje con lo anotado encima. Con la libreta vacía, los mismos datos que el JSON.
export function applyNotebook(character: Character, nb: Notebook): Character {
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
