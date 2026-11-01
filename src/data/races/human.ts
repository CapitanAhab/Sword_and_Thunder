import type { RaceDef } from '../../core/defs'

export const human: RaceDef = {
  id: 'human',
  name: 'Human',
  size: 'medium',
  speed: 30,
  flexibleAbilityBonus: 2,
  bonusFeats: 1,
  skillRanksPerLevel: 1,
  languages: ['Common'],
  features: [
    { id: 'bonus-feat', name: 'Bonus Feat' },
    { id: 'skilled', name: 'Skilled' },
  ],
}
