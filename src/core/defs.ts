import type { Ability, ArmorCategory, ModifierInput, Size, Weapon } from './schema'
import type { BabProgression, SaveProgression } from './rules/pf1e/progression'
import type { ActionKind } from './rules/pf1e/actions'

// Forma de los datos de src/data (clases, razas, dotes). Solo tipos.

export interface RuleCtx {
  level: number // nivel en la clase (para dotes: nivel de personaje)
  mods: Record<Ability, number>
}

export interface FeatureDef {
  id: string
  name: string
  level: number
}

export interface ResourceDef {
  id: string
  name: string
  max: (ctx: RuleCtx) => number
  details?: (ctx: RuleCtx) => Record<string, number>
}

// Otra forma de atacar que da la clase (ej. Spell Combat).
export interface AttackVariantDef {
  id: string
  name: string
  minLevel: number
  appliesTo: (weapon: Weapon) => boolean
  modifiers: ModifierInput[]
}

// Acción de clase para el menú de #/play. Aparece sola desde minLevel.
// kind: 'spell-attack' = ataque con la variante `variant` + un conjuro preparado (Spell Combat, Spellstrike)
//       'enhance-weapon' = gasta `cost` y mejora el arma hasta el detalle maxEnhancement del recurso
//       'spell-recall' = recupera un conjuro lanzado gastando tantos puntos como su nivel
//       'spend' = solo gasta `cost`
// actionType: tipo de acción en el turno (Spell Combat = ronda completa; lo usan las reglas de PG bajos)
export interface ClassActionDef {
  id: string
  name: string
  minLevel: number
  menu: 'attack' | 'pool'
  kind: 'spell-attack' | 'enhance-weapon' | 'spell-recall' | 'spend'
  actionType: ActionKind
  variant?: string
  cost?: { resource: string; amount: number }
}

export interface SpellcastingDef {
  ability: Ability
  tradition: 'arcane' | 'divine'
  kind: 'prepared' | 'spontaneous'
  spellsPerDay: readonly (readonly number[])[] // [nivel de clase - 1][nivel de conjuro]
  armorWithoutFailure?: (level: number) => ArmorCategory | null
}

export interface ClassDef {
  id: string
  name: string
  hitDie: number
  skillRanks: number
  bab: BabProgression
  saves: Record<'fort' | 'ref' | 'will', SaveProgression>
  classSkills: readonly string[] // skill ids base ('craft', no 'craft:alchemy')
  bonusFeatLevels?: readonly number[]
  spellcasting?: SpellcastingDef
  resources?: readonly ResourceDef[]
  attackVariants?: readonly AttackVariantDef[]
  actions?: readonly ClassActionDef[]
  features: readonly FeatureDef[]
}

export interface RaceDef {
  id: string
  name: string
  size: Size
  speed: number
  abilityMods?: Partial<Record<Ability, number>>
  flexibleAbilityBonus?: number // +2 a elección (humano, semielfo, semiorco)
  bonusFeats: number
  skillRanksPerLevel: number
  languages: readonly string[] // los que sabe de entrada
  features: readonly { id: string; name: string }[]
  modifiers?: readonly ModifierInput[]
}

// Las dotes que modifican atributos no están soportadas (los atributos se calculan antes).
export interface FeatDef {
  id: string
  name: string
  modifiers?: readonly ModifierInput[] | ((ctx: RuleCtx) => ModifierInput[])
}

export interface RulesDb {
  classes: Record<string, ClassDef>
  races: Record<string, RaceDef>
  feats: Record<string, FeatDef>
}
