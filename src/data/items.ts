import type { ModifierInput } from '../core/schema'
import type { ItemRules } from '../core/session'

// Lo que hace cada objeto usable, por el id del JSON del personaje (el JSON solo dice cuántos hay).
// Un objeto que no está acá se usa y se descuenta, sin nada más.
export interface ItemDef extends ItemRules {
  buff?: ModifierInput[] // al usarlo queda activo sumando esto (Personaje › Efectos activos para apagarlo)
}

export const items: Record<string, ItemDef> = {
  // Cura con un dado físico: después de tomarla se abre el editor de PG para sumar lo que salió
  'potion-cure-light-wounds': { heals: true },
  // 3 minutos = 30 rondas. Atacar a quien no te ve: +2; se corta al atacar o lanzar sobre alguien.
  'potion-invisibility': { buff: [{ target: 'attack', type: 'untyped', value: 2 }], rounds: 30, endsOnAttack: true },
}

// Modifiers de los buffs de objetos por id (para toSessionContext, junto con los de los conjuros).
export const itemBuffs: Record<string, ModifierInput[]> = Object.fromEntries(
  Object.entries(items).flatMap(([id, it]): [string, ModifierInput[]][] => (it.buff ? [[id, it.buff]] : [])),
)

// Efectos que se cortan al atacar (core: afterAction).
export const endsOnAttack: string[] = Object.entries(items).flatMap(([id, it]) => (it.endsOnAttack ? [id] : []))
