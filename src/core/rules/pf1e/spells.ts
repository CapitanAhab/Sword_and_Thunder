// Conjuros extra por atributo alto (tabla 1-3 del CRB), para nivel de conjuro ≥ 1.
// Ej.: mod +4 → +1 en niveles 1 a 4.
export function bonusSpells(abilityMod: number, spellLevel: number): number {
  if (spellLevel < 1 || abilityMod < spellLevel) return 0
  return Math.floor((abilityMod - spellLevel) / 4) + 1
}

export const spellDc = (spellLevel: number, abilityMod: number) => 10 + spellLevel + abilityMod

// Alcance de un conjuro en pies según el nivel de lanzador (CRB, cap. 9).
export type SpellRange = 'personal' | 'touch' | 'close' | 'medium' | 'long' | { ft: number }

export function spellRangeFt(range: SpellRange, casterLevel: number): number | null {
  if (typeof range === 'object') return range.ft
  if (range === 'close') return 25 + 5 * Math.floor(casterLevel / 2)
  if (range === 'medium') return 100 + 10 * casterLevel
  if (range === 'long') return 400 + 40 * casterLevel
  return null // personal / toque
}

// Lanzar a la defensiva: chequeo de concentración contra 15 + 2 × nivel del conjuro.
export const defensiveCastingDc = (spellLevel: number) => 15 + 2 * spellLevel

// Otros chequeos de concentración (CRB, cap. 9): enredado, 15 + nivel; apresado, 10 + nivel + BMC del que te apresa;
// si te dañan mientras lanzás, 10 + nivel + el daño. En los dos últimos, una parte se sabe recién en la mesa.
export const entangledCastingDc = (spellLevel: number) => 15 + spellLevel
export const castingDcBase = (spellLevel: number) => 10 + spellLevel

// Qué chequeo de concentración mostrar, del más exigente al de siempre (si te pegan mientras lanzás).
export type ConcentrationCase = 'grappled' | 'defensive' | 'entangled' | 'damage'
export function concentrationCase(conditions: readonly string[], castDefensively: boolean): ConcentrationCase {
  if (conditions.includes('grappled')) return 'grappled'
  if (castDefensively) return 'defensive'
  if (conditions.includes('entangled')) return 'entangled'
  return 'damage'
}

// Ataques de oportunidad que provoca lanzar en una casilla amenazada, por motivo: lanzar (salvo a la defensiva) y,
// aparte, el ataque de toque a distancia (rayos y similares), que provoca aunque se lance a la defensiva.
export interface SpellAoO {
  cast: boolean
  attack: boolean
}
export function spellAoO(attack: 'melee-touch' | 'ranged-touch' | undefined, castDefensively: boolean): SpellAoO {
  return { cast: !castDefensively, attack: attack === 'ranged-touch' }
}

// Daño de un conjuro según el nivel de lanzador. 'cl' = uno por nivel, con tope opcional.
export interface SpellDamage {
  dice: number | 'cl'
  die: number
  maxDice?: number
  bonus?: 'cl'
  maxBonus?: number
}

export function spellDamageText(d: SpellDamage, casterLevel: number): string {
  const dice = d.dice === 'cl' ? Math.min(casterLevel, d.maxDice ?? Infinity) : d.dice
  const bonus = d.bonus === 'cl' ? Math.min(casterLevel, d.maxBonus ?? Infinity) : 0
  return `${Math.max(1, dice)}d${d.die}${bonus ? `+${bonus}` : ''}`
}
