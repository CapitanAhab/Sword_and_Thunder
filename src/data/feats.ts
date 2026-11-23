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
  // Se prende y apaga en #/play (condición 'power-attack'). −1/+2 y un paso más cada +4 de ataque base.
  // A dos manos el daño es ×1,5: no está modelado.
  'power-attack': {
    id: 'power-attack',
    name: 'Power Attack',
    modifiers: ({ bab }) => {
      const steps = 1 + Math.floor(bab / 4)
      return [
        { target: 'attack.melee', type: 'untyped', value: -steps, condition: 'power-attack' },
        { target: 'cmb', type: 'untyped', value: -steps, condition: 'power-attack' },
        { target: 'damage.melee', type: 'untyped', value: 2 * steps, condition: 'power-attack' },
      ]
    },
  },
}
