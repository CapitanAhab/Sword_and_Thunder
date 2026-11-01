import type { FeatDef } from '../core/defs'

export const feats: Record<string, FeatDef> = {
  'combat-casting': {
    id: 'combat-casting',
    name: 'Combat Casting',
    modifiers: [{ target: 'concentration', type: 'untyped', value: 4, condition: 'casting-defensively|grappled' }],
  },
  'improved-initiative': {
    id: 'improved-initiative',
    name: 'Improved Initiative',
    modifiers: [{ target: 'initiative', type: 'untyped', value: 4 }],
  },
}
