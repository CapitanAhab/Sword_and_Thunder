import type { Ability } from '../../schema'

export interface SkillDef {
  id: string
  name: string
  ability: Ability
  trainedOnly: boolean
  acp: boolean // le aplica la penalización de armadura
  subtypes?: boolean // Craft, Perform, Profession: 'craft:alchemy'
}

const s = (id: string, name: string, ability: Ability, trainedOnly = false, acp = false, subtypes = false): SkillDef =>
  ({ id, name, ability, trainedOnly, acp, subtypes })

export const SKILLS: readonly SkillDef[] = [
  s('acrobatics', 'Acrobatics', 'dex', false, true),
  s('appraise', 'Appraise', 'int'),
  s('bluff', 'Bluff', 'cha'),
  s('climb', 'Climb', 'str', false, true),
  s('craft', 'Craft', 'int', false, false, true),
  s('diplomacy', 'Diplomacy', 'cha'),
  s('disable-device', 'Disable Device', 'dex', true, true),
  s('disguise', 'Disguise', 'cha'),
  s('escape-artist', 'Escape Artist', 'dex', false, true),
  s('fly', 'Fly', 'dex', false, true),
  s('handle-animal', 'Handle Animal', 'cha', true),
  s('heal', 'Heal', 'wis'),
  s('intimidate', 'Intimidate', 'cha'),
  s('knowledge-arcana', 'Knowledge (arcana)', 'int', true),
  s('knowledge-dungeoneering', 'Knowledge (dungeoneering)', 'int', true),
  s('knowledge-engineering', 'Knowledge (engineering)', 'int', true),
  s('knowledge-geography', 'Knowledge (geography)', 'int', true),
  s('knowledge-history', 'Knowledge (history)', 'int', true),
  s('knowledge-local', 'Knowledge (local)', 'int', true),
  s('knowledge-nature', 'Knowledge (nature)', 'int', true),
  s('knowledge-nobility', 'Knowledge (nobility)', 'int', true),
  s('knowledge-planes', 'Knowledge (planes)', 'int', true),
  s('knowledge-religion', 'Knowledge (religion)', 'int', true),
  s('linguistics', 'Linguistics', 'int', true),
  s('perception', 'Perception', 'wis'),
  s('perform', 'Perform', 'cha', false, false, true),
  s('profession', 'Profession', 'wis', true, false, true),
  s('ride', 'Ride', 'dex', false, true),
  s('sense-motive', 'Sense Motive', 'wis'),
  s('sleight-of-hand', 'Sleight of Hand', 'dex', true, true),
  s('spellcraft', 'Spellcraft', 'int', true),
  s('stealth', 'Stealth', 'dex', false, true),
  s('survival', 'Survival', 'wis'),
  s('swim', 'Swim', 'str', false, true),
  s('use-magic-device', 'Use Magic Device', 'cha', true),
]

export const SKILL_BY_ID: ReadonlyMap<string, SkillDef> = new Map(SKILLS.map((d) => [d.id, d]))

// 'craft:alchemy' → { baseId: 'craft', subtype: 'alchemy' }
export function splitSkillKey(key: string): { baseId: string; subtype?: string } {
  const i = key.indexOf(':')
  return i < 0 ? { baseId: key } : { baseId: key.slice(0, i), subtype: key.slice(i + 1) }
}
