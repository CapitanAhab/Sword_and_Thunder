import type { SpellDamage, SpellRange } from '../core/rules/pf1e/spells'
import type { ModifierInput } from '../core/schema'

// Conjuros del spellbook de Furio, con datos y un texto breve propio (no es el texto del libro: OGL / Community Use).
// La clave es el nombre tal como aparece en character.json. El nivel sale del spellbook, no de acá.


export interface SpellDef {
  name: string
  school: string // en inglés, como en el libro
  castingTime: 'standard' | 'round'
  range: SpellRange
  target: string // objetivo, área o efecto
  duration: string
  save: string | null // null = no tiene
  sr: boolean
  summary: string // una línea para el panel de detalle (sin la fórmula de daño: esa sale de `damage`)
  text: string // tarjeta completa
  attack?: 'melee-touch' | 'ranged-touch'
  charges?: 'one' | 'perLevel' // toque cuerpo a cuerpo: la carga queda en la mano hasta pegar
  damage?: SpellDamage & { type: string }
  scaling?: string // cómo escala el daño (tarjeta)
  buff?: ModifierInput[] // al lanzarlo queda activo sumando esto (ESTADO › Efectos activos para apagarlo)
  roundsPerLevel?: number // duración del buff en rondas por nivel de lanzador (1 min/nivel = 10); vence sola en combate
}

const INSTANT = 'Instantánea'

