export type BabProgression = 'full' | 'medium' | 'poor'
export type SaveProgression = 'good' | 'poor'

export function baseAttack(p: BabProgression, level: number): number {
  if (p === 'full') return level
  if (p === 'medium') return Math.floor((level * 3) / 4)
  return Math.floor(level / 2)
}

// Multiclase: se suman las salvaciones base de cada clase (regla estándar del CRB).
export function baseSave(p: SaveProgression, level: number): number {
  return p === 'good' ? 2 + Math.floor(level / 2) : Math.floor(level / 3)
}

// BAB +6 → [6, 1]; +11 → [11, 6, 1]. Máximo 4 ataques.
export function iterativeAttacks(bab: number): number[] {
  const out = [bab]
  for (let b = bab - 5; b > 0 && out.length < 4; b -= 5) out.push(b)
  return out
}

// Dotes por nivel de personaje: 1, 3, 5…
export const featsByLevel = (level: number) => Math.ceil(level / 2)
