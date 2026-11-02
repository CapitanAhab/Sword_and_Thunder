import type { ModifierInput } from '../../schema'

// Acciones básicas de combate y condiciones que modifican stats (CRB, cap. 8 y apéndice 2).
// La sesión las convierte en modifiers; las vistas nunca suman estos valores por su cuenta.

// Tipo de acción en el turno (lo usan las reglas de PG bajos: core/session.ts → checkAction).
//   'downtime' = fuera del turno (Descansar, Preparar): no gasta acción, pero hace falta estar consciente.
export type ActionKind = 'standard' | 'full' | 'swift' | 'downtime'

// Acciones básicas de combate del menú y su tipo.
export const BASIC_ACTIONS = {
  attack: 'standard',
  'full-attack': 'full',
  charge: 'full', // en un turno restringido es estándar: core/session.ts → chargeKind
  maneuver: 'standard',
  'use-item': 'standard',
  discharge: 'standard', // descargar un toque retenido
  ready: 'standard', // preparar una acción: actuás después, cuando pasa lo que esperás
} satisfies Record<string, ActionKind>

// Acciones básicas que provocan ataques de oportunidad en una casilla amenazada (las dotes "Mejorada"
// que lo evitan en las maniobras no están modeladas).
export const BASIC_AOO: Partial<Record<keyof typeof BASIC_ACTIONS, number>> = { maneuver: 1, 'use-item': 1 }

// Posturas: se excluyen entre sí.
export const STANCES = {
  'fighting-defensively': [
    { target: 'attack', type: 'untyped', value: -4 },
    { target: 'ac', type: 'dodge', value: 2 },
  ],
  'total-defense': [{ target: 'ac', type: 'dodge', value: 4 }],
} satisfies Record<string, ModifierInput[]>
export type StanceId = keyof typeof STANCES

// Carga: siempre presente como condicional ('charge'), así el total sale en stat.conditional.
export const CHARGE: ModifierInput[] = [
  { target: 'attack', type: 'untyped', value: 2, condition: 'charge' },
  { target: 'ac', type: 'untyped', value: -2, condition: 'charge' },
]
// Después de cargar: el −2 a la CA sigue hasta tu próximo turno (el +2 al ataque era solo de esa carga).
export const CHARGED: ModifierInput[] = [{ target: 'ac', type: 'untyped', value: -2 }]

// Solo las condiciones con penalizaciones claras de modelar.
export const CONDITIONS = {
  shaken: [
    { target: 'attack', type: 'untyped', value: -2 },
    { target: 'saves', type: 'untyped', value: -2 },
    { target: 'skills', type: 'untyped', value: -2 },
  ],
  sickened: [
    { target: 'attack', type: 'untyped', value: -2 },
    { target: 'damage', type: 'untyped', value: -2 },
    { target: 'saves', type: 'untyped', value: -2 },
    { target: 'skills', type: 'untyped', value: -2 },
  ],
  fatigued: [
    { target: 'ability.str', type: 'untyped', value: -2 },
    { target: 'ability.dex', type: 'untyped', value: -2 },
  ],
  entangled: [
    { target: 'attack', type: 'untyped', value: -2 },
    { target: 'ability.dex', type: 'untyped', value: -4 },
  ],
  grappled: [
    { target: 'attack', type: 'untyped', value: -2 },
    { target: 'cmb', type: 'untyped', value: -2 },
    { target: 'ability.dex', type: 'untyped', value: -4 },
  ],
  // Tumbado: −4 al ataque cuerpo a cuerpo. La CA cambia según quién ataca (PRONE_AC), así que no va como modifier.
  prone: [{ target: 'attack.melee', type: 'untyped', value: -4 }],
} satisfies Record<string, ModifierInput[]>
export type ConditionId = keyof typeof CONDITIONS

// Tumbado: CA −4 contra cuerpo a cuerpo y +4 contra ataques a distancia. Levantarse es una acción de movimiento que provoca AdO.
export const PRONE_AC = { melee: -4, ranged: 4 } as const

// Condiciones que se van con 8 horas de descanso. Las demás se apagan a mano (pueden durar más que una noche).
export const REST_CLEARS: readonly ConditionId[] = ['fatigued']

// Bonos y penalizadores que te da otro (un aliado, un enemigo) y que se cargan a mano en #/play.
// Los comunes, ya armados (CRB y APG). Los demás se cargan como "Libre" (valores sin tipo).
export const COMMON_EFFECTS = {
  bless: [{ target: 'attack', type: 'morale', value: 1 }], // Bendecir
  flanking: [{ target: 'attack.melee', type: 'untyped', value: 2 }], // Flanqueo: solo cuerpo a cuerpo
  'inspire-courage': [
    { target: 'attack', type: 'competence', value: 1 },
    { target: 'damage', type: 'competence', value: 1 },
  ], // Inspirar coraje (bardo de nivel 1 a 4)
  haste: [
    { target: 'attack', type: 'untyped', value: 1 },
    { target: 'ac', type: 'dodge', value: 1 },
    { target: 'save.ref', type: 'dodge', value: 1 },
  ], // Prisa (el ataque extra y la velocidad no están modelados)
} satisfies Record<string, ModifierInput[]>
export type CommonEffectId = keyof typeof COMMON_EFFECTS

// Valores del modificador "Libre": qué blanco toca cada uno (sin tipo, así se acumulan).
export const FREE_TARGETS = { attack: 'attack', ac: 'ac', damage: 'damage', saves: 'saves' } as const
export type FreeField = keyof typeof FREE_TARGETS

// Condiciones que cambian el movimiento: enredado se mueve a la mitad y no puede cargar; apresado no se mueve;
// tumbado tiene que levantarse primero.
export const HALF_SPEED: readonly ConditionId[] = ['entangled']
export const NO_CHARGE: readonly ConditionId[] = ['grappled', 'entangled', 'prone']