export const spells: Record<string, SpellDef> = {
  // --- Trucos ---
  'Acid Splash': {
    name: 'Acid Splash', school: 'Conjuration (creation) [acid]', castingTime: 'standard', range: 'close',
    target: 'Un proyectil de ácido', duration: INSTANT, save: null, sr: false,
    summary: 'Bola de ácido a distancia',
    attack: 'ranged-touch', damage: { dice: 1, die: 3, type: 'ácido' },
    text: 'Lanzás una bola de ácido. Hacé un ataque de toque a distancia: si pega, 1d3 de daño por ácido.',
  },
  'Arcane Mark': {
    name: 'Arcane Mark', school: 'Universal', castingTime: 'standard', range: 'touch',
    target: 'Una runa o marca personal (hasta 1 pie²)',
    duration: 'Permanente', save: null, sr: false,
    summary: 'Grabás tu marca personal en un objeto o criatura',
    text: 'Dejás tu símbolo personal, visible o invisible, sobre cualquier superficie sin dañarla. Detectar magia lo revela.',
  },
  'Dancing Lights': {
    name: 'Dancing Lights', school: 'Evocation [light]', castingTime: 'standard', range: 'medium',
    target: 'Hasta cuatro luces en un radio de 10 pies',
    duration: '1 minuto', save: null, sr: false,
    summary: 'Hasta 4 luces que movés a voluntad',
    text: 'Creás luces flotantes (o una figura vagamente humana que brilla) y las movés hasta 100 pies por ronda.',
  },
  Daze: {
    name: 'Daze', school: 'Enchantment (compulsion) [mind-affecting]', castingTime: 'standard', range: 'close',
    target: 'Un humanoide de 4 DG o menos', duration: '1 ronda',
    save: 'Voluntad anula', sr: true,
    summary: 'Atonta 1 ronda a un humanoide de 4 DG o menos',
    text: 'El objetivo queda atontado y pierde su próxima acción. Después queda inmune a este conjuro por 1 minuto.',
  },
  'Detect Magic': {
    name: 'Detect Magic', school: 'Divination', castingTime: 'standard', range: { ft: 60 },
    target: 'Emanación en cono',
    duration: 'Concentración, hasta 1 min/nivel', save: null, sr: false,
    summary: 'Detecta auras mágicas en un cono',
    text: '1.ª ronda: si hay magia. 2.ª: cuántas auras y la más fuerte. 3.ª: fuerza y ubicación de cada una (Conocimiento de conjuros para la escuela).',
  },
  'Disrupt Undead': {
    name: 'Disrupt Undead', school: 'Necromancy', castingTime: 'standard', range: 'close',
    target: 'Rayo', duration: INSTANT, save: null, sr: true,
    summary: 'Rayo de energía positiva, solo muertos vivientes',
    attack: 'ranged-touch', damage: { dice: 1, die: 6, type: 'energía positiva' },
    text: 'Ataque de toque a distancia con un rayo de energía positiva: 1d6 de daño, solo contra muertos vivientes.',
  },
  Flare: {
    name: 'Flare', school: 'Evocation [light]', castingTime: 'standard', range: 'close',
    target: 'Estallido de luz', duration: INSTANT, save: 'Fortaleza anula', sr: true,
    summary: 'Deslumbra 1 minuto a una criatura',
    text: 'Un destello frente a una criatura que ve: queda deslumbrada (−1 a ataques) 1 minuto. No afecta a ciegos.',
  },
  'Ghost Sound': {
    name: 'Ghost Sound', school: 'Illusion (figment)', castingTime: 'standard', range: 'close',
    target: 'Sonidos ilusorios', duration: '1 ronda/nivel',
    save: 'Voluntad descree', sr: false,
    summary: 'Sonidos ilusorios (voces, pasos, rugidos)',
    text: 'Creás ruidos que suben, bajan o se mueven. El volumen máximo equivale a unas 4 personas por nivel.',
  },
  Light: {
    name: 'Light', school: 'Evocation [light]', castingTime: 'standard', range: 'touch',
    target: 'Objeto tocado', duration: '10 min/nivel', save: null, sr: false,
    summary: 'Un objeto brilla como una antorcha',
    text: 'El objeto da luz normal en 20 pies (y sube un paso la luz 20 pies más allá). Solo uno activo a la vez.',
  },
  'Mage Hand': {
    name: 'Mage Hand', school: 'Transmutation', castingTime: 'standard', range: 'close',
    target: 'Objeto no mágico y sin dueño de hasta 2,5 kg',
    duration: 'Concentración', save: null, sr: false,
    summary: 'Movés un objeto chico a distancia',
    text: 'Levantás y movés el objeto hasta 15 pies por ronda mientras te concentrás.',
  },
  'Open/Close': {
    name: 'Open/Close', school: 'Transmutation', castingTime: 'standard', range: 'close',
    target: 'Objeto o portal de hasta 15 kg', duration: INSTANT,
    save: 'Voluntad anula (objeto)', sr: true,
    summary: 'Abre o cierra una puerta, cofre o tapa',
    text: 'Abrís o cerrás algo a distancia. No sirve con cerraduras, trabas ni barras.',
  },
  Prestidigitation: {
    name: 'Prestidigitation', school: 'Universal', castingTime: 'standard', range: { ft: 10 },
    target: 'Ver texto', duration: '1 hora', save: null, sr: false,
    summary: 'Trucos menores: limpiar, calentar, saborizar…',
    text: 'Efectos menores durante una hora: limpiar o ensuciar, enfriar o calentar, dar sabor, crear baratijas. No hace daño.',
  },
  'Ray of Frost': {
    name: 'Ray of Frost', school: 'Evocation [cold]', castingTime: 'standard', range: 'close',
    target: 'Rayo', duration: INSTANT, save: null, sr: true,
    summary: 'Rayo helado',
    attack: 'ranged-touch', damage: { dice: 1, die: 3, type: 'frío' },
    text: 'Ataque de toque a distancia con un rayo helado: 1d3 de daño por frío.',
  },
  'Read Magic': {
    name: 'Read Magic', school: 'Divination', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '10 min/nivel', save: null, sr: false,
    summary: 'Leés pergaminos y libros de conjuros ajenos',
    text: 'Descifrás inscripciones mágicas. Una vez leída, esa escritura ya la entendés sin el conjuro.',
  },
  Spark: {
    name: 'Spark', school: 'Evocation [fire]', castingTime: 'standard', range: 'close',
    target: 'Un objeto diminuto', duration: INSTANT,
    save: 'Fortaleza anula (objeto)', sr: true,
    summary: 'Prende fuego algo chico (mecha, yesca)',
    text: 'Hacés saltar una chispa que enciende un objeto inflamable muy chico.',
  },

  // --- Nivel 1 ---
  'Shocking Grasp': {
    name: 'Shocking Grasp', school: 'Evocation [electricity]', castingTime: 'standard', range: 'touch',
    target: 'Criatura u objeto tocado', duration: INSTANT, save: null, sr: true,
    summary: '+3 al ataque si el blanco lleva metal',
    attack: 'melee-touch', charges: 'one', damage: { dice: 'cl', die: 6, maxDice: 5, type: 'electricidad' },
    scaling: '1d6 por nivel (máx. 5d6)',
    text: 'Ataque de toque cuerpo a cuerpo: 1d6 de electricidad por nivel (máx. 5d6). +3 al ataque si el blanco lleva armadura de metal, es de metal o lleva mucho metal. Ideal con Impacto con conjuro.',
  },
  Frostbite: {
    name: 'Frostbite', school: 'Transmutation [cold]', castingTime: 'standard', range: 'touch',
    target: 'Criatura tocada', duration: INSTANT, save: null, sr: true,
    summary: 'Fatiga al blanco · un toque por nivel',
    attack: 'melee-touch', charges: 'perLevel', damage: { dice: 1, die: 6, bonus: 'cl', maxBonus: 10, type: 'frío' },
    scaling: '1d6 +1 por nivel (máx. +10)',
    text: 'Ataque de toque: 1d6 de frío +1 por nivel (máx. +10) y el blanco queda fatigado. Guarda un toque por nivel hasta usarlos.',
  },
  'Corrosive Touch': {
    name: 'Corrosive Touch', school: 'Conjuration (creation) [acid]', castingTime: 'standard', range: 'touch',
    target: 'Criatura tocada', duration: INSTANT, save: null, sr: false,
    summary: 'Ácido, sin resistencia a conjuros',
    attack: 'melee-touch', charges: 'one', damage: { dice: 'cl', die: 4, maxDice: 5, type: 'ácido' },
    scaling: '1d4 por nivel (máx. 5d4)',
    text: 'Ataque de toque cuerpo a cuerpo: 1d4 de ácido por nivel (máx. 5d4). No permite resistencia a conjuros.',
  },
  Shield: {
    name: 'Shield', school: 'Abjuration [force]', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 min/nivel', save: null, sr: false,
    summary: '+4 escudo a la CA · anula Proyectil mágico',
    buff: [{ target: 'ac', type: 'shield', value: 4 }],
    roundsPerLevel: 10,
    text: 'Un disco de fuerza te protege: +4 de escudo a la CA (sin penalizador ni fallo arcano) y bloquea Proyectil mágico.',
  },
  Vanish: {
    name: 'Vanish', school: 'Illusion (glamer)', castingTime: 'standard', range: 'touch',
    target: 'Criatura tocada', duration: '1 ronda/nivel (máx. 5)',
    save: 'Voluntad anula (inofensivo)', sr: true,
    summary: 'Invisible unas rondas (se corta si atacás)',
    text: 'Como Invisibilidad pero corto: hasta 5 rondas. Si el blanco ataca, el efecto termina.',
  },
  Grease: {
    name: 'Grease', school: 'Conjuration (creation)', castingTime: 'standard', range: 'close',
    target: 'Un objeto o un cuadrado de 10 pies', duration: '1 min/nivel',
    save: 'Reflejos parcial', sr: false,
    summary: 'Superficie resbalosa: Reflejos o caer',
    text: 'Cubrís el piso o un objeto de grasa. Quien la cruza hace Reflejos o cae; moverse pide Acrobacias. Un objeto engrasado se puede soltar.',
  },
  'Enlarge Person': {
    name: 'Enlarge Person', school: 'Transmutation', castingTime: 'round', range: 'close',
    target: 'Un humanoide', duration: '1 min/nivel',
    save: 'Fortaleza anula', sr: true,
    summary: 'Grande: +2 FUE, −2 DES, −1 ataque y CA, alcance',
    text: 'El humanoide pasa a tamaño Grande: +2 FUE, −2 DES, −1 al ataque y a la CA, y más alcance. Su equipo crece con él.',
  },
}

// Modifiers de los buffs por nombre de conjuro (para toSessionContext).
export const spellBuffs: Record<string, ModifierInput[]> = Object.fromEntries(
  Object.values(spells).flatMap((sp): [string, ModifierInput[]][] => (sp.buff ? [[sp.name, sp.buff]] : [])),
)
