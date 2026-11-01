import type { Size } from '../../schema'

// mod: CA y ataque. special: CMB/CMD. stealth y fly: skills.
export const SIZE: Record<Size, { mod: number; special: number; stealth: number; fly: number }> = {
  fine: { mod: 8, special: -8, stealth: 16, fly: 8 },
  diminutive: { mod: 4, special: -4, stealth: 12, fly: 6 },
  tiny: { mod: 2, special: -2, stealth: 8, fly: 4 },
  small: { mod: 1, special: -1, stealth: 4, fly: 2 },
  medium: { mod: 0, special: 0, stealth: 0, fly: 0 },
  large: { mod: -1, special: 1, stealth: -4, fly: -2 },
  huge: { mod: -2, special: 2, stealth: -8, fly: -4 },
  gargantuan: { mod: -4, special: 4, stealth: -12, fly: -6 },
  colossal: { mod: -8, special: 8, stealth: -16, fly: -8 },
}
