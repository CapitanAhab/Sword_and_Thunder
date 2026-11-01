import type { SpellDamage, SpellRange } from '../core/rules/pf1e/spells'
import type { ModifierInput } from '../core/schema'

// Conjuros del spellbook de Furio, con datos y un texto breve propio (no es el texto del libro: OGL / Community Use).
// La clave es el nombre tal como aparece en character.json. El nivel sale del spellbook, no de acá.

export interface L10n {
  es: string
  en: string
}

export interface SpellDef {
  name: string
  school: string // en inglés, como en el libro
  castingTime: 'standard' | 'round'
  range: SpellRange
  target: L10n // objetivo, área o efecto
  duration: L10n
  save: L10n | null // null = no tiene
  sr: boolean
  summary: L10n // una línea para el panel de detalle (sin la fórmula de daño: esa sale de `damage`)
  text: L10n // tarjeta completa
  attack?: 'melee-touch' | 'ranged-touch'
  charges?: 'one' | 'perLevel' // toque cuerpo a cuerpo: la carga queda en la mano hasta pegar
  damage?: SpellDamage & { type: L10n }
  scaling?: L10n // cómo escala el daño (tarjeta)
  buff?: ModifierInput[] // al lanzarlo queda activo sumando esto (ESTADO › Efectos activos para apagarlo)
  roundsPerLevel?: number // duración del buff en rondas por nivel de lanzador (1 min/nivel = 10); vence sola en combate
}

const l = (es: string, en: string): L10n => ({ es, en })
const INSTANT = l('Instantánea', 'Instantaneous')

