import type { ModifierType } from '../../modifiers'
import type { ArmorCategory, WeaponCategory } from '../../schema'

// La CA de toque ignora armadura, escudo y armadura natural.
export const TOUCH_EXCLUDED: ReadonlySet<ModifierType> = new Set(['armor', 'shield', 'natural-armor'])

// Bonos a la CA que también suman a la CMD.
export const CMD_AC_TYPES: ReadonlySet<ModifierType> = new Set([
  'circumstance', 'deflection', 'dodge', 'insight', 'luck', 'morale', 'profane', 'sacred',
])

export const ARMOR_RANK: Record<ArmorCategory, number> = { light: 1, medium: 2, heavy: 3 }

// Velocidad con armadura media o pesada (tabla del CRB).
const ARMORED_SPEED: Record<number, number> = { 15: 10, 20: 15, 30: 20, 40: 30, 50: 35, 60: 40 }
export const armoredSpeed = (base: number) => ARMORED_SPEED[base] ?? Math.floor((base * 2) / 3 / 5) * 5

export const isMelee = (c: WeaponCategory) => c === 'light' || c === 'one-handed' || c === 'two-handed'

// FUE al daño: a dos manos ×1.5 (solo si es positiva). A distancia no se suma
// (no se modelan arcos compuestos ni la penalización de FUE en hondas/arcos).
export function strToDamage(c: WeaponCategory, strMod: number): number {
  if (c === 'ranged') return 0
  if (c === 'two-handed' && strMod > 0) return Math.floor(strMod * 1.5)
  return strMod
}
