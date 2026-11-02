import type { Size } from '../../schema'
import { armoredSpeed } from './combat'

// Capacidad de carga (tabla del libro, en libras): [ligera, media, pesada] = máximo de cada una, por FUE 1–29.
// Desde 30, cada +10 de FUE multiplica por 4 la de 10 menos.
const CARRY_LB: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [3, 6, 10], [6, 13, 20], [10, 20, 30], [13, 26, 40], [16, 33, 50],
  [20, 40, 60], [23, 46, 70], [26, 53, 80], [30, 60, 90], [33, 66, 100],
  [38, 76, 115], [43, 86, 130], [50, 100, 150], [58, 116, 175], [66, 133, 200],
  [76, 153, 230], [86, 173, 260], [100, 200, 300], [116, 233, 350], [133, 266, 400],
  [153, 306, 460], [173, 346, 520], [200, 400, 600], [233, 466, 700], [266, 533, 800],
  [306, 613, 920], [346, 693, 1040], [400, 800, 1200], [466, 933, 1400],
]

// Criaturas bípedas: la carga se multiplica según el tamaño.
const SIZE_FACTOR: Record<Size, number> = {
  fine: 1 / 8, diminutive: 1 / 4, tiny: 1 / 2, small: 3 / 4, medium: 1, large: 2, huge: 4, gargantuan: 8, colossal: 16,
}

// Los pesos se anotan en kg, como en el libro en castellano, que usa la mitad de las libras (1 lb = 0,5 kg).
const LB_TO_KG = 0.5

export type LoadCategory = 'light' | 'medium' | 'heavy' | 'over'
// maxDex / acp: lo que impone la carga (null / 0 en ligera). Con armadura vale el peor de los dos, no se suman.
export type Load = { carried: number; light: number; medium: number; heavy: number; category: LoadCategory; maxDex: number | null; acp: number }

// Efectos de la carga (tabla del libro). La sobrecarga se trata como pesada (y solo deja moverse 5 pies).
const LOAD_LIMITS: Record<LoadCategory, { maxDex: number | null; acp: number }> = {
  light: { maxDex: null, acp: 0 },
  medium: { maxDex: 3, acp: -3 },
  heavy: { maxDex: 1, acp: -6 },
  over: { maxDex: 1, acp: -6 },
}

// Velocidad con esa carga: media y pesada, como la armadura media (30 → 20, 20 → 15); sobrecarga, 5 pies.
export function loadedSpeed(base: number, category: LoadCategory): number {
  if (category === 'light') return base
  return category === 'over' ? 5 : armoredSpeed(base)
}

function carryLb(str: number): readonly [number, number, number] {
  if (str <= 0) return [0, 0, 0]
  if (str < CARRY_LB.length) return CARRY_LB[str]!
  const [l, m, h] = carryLb(str - 10)
  return [l * 4, m * 4, h * 4]
}

// carried: peso total en kg. Devuelve los topes de cada carga en kg y en cuál está.
export function computeLoad(str: number, size: Size, carried: number): Load {
  const [l, m, h] = carryLb(str).map((lb) => lb * SIZE_FACTOR[size] * LB_TO_KG) as [number, number, number]
  const category: LoadCategory = carried <= l ? 'light' : carried <= m ? 'medium' : carried <= h ? 'heavy' : 'over'
  return { carried, light: l, medium: m, heavy: h, category, ...LOAD_LIMITS[category] }
}
