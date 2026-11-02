import type { BonusType, Target } from './schema'

// Además de los tipos del libro, dos internos que siempre se acumulan:
// 'base' (10 de la CA, BAB, rangos, salvación base…) y 'ability' (mod. de atributo).
export type ModifierType = BonusType | 'base' | 'ability'

export interface Modifier {
  target: Target
  type: ModifierType
  value: number
  source: string // nombre de regla/ítem, o id interno ('base', 'bab', 'ranks', 'dex'…)
  condition?: string
}

export interface ConditionalTotal {
  condition: string
  total: number // total si la condición está activa
  modifiers: Modifier[]
}

export interface Stat {
  total: number
  applied: Modifier[] // lo que suma
  ignored: Modifier[] // bonos que no se acumulan con otro mayor del mismo tipo
  conditional: ConditionalTotal[]
}

const ALWAYS_STACK = new Set<ModifierType>(['base', 'ability'])
const STACK_BY_SOURCE = new Set<ModifierType>(['circumstance', 'dodge', 'untyped'])

// Stacking de PF1e: del mismo tipo gana el mayor. Circumstance, dodge y untyped se acumulan si vienen de distinta
// fuente (de la misma, gana el mayor). Los internos y las penalizaciones siempre se acumulan.
export function stack(mods: readonly Modifier[]): { total: number; applied: Modifier[]; ignored: Modifier[] } {
  const stackKey = (m: Modifier) => (STACK_BY_SOURCE.has(m.type) ? `${m.type}:${m.source}` : m.type)
  const winners = new Map<string, Modifier>()
  for (const m of mods) {
    if (m.value < 0 || ALWAYS_STACK.has(m.type)) continue
    const prev = winners.get(stackKey(m))
    if (!prev || m.value > prev.value) winners.set(stackKey(m), m)
  }
  const applied: Modifier[] = []
  const ignored: Modifier[] = []
  for (const m of mods) {
    if (m.value < 0 || ALWAYS_STACK.has(m.type) || winners.get(stackKey(m)) === m) applied.push(m)
    else ignored.push(m)
  }
  return { total: applied.reduce((n, m) => n + m.value, 0), applied, ignored }
}

const isActive = (m: Modifier, active: readonly string[]) =>
  !m.condition || m.condition.split('|').some((c) => active.includes(c))

export function makeStat(mods: readonly Modifier[], active: readonly string[] = []): Stat {
  const on = mods.filter((m) => isActive(m, active))
  const off = mods.filter((m) => !isActive(m, active))
  const base = stack(on)
  const conditions = [...new Set(off.map((m) => m.condition ?? ''))]
  const conditional = conditions.map((condition) => {
    const extra = off.filter((m) => m.condition === condition)
    return { condition, total: stack([...on, ...extra]).total, modifiers: extra }
  })
  return { total: base.total, applied: base.applied, ignored: base.ignored, conditional }
}

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
