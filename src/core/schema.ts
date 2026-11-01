import { z } from 'zod'

// Schema de character.json. Los tipos salen de acá (z.infer); no se duplican a mano.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export const abilitySchema = z.enum(ABILITIES)
export type Ability = z.infer<typeof abilitySchema>

export const SIZES = ['fine', 'diminutive', 'tiny', 'small', 'medium', 'large', 'huge', 'gargantuan', 'colossal'] as const
export const sizeSchema = z.enum(SIZES)
export type Size = z.infer<typeof sizeSchema>

export const armorCategorySchema = z.enum(['light', 'medium', 'heavy'])
export type ArmorCategory = z.infer<typeof armorCategorySchema>

// Tipos de bono de PF1e que se pueden escribir en el JSON (los internos están en modifiers.ts).
export const BONUS_TYPES = [
  'alchemical', 'armor', 'circumstance', 'competence', 'deflection', 'dodge', 'enhancement', 'inherent',
  'insight', 'luck', 'morale', 'natural-armor', 'profane', 'racial', 'resistance', 'sacred', 'shield',
  'size', 'trait', 'untyped',
] as const
export const bonusTypeSchema = z.enum(BONUS_TYPES)
export type BonusType = z.infer<typeof bonusTypeSchema>

const FIXED_TARGETS = [
  'ability.str', 'ability.dex', 'ability.con', 'ability.int', 'ability.wis', 'ability.cha',
  'hp', 'initiative', 'ac', 'saves', 'save.fort', 'save.ref', 'save.will',
  'attack', 'attack.melee', 'attack.ranged', 'damage', 'damage.melee', 'damage.ranged',
  'cmb', 'cmd', 'skills', 'concentration', 'caster-level', 'speed',
] as const
// 'skill.perception', 'skill.craft:alchemy', 'resource.arcane-pool'…
export const targetSchema = z.union([
  z.enum(FIXED_TARGETS),
  z.templateLiteral(['skill.', z.string()]),
  z.templateLiteral(['resource.', z.string()]),
])
export type Target = z.infer<typeof targetSchema>

// Modifier tal como se escribe en el JSON o en src/data. La fuente la pone quien lo carga.
// condition: si está, no suma al total; se muestra aparte. Varias condiciones se separan con '|'.
export const modifierInputSchema = z.object({
  target: targetSchema,
  type: bonusTypeSchema.default('untyped'),
  value: z.number().int(),
  condition: z.string().optional(),
})
export type ModifierInput = z.infer<typeof modifierInputSchema>

const levelSchema = z.object({
  class: z.string(),
  hp: z.number().int().positive(), // lo que dio el dado de golpe en ese nivel, sin CON
  fcb: z.enum(['hp', 'skill', 'alt']).nullable().default(null), // 'alt' = alternativa racial, no se calcula
  abilityIncrease: abilitySchema.optional(), // solo en niveles 4, 8, 12…
})

const featSchema = z.object({
  id: z.string(),
  param: z.string().optional(), // ej. Weapon Focus (longsword)
})

const traitSchema = z.object({
  name: z.string(),
  notes: z.string().optional(),
  modifiers: z.array(modifierInputSchema).default([]),
})

const armorSchema = z.object({
  name: z.string(),
  category: armorCategorySchema,
  armorBonus: z.number().int().nonnegative(),
  maxDex: z.number().int().nullable().default(null), // null = sin límite
  armorCheckPenalty: z.number().int().max(0).default(0), // como en el libro: -2
  arcaneSpellFailure: z.number().int().min(0).max(100).default(0), // %
  enhancement: z.number().int().nonnegative().default(0),
  masterwork: z.boolean().default(false),
})

const shieldSchema = z.object({
  name: z.string(),
  shieldBonus: z.number().int().nonnegative(),
  maxDex: z.number().int().nullable().default(null),
  armorCheckPenalty: z.number().int().max(0).default(0),
  arcaneSpellFailure: z.number().int().min(0).max(100).default(0),
  enhancement: z.number().int().nonnegative().default(0),
  masterwork: z.boolean().default(false),
})

export const weaponCategorySchema = z.enum(['light', 'one-handed', 'two-handed', 'ranged', 'thrown'])
export type WeaponCategory = z.infer<typeof weaponCategorySchema>

const weaponSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: weaponCategorySchema,
  damage: z.string(), // dados, ej. "1d8"
  critical: z.string().default('20/x2'),
  damageType: z.string().optional(), // S, P, B
  range: z.number().int().positive().optional(), // incremento en ft
  enhancement: z.number().int().nonnegative().default(0),
  masterwork: z.boolean().default(false),
  notes: z.string().optional(),
})
export type Weapon = z.infer<typeof weaponSchema>

// Los modifiers de un ítem aplican si está equipado y no es consumible.
const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.string().optional(),
  quantity: z.number().int().nonnegative().default(1),
  equipped: z.boolean().default(true),
  consumable: z.boolean().default(false),
  notes: z.string().optional(),
  modifiers: z.array(modifierInputSchema).default([]),
})

export const characterSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string(),
  race: z.string(),
  racialAbilityChoice: abilitySchema.optional(), // para razas con +2 a elección (humano)
  size: sizeSchema.optional(), // si falta, el de la raza
  alignment: z.string().default(''),
  abilities: z.record(abilitySchema, z.number().int().nonnegative()), // puntuaciones base, sin raza
  levels: z.array(levelSchema).min(1),
  feats: z.array(featSchema).default([]),
  traits: z.array(traitSchema).default([]),
  languages: z.array(z.string()).default([]), // los que elige el jugador, además de los de la raza
  xp: z.number().int().nonnegative().default(0),
  xpTrack: z.enum(['slow', 'medium', 'fast']).default('medium'),
  skills: z.record(z.string(), z.number().int().nonnegative()).default({}), // rangos por skill id
  equipment: z
    .object({
      armor: armorSchema.optional(),
      shield: shieldSchema.optional(),
      weapons: z.array(weaponSchema).default([]),
      items: z.array(itemSchema).default([]),
    })
    .default({ weapons: [], items: [] }),
  spellbook: z.record(z.string(), z.array(z.string())).default({}), // { "0": [...], "1": [...] }
  // Preparación con la que arranca una sesión nueva de #/play. Mismo formato que spellbook; repetir un nombre = ×2.
  defaultPrepared: z.record(z.string(), z.array(z.string())).default({}),
  wealth: z
    .object({
      pp: z.number().int().nonnegative().default(0),
      gp: z.number().int().nonnegative().default(0),
      sp: z.number().int().nonnegative().default(0),
      cp: z.number().int().nonnegative().default(0),
    })
    .default({ pp: 0, gp: 0, sp: 0, cp: 0 }),
  notes: z.string().optional(),
})
export type Character = z.infer<typeof characterSchema>
export type CharacterInput = z.input<typeof characterSchema>

export type ParseResult = { ok: true; character: Character } | { ok: false; errors: string[] }

export function parseCharacter(json: unknown): ParseResult {
  const result = characterSchema.safeParse(json)
  if (result.success) return { ok: true, character: result.data }
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`),
  }
}