export const spells: Record<string, SpellDef> = {
  // --- Trucos ---
  'Acid Splash': {
    name: 'Acid Splash', school: 'Conjuration (creation) [acid]', castingTime: 'standard', range: 'close',
    target: l('Un proyectil de ácido', 'One missile of acid'), duration: INSTANT, save: null, sr: false,
    summary: l('Bola de ácido a distancia', 'Orb of acid at range'),
    attack: 'ranged-touch', damage: { dice: 1, die: 3, type: l('ácido', 'acid') },
    text: l('Lanzás una bola de ácido. Hacé un ataque de toque a distancia: si pega, 1d3 de daño por ácido.',
      'You hurl an orb of acid. Make a ranged touch attack: on a hit it deals 1d3 acid damage.'),
  },
  'Arcane Mark': {
    name: 'Arcane Mark', school: 'Universal', castingTime: 'standard', range: 'touch',
    target: l('Una runa o marca personal (hasta 1 pie²)', 'One personal rune or mark (up to 1 sq. ft.)'),
    duration: l('Permanente', 'Permanent'), save: null, sr: false,
    summary: l('Grabás tu marca personal en un objeto o criatura', 'Inscribe your personal mark on an object or creature'),
    text: l('Dejás tu símbolo personal, visible o invisible, sobre cualquier superficie sin dañarla. Detect Magic lo revela.',
      'You leave your personal sigil, visible or invisible, on any surface without harming it. Detect Magic reveals it.'),
  },
  'Dancing Lights': {
    name: 'Dancing Lights', school: 'Evocation [light]', castingTime: 'standard', range: 'medium',
    target: l('Hasta cuatro luces en un radio de 10 pies', 'Up to four lights within a 10-ft. radius'),
    duration: l('1 minuto', '1 minute'), save: null, sr: false,
    summary: l('Hasta 4 luces que movés a voluntad', 'Up to 4 lights you move at will'),
    text: l('Creás luces flotantes (o una figura vagamente humana que brilla) y las movés hasta 100 pies por ronda.',
      'You create floating lights (or a faintly glowing humanoid shape) and move them up to 100 ft. per round.'),
  },
  Daze: {
    name: 'Daze', school: 'Enchantment (compulsion) [mind-affecting]', castingTime: 'standard', range: 'close',
    target: l('Un humanoide de 4 DG o menos', 'One humanoid of 4 HD or less'), duration: l('1 ronda', '1 round'),
    save: l('Voluntad anula', 'Will negates'), sr: true,
    summary: l('Aturde 1 ronda a un humanoide de 4 DG o menos', 'Dazes a humanoid of 4 HD or less for 1 round'),
    text: l('El objetivo queda aturdido y pierde su próxima acción. Después queda inmune a este conjuro por 1 minuto.',
      'The target is dazed and loses its next action. It is then immune to this spell for 1 minute.'),
  },
  'Detect Magic': {
    name: 'Detect Magic', school: 'Divination', castingTime: 'standard', range: { ft: 60 },
    target: l('Emanación en cono', 'Cone-shaped emanation'),
    duration: l('Concentración, hasta 1 min/nivel', 'Concentration, up to 1 min./level'), save: null, sr: false,
    summary: l('Detecta auras mágicas en un cono', 'Detects magical auras in a cone'),
    text: l('1.ª ronda: si hay magia. 2.ª: cuántas auras y la más fuerte. 3.ª: fuerza y ubicación de cada una (Spellcraft para la escuela).',
      'Round 1: whether magic is present. Round 2: number of auras and the strongest. Round 3: strength and location of each (Spellcraft for the school).'),
  },
  'Disrupt Undead': {
    name: 'Disrupt Undead', school: 'Necromancy', castingTime: 'standard', range: 'close',
    target: l('Rayo', 'Ray'), duration: INSTANT, save: null, sr: true,
    summary: l('Rayo de energía positiva, solo muertos vivientes', 'Positive energy ray, undead only'),
    attack: 'ranged-touch', damage: { dice: 1, die: 6, type: l('energía positiva', 'positive energy') },
    text: l('Ataque de toque a distancia con un rayo de energía positiva: 1d6 de daño, solo contra muertos vivientes.',
      'Ranged touch attack with a ray of positive energy: 1d6 damage, undead only.'),
  },
  Flare: {
    name: 'Flare', school: 'Evocation [light]', castingTime: 'standard', range: 'close',
    target: l('Estallido de luz', 'Burst of light'), duration: INSTANT, save: l('Fortaleza anula', 'Fortitude negates'), sr: true,
    summary: l('Deslumbra 1 minuto a una criatura', 'Dazzles one creature for 1 minute'),
    text: l('Un destello frente a una criatura que ve: queda deslumbrada (−1 a ataques) 1 minuto. No afecta a ciegos.',
      'A flash in front of a creature that can see: it is dazzled (−1 on attacks) for 1 minute. No effect on the blind.'),
  },
  'Ghost Sound': {
    name: 'Ghost Sound', school: 'Illusion (figment)', castingTime: 'standard', range: 'close',
    target: l('Sonidos ilusorios', 'Illusory sounds'), duration: l('1 ronda/nivel', '1 round/level'),
    save: l('Voluntad descree', 'Will disbelief'), sr: false,
    summary: l('Sonidos ilusorios (voces, pasos, rugidos)', 'Illusory sounds (voices, steps, roars)'),
    text: l('Creás ruidos que suben, bajan o se mueven. El volumen máximo equivale a unas 4 personas por nivel.',
      'You create noises that rise, fall or move. Maximum volume is about 4 people per level.'),
  },
  Light: {
    name: 'Light', school: 'Evocation [light]', castingTime: 'standard', range: 'touch',
    target: l('Objeto tocado', 'Object touched'), duration: l('10 min/nivel', '10 min./level'), save: null, sr: false,
    summary: l('Un objeto brilla como una antorcha', 'An object glows like a torch'),
    text: l('El objeto da luz normal en 20 pies (y sube un paso la luz 20 pies más allá). Solo uno activo a la vez.',
      'The object sheds normal light in 20 ft. (and raises the light one step for 20 ft. beyond). Only one at a time.'),
  },
  'Mage Hand': {
    name: 'Mage Hand', school: 'Transmutation', castingTime: 'standard', range: 'close',
    target: l('Objeto no mágico y sin dueño de hasta 5 lb', 'Nonmagical unattended object up to 5 lb.'),
    duration: l('Concentración', 'Concentration'), save: null, sr: false,
    summary: l('Movés un objeto chico a distancia', 'Move a small object at range'),
    text: l('Levantás y movés el objeto hasta 15 pies por ronda mientras te concentrás.',
      'You lift and move the object up to 15 ft. per round while you concentrate.'),
  },
  'Open/Close': {
    name: 'Open/Close', school: 'Transmutation', castingTime: 'standard', range: 'close',
    target: l('Objeto o portal de hasta 30 lb', 'Object or portal up to 30 lb.'), duration: INSTANT,
    save: l('Voluntad anula (objeto)', 'Will negates (object)'), sr: true,
    summary: l('Abre o cierra una puerta, cofre o tapa', 'Opens or closes a door, chest or lid'),
    text: l('Abrís o cerrás algo a distancia. No sirve con cerraduras, trabas ni barras.',
      'You open or close something at range. It does not undo locks, latches or bars.'),
  },
  Prestidigitation: {
    name: 'Prestidigitation', school: 'Universal', castingTime: 'standard', range: { ft: 10 },
    target: l('Ver texto', 'See text'), duration: l('1 hora', '1 hour'), save: null, sr: false,
    summary: l('Trucos menores: limpiar, calentar, saborizar…', 'Minor tricks: clean, warm, flavor…'),
    text: l('Efectos menores durante una hora: limpiar o ensuciar, enfriar o calentar, dar sabor, crear baratijas. No hace daño.',
      'Minor effects for an hour: clean or soil, chill or warm, flavor, make trinkets. It deals no damage.'),
  },
  'Ray of Frost': {
    name: 'Ray of Frost', school: 'Evocation [cold]', castingTime: 'standard', range: 'close',
    target: l('Rayo', 'Ray'), duration: INSTANT, save: null, sr: true,
    summary: l('Rayo helado', 'Icy ray'),
    attack: 'ranged-touch', damage: { dice: 1, die: 3, type: l('frío', 'cold') },
    text: l('Ataque de toque a distancia con un rayo helado: 1d3 de daño por frío.',
      'Ranged touch attack with an icy ray: 1d3 cold damage.'),
  },
  'Read Magic': {
    name: 'Read Magic', school: 'Divination', castingTime: 'standard', range: 'personal',
    target: l('Vos', 'You'), duration: l('10 min/nivel', '10 min./level'), save: null, sr: false,
    summary: l('Leés pergaminos y libros de conjuros ajenos', 'Read scrolls and others’ spellbooks'),
    text: l('Descifrás inscripciones mágicas. Una vez leída, esa escritura ya la entendés sin el conjuro.',
      'You decipher magical writing. Once read, you understand that writing without the spell.'),
  },
  Spark: {
    name: 'Spark', school: 'Evocation [fire]', castingTime: 'standard', range: 'close',
    target: l('Un objeto diminuto', 'One Fine object'), duration: INSTANT,
    save: l('Fortaleza anula (objeto)', 'Fortitude negates (object)'), sr: true,
    summary: l('Prende fuego algo chico (mecha, yesca)', 'Ignites something tiny (wick, tinder)'),
    text: l('Hacés saltar una chispa que enciende un objeto inflamable muy chico.',
      'You make a spark that ignites a very small flammable object.'),
  },

  // --- Nivel 1 ---
  'Shocking Grasp': {
    name: 'Shocking Grasp', school: 'Evocation [electricity]', castingTime: 'standard', range: 'touch',
    target: l('Criatura u objeto tocado', 'Creature or object touched'), duration: INSTANT, save: null, sr: true,
    summary: l('+3 al ataque si el blanco lleva metal', '+3 to hit if the target wears metal'),
    attack: 'melee-touch', charges: 'one', damage: { dice: 'cl', die: 6, maxDice: 5, type: l('electricidad', 'electricity') },
    scaling: l('1d6 por nivel (máx. 5d6)', '1d6 per level (max 5d6)'),
    text: l('Ataque de toque cuerpo a cuerpo: 1d6 de electricidad por nivel (máx. 5d6). +3 al ataque si el blanco lleva armadura de metal, es de metal o lleva mucho metal. Ideal con Spellstrike.',
      'Melee touch attack: 1d6 electricity per level (max 5d6). +3 to hit if the target wears metal armor, is made of metal or carries a lot of it. Great with Spellstrike.'),
  },
  Frostbite: {
    name: 'Frostbite', school: 'Transmutation [cold]', castingTime: 'standard', range: 'touch',
    target: l('Criatura tocada', 'Creature touched'), duration: INSTANT, save: null, sr: true,
    summary: l('Fatiga al blanco · un toque por nivel', 'Fatigues the target · one touch per level'),
    attack: 'melee-touch', charges: 'perLevel', damage: { dice: 1, die: 6, bonus: 'cl', maxBonus: 10, type: l('frío', 'cold') },
    scaling: l('1d6 +1 por nivel (máx. +10)', '1d6 +1 per level (max +10)'),
    text: l('Ataque de toque: 1d6 de frío +1 por nivel (máx. +10) y el blanco queda fatigado. Guarda un toque por nivel hasta usarlos.',
      'Touch attack: 1d6 cold +1 per level (max +10) and the target is fatigued. Holds one touch per level until used.'),
  },
  'Corrosive Touch': {
    name: 'Corrosive Touch', school: 'Conjuration (creation) [acid]', castingTime: 'standard', range: 'touch',
    target: l('Criatura tocada', 'Creature touched'), duration: INSTANT, save: null, sr: false,
    summary: l('Ácido, sin resistencia a conjuros', 'Acid, no spell resistance'),
    attack: 'melee-touch', charges: 'one', damage: { dice: 'cl', die: 4, maxDice: 5, type: l('ácido', 'acid') },
    scaling: l('1d4 por nivel (máx. 5d4)', '1d4 per level (max 5d4)'),
    text: l('Ataque de toque cuerpo a cuerpo: 1d4 de ácido por nivel (máx. 5d4). No permite resistencia a conjuros.',
      'Melee touch attack: 1d4 acid per level (max 5d4). Spell resistance does not apply.'),
  },
  Shield: {
    name: 'Shield', school: 'Abjuration [force]', castingTime: 'standard', range: 'personal',
    target: l('Vos', 'You'), duration: l('1 min/nivel', '1 min./level'), save: null, sr: false,
    summary: l('+4 escudo a la CA · anula Magic Missile', '+4 shield to AC · negates Magic Missile'),
    buff: [{ target: 'ac', type: 'shield', value: 4 }],
    roundsPerLevel: 10,
    text: l('Un disco de fuerza te protege: +4 de escudo a la CA (sin penalizador ni fallo arcano) y bloquea Magic Missile.',
      'A disk of force protects you: +4 shield bonus to AC (no penalty or spell failure) and it blocks Magic Missile.'),
  },
  Vanish: {
    name: 'Vanish', school: 'Illusion (glamer)', castingTime: 'standard', range: 'touch',
    target: l('Criatura tocada', 'Creature touched'), duration: l('1 ronda/nivel (máx. 5)', '1 round/level (max 5)'),
    save: l('Voluntad anula (inofensivo)', 'Will negates (harmless)'), sr: true,
    summary: l('Invisible unas rondas (se corta si atacás)', 'Invisible for a few rounds (ends if you attack)'),
    text: l('Como Invisibility pero corto: hasta 5 rondas. Si el blanco ataca, el efecto termina.',
      'Like Invisibility but short: up to 5 rounds. If the subject attacks, it ends.'),
  },
  Grease: {
    name: 'Grease', school: 'Conjuration (creation)', castingTime: 'standard', range: 'close',
    target: l('Un objeto o un cuadrado de 10 pies', 'One object or a 10-ft. square'), duration: l('1 min/nivel', '1 min./level'),
    save: l('Reflejos parcial', 'Reflex partial'), sr: false,
    summary: l('Superficie resbalosa: Reflejos o caer', 'Slippery surface: Reflex or fall'),
    text: l('Cubrís el piso o un objeto de grasa. Quien la cruza hace Reflejos o cae; moverse pide Acrobatics. Un objeto engrasado se puede soltar.',
      'You coat the ground or an object in grease. Creatures crossing it save on Reflex or fall; moving needs Acrobatics. A greased item may be dropped.'),
  },
  'Enlarge Person': {
    name: 'Enlarge Person', school: 'Transmutation', castingTime: 'round', range: 'close',
    target: l('Un humanoide', 'One humanoid creature'), duration: l('1 min/nivel', '1 min./level'),
    save: l('Fortaleza anula', 'Fortitude negates'), sr: true,
    summary: l('Grande: +2 FUE, −2 DES, −1 ataque y CA, alcance', 'Large: +2 STR, −2 DEX, −1 attack and AC, reach'),
    text: l('El humanoide pasa a tamaño Grande: +2 FUE, −2 DES, −1 al ataque y a la CA, y más alcance. Su equipo crece con él.',
      'The humanoid becomes Large: +2 STR, −2 DEX, −1 on attacks and AC, and more reach. Its gear grows with it.'),
  },
}

// Modifiers de los buffs por nombre de conjuro (para toSessionContext).
export const spellBuffs: Record<string, ModifierInput[]> = Object.fromEntries(
  Object.values(spells).flatMap((sp): [string, ModifierInput[]][] => (sp.buff ? [[sp.name, sp.buff]] : [])),
)
