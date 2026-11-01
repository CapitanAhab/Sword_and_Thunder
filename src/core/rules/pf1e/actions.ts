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
  charge: 'full', // la carga restringida (incapacitado) no está modelada
  maneuver: 'standard',
  'use-item': 'standard',
  discharge: 'standard', // descargar un toque retenido
} satisfies Record<string, ActionKind>

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
} satisfies Record<string, ModifierInput[]>
export type ConditionId = keyof typeof CONDITIONS
