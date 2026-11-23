import type { SpellDamage, SpellRange } from '../core/rules/pf1e/spells'
import type { ModifierInput } from '../core/schema'

// Conjuros del spellbook de Furio, con datos y un texto breve propio (no es el texto del libro: OGL / Community Use).
// La clave es el nombre tal como aparece en character.json. El nivel sale del spellbook, no de acá.


export interface SpellDef {
  name: string
  school: string // en inglés, como en el libro
  castingTime: 'standard' | 'round' | 'swift' | 'immediate'
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
  'Magic Missile': {
    name: 'Magic Missile', school: 'Evocation [force]', castingTime: 'standard', range: 'medium',
    target: 'Hasta 5 criaturas a la vista', duration: INSTANT, save: null, sr: true,
    summary: '1d4+1 por proyectil · no falla',
    scaling: '1 proyectil, +1 cada 2 niveles después del 1 (máx. 5)',
    text: 'Disparás dardos de fuerza que nunca fallan: 1d4+1 cada uno. Uno a nivel 1, uno más en los niveles 3, 5, 7 y 9. Los podés repartir entre blancos. Escudo los bloquea.',
  },

  // --- Nivel 1: el resto de la lista del magus (para sumar al libro al subir de nivel) ---
  'Burning Hands': {
    name: 'Burning Hands', school: 'Evocation [fire]', castingTime: 'standard', range: { ft: 15 },
    target: 'Cono de 15 pies', duration: INSTANT, save: 'Reflejos mitad', sr: true,
    summary: 'Cono de fuego delante tuyo',
    damage: { dice: 'cl', die: 4, maxDice: 5, type: 'fuego' },
    scaling: '1d4 por nivel (máx. 5d4)',
    text: 'Un abanico de llamas sale de tus manos: 1d4 de fuego por nivel (máx. 5d4) a todo lo que esté en el cono. Reflejos para la mitad.',
  },
  'Chill Touch': {
    name: 'Chill Touch', school: 'Necromancy', castingTime: 'standard', range: 'touch',
    target: 'Criaturas tocadas (una por nivel)', duration: 'Instantánea', save: 'Fortaleza parcial', sr: true,
    summary: 'Además, 1 de daño a FUE (Fortaleza lo evita) · un toque por nivel',
    attack: 'melee-touch', charges: 'perLevel', damage: { dice: 1, die: 6, type: 'energía negativa' },
    text: 'Tu mano brilla con energía negativa. Cada toque hace 1d6 de daño y 1 de daño a FUE (Fortaleza lo evita). Guardás un toque por nivel. A un muerto viviente lo hace huir en vez de dañarlo.',
  },
  'Color Spray': {
    name: 'Color Spray', school: 'Illusion (pattern) [mind-affecting]', castingTime: 'standard', range: { ft: 15 },
    target: 'Cono de 15 pies', duration: INSTANT, save: 'Voluntad anula', sr: true,
    summary: 'Cono de colores: inconsciente, ciego o aturdido según los DG',
    text: 'Un cono de colores que golpea los sentidos. Con 2 DG o menos, inconsciente, ciego y aturdido; con 3 o 4, ciego y aturdido; con 5 o más, aturdido 1 ronda. Voluntad anula.',
  },
  'Expeditious Retreat': {
    name: 'Expeditious Retreat', school: 'Transmutation', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 min/nivel', save: null, sr: false,
    summary: '+30 pies a tu velocidad base',
    text: 'Tu velocidad base aumenta 30 pies (un bono de mejora). También cuenta para saltar.',
  },
  'Feather Fall': {
    name: 'Feather Fall', school: 'Transmutation', castingTime: 'immediate', range: 'close',
    target: 'Una criatura u objeto Mediano por nivel, a 20 pies entre sí', duration: 'Hasta aterrizar o 1 ronda/nivel',
    save: 'Voluntad anula (inofensivo)', sr: true,
    summary: 'Caés despacio y sin daño · se lanza cuando caés',
    text: 'Los blancos caen lento, como una pluma, y no se lastiman al llegar al piso. Se lanza al instante, incluso fuera de tu turno.',
  },
  'Floating Disk': {
    name: 'Floating Disk', school: 'Evocation [force]', castingTime: 'standard', range: 'close',
    target: 'Disco de fuerza de 3 pies', duration: '1 hora/nivel', save: null, sr: false,
    summary: 'Disco que carga peso y te sigue',
    text: 'Un disco de fuerza flota a la altura de la cintura y te sigue. Carga 100 libras por nivel. Si te alejás demasiado, desaparece.',
  },
  'Jump': {
    name: 'Jump', school: 'Transmutation', castingTime: 'standard', range: 'touch',
    target: 'Criatura tocada', duration: '1 min/nivel', save: 'Voluntad anula (inofensivo)', sr: true,
    summary: '+10 a Acrobacias para saltar (+20 a nivel 5, +30 a nivel 9)',
    text: 'El blanco salta mucho más: +10 a Acrobacias para saltar, que sube a +20 a nivel 5 y a +30 a nivel 9.',
  },
  'Magic Weapon': {
    name: 'Magic Weapon', school: 'Transmutation', castingTime: 'standard', range: 'touch',
    target: 'Arma tocada', duration: '1 min/nivel', save: 'Voluntad anula (inofensivo, objeto)', sr: true,
    summary: '+1 de mejora al ataque y al daño de un arma',
    text: 'El arma tocada gana +1 de mejora al ataque y al daño. No se suma a otra mejora mayor.',
  },
  Mount: {
    name: 'Mount', school: 'Conjuration (summoning)', castingTime: 'round', range: 'close',
    target: 'Un caballo ligero o un poni', duration: '2 horas/nivel', save: null, sr: false,
    summary: 'Un caballo o un poni para montar',
    text: 'Aparece un caballo ligero o un poni (a tu elección) con montura, bridas y riendas, que te sirve sin quejarse.',
  },
  'Obscuring Mist': {
    name: 'Obscuring Mist', school: 'Conjuration (creation)', castingTime: 'standard', range: { ft: 20 },
    target: 'Niebla de 20 pies de radio a tu alrededor', duration: '1 min/nivel', save: null, sr: false,
    summary: 'Niebla a tu alrededor que oculta todo',
    text: 'Te rodea una niebla que no deja ver más allá de 5 pies. Lo que está a 5 pies tiene ocultación; más lejos, ocultación total. El viento la dispersa.',
  },
  'Ray of Enfeeblement': {
    name: 'Ray of Enfeeblement', school: 'Necromancy', castingTime: 'standard', range: 'close',
    target: 'Rayo', duration: '1 ronda/nivel', save: 'Fortaleza mitad', sr: true,
    summary: '−1d6 a FUE (+1 cada 2 niveles, máx. +5)',
    attack: 'ranged-touch',
    text: 'Ataque de toque a distancia: el blanco recibe un penalizador de 1d6 a FUE, +1 cada 2 niveles (máx. +5). Fortaleza lo reduce a la mitad. No baja de 1.',
  },
  'Reduce Person': {
    name: 'Reduce Person', school: 'Transmutation', castingTime: 'round', range: 'close',
    target: 'Un humanoide', duration: '1 min/nivel', save: 'Fortaleza anula', sr: true,
    summary: 'Pequeño: +2 DES, −2 FUE, +1 ataque y CA',
    text: 'El humanoide pasa a tamaño Pequeño: +2 DES, −2 FUE, +1 al ataque y a la CA. Su equipo se achica con él.',
  },
  'Silent Image': {
    name: 'Silent Image', school: 'Illusion (figment)', castingTime: 'standard', range: 'long',
    target: 'Ilusión visual de cuatro cubos de 10 pies + uno por nivel', duration: 'Concentración',
    save: 'Voluntad descree (si interactúa)', sr: false,
    summary: 'Ilusión que se ve pero no suena, mientras te concentrás',
    text: 'Creás una imagen de un objeto, criatura o fuerza, sin sonido, olor ni temperatura. La movés mientras te concentrás.',
  },
  'True Strike': {
    name: 'True Strike', school: 'Divination', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: 'Hasta tu próximo ataque', save: null, sr: false,
    summary: '+20 a tu próxima tirada de ataque',
    text: 'Ves un instante del futuro: tu próxima tirada de ataque (si es antes del final de tu próximo turno) tiene +20 y no sufre el fallo por ocultación.',
  },
  'Unseen Servant': {
    name: 'Unseen Servant', school: 'Conjuration (creation)', castingTime: 'standard', range: 'close',
    target: 'Un sirviente invisible', duration: '1 hora/nivel', save: null, sr: false,
    summary: 'Fuerza invisible que hace tareas simples',
    text: 'Una fuerza invisible y sin mente busca, abre, limpia, lleva cosas o sirve la mesa. No ataca ni puede ser atacada de forma normal.',
  },
  'Hydraulic Push': {
    name: 'Hydraulic Push', school: 'Evocation [water]', castingTime: 'standard', range: 'close',
    target: 'Una criatura u objeto', duration: INSTANT, save: null, sr: true,
    summary: 'Embestida de agua (BMC = nivel de lanzador + INT)',
    text: 'Un chorro de agua empuja al blanco como una embestida. Tu bonificador es tu nivel de lanzador más tu modificador de atributo de lanzamiento. Apaga fuegos chicos.',
  },
  'Flare Burst': {
    name: 'Flare Burst', school: 'Evocation [light]', castingTime: 'standard', range: 'close',
    target: 'Explosión de 10 pies de radio', duration: INSTANT, save: 'Fortaleza anula', sr: true,
    summary: 'Explosión de luz que deslumbra 1 minuto',
    text: 'Un estallido de luz deslumbra 1 minuto a las criaturas del área. Fortaleza lo evita. No afecta a las ciegas.',
  },
  'Stone Fist': {
    name: 'Stone Fist', school: 'Transmutation [earth]', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 min/nivel', save: null, sr: false,
    summary: 'Puños de piedra: golpes sin arma de 1d6, letales',
    text: 'Tus manos se vuelven de piedra: tus golpes sin arma hacen 1d6 de daño letal y no provocan ataques de oportunidad.',
  },
  'Warding Weapon': {
    name: 'Warding Weapon', school: 'Abjuration', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 ronda/nivel', save: null, sr: false,
    summary: 'Tu arma te cubre: lanzar no provoca, pero no atacás con ella',
    text: 'Tu arma se mueve sola para protegerte mientras lanzás: lanzar conjuros no provoca ataques de oportunidad. Mientras dure, no podés atacar con esa arma.',
  },
  'Jury-Rig': {
    name: 'Jury-Rig', school: 'Transmutation', castingTime: 'standard', range: 'touch',
    target: 'Objeto tocado', duration: '1 min/nivel', save: 'Voluntad anula (inofensivo, objeto)', sr: true,
    summary: 'Un objeto roto funciona como sano por un rato',
    text: 'Arreglás de forma provisoria un objeto roto: mientras dure, no sufre los penalizadores de estar roto.',
  },
  Longshot: {
    name: 'Longshot', school: 'Divination', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 min/nivel', save: null, sr: false,
    summary: '+10 pies al incremento de distancia de tus armas a distancia',
    text: 'Tus ataques a distancia llegan más lejos: +10 pies al incremento de distancia de las armas que uses.',
  },
  'Shock Shield': {
    name: 'Shock Shield', school: 'Abjuration [electricity, force]', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 ronda/nivel', save: null, sr: false,
    summary: '+4 de escudo a la CA · al terminarlo, descarga eléctrica',
    text: 'Un escudo de fuerza chispeante te da +4 de escudo a la CA. Podés terminarlo para que descargue electricidad sobre una criatura cercana.',
  },
  'Lock Gaze': {
    name: 'Lock Gaze', school: 'Enchantment (compulsion) [mind-affecting]', castingTime: 'standard', range: 'close',
    target: 'Una criatura', duration: '1 ronda/nivel', save: 'Voluntad anula', sr: true,
    summary: 'El blanco solo puede mirarte a vos',
    text: 'El blanco no puede apartar la mirada de vos: solo ve lo que hacés vos y no puede mirar a otros.',
  },
  'Illusion of Calm': {
    name: 'Illusion of Calm', school: 'Illusion (glamer)', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 ronda/nivel', save: 'Voluntad descree', sr: false,
    summary: 'Parecés quieto aunque te muevas o lances',
    text: 'Tu imagen se queda tranquila en su lugar aunque te muevas, ataques o lances: quien no la descrea no nota lo que hacés.',
  },
  'Mirror Strike': {
    name: 'Mirror Strike', school: 'Transmutation', castingTime: 'swift', range: 'personal',
    target: 'Vos', duration: 'Hasta el final de tu turno', save: null, sr: false,
    summary: 'Un ataque cuerpo a cuerpo vale contra dos enemigos adyacentes',
    text: 'Tu próximo ataque cuerpo a cuerpo de este turno se compara contra dos enemigos que tengas al lado: una tirada para los dos.',
  },
  'Adjuring Step': {
    name: 'Adjuring Step', school: 'Abjuration', castingTime: 'standard', range: 'personal',
    target: 'Vos', duration: '1 ronda/nivel', save: null, sr: false,
    summary: 'Moverte con pasos cortos te protege mientras lanzás',
    text: 'Mientras dure, tus pasos de 5 pies te ayudan a esquivar al lanzar conjuros.',
  },
}

// Modifiers de los buffs por nombre de conjuro (para toSessionContext).
export const spellBuffs: Record<string, ModifierInput[]> = Object.fromEntries(
  Object.values(spells).flatMap((sp): [string, ModifierInput[]][] => (sp.buff ? [[sp.name, sp.buff]] : [])),
)
