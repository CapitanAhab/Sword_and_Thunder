
// Nombres en castellano por id; los datos quedan en inglés.
// Fuente de los nombres: la terminología de Devir
// (vía rolroyce.com, 2026-10-31); las dos dotes llevan los nombres de la 3.5 de Devir.
export const ES_NAMES: Readonly<Record<string, string>> = {
  // Clases
  magus: 'Magus',

  // Magus (acciones y aptitudes; los ids con número, como 'magus-arcana-3', caen en el id sin número)
  'weapon-armor-proficiency': 'Competencia con armas y armaduras',
  'magus-spells': 'Conjuros',
  'arcane-pool': 'Reserva arcana',
  'spell-combat': 'Combate con conjuros',
  'attack-for-concentration': 'Ataque por Conc',
  spellstrike: 'Impacto con conjuro',
  'enhance-weapon': 'Mejorar arma',
  'spell-recall': 'Recordar conjuros',
  'knowledge-pool': 'Reserva de saber',
  cantrips: 'Trucos',
  'magus-arcana': 'Arcanos del magus',
  'bonus-feat': 'Dote adicional',
  'medium-armor': 'Armadura intermedia',
  'improved-spell-combat': 'Combate con conjuros mejorado',
  'fighter-training': 'Entrenamiento de guerrero',
  'improved-spell-recall': 'Recordar conjuros mejorado',
  'heavy-armor': 'Armadura pesada',
  'greater-spell-combat': 'Combate con conjuros mayor',
  counterstrike: 'Contraataque',
  'greater-spell-access': 'Acceso a conjuros mayor',
  'true-magus': 'Magus auténtico',

  // Dotes (sin confirmar con Devir 1e: nombres de la 3.5)
  'combat-casting': 'Lanzar conjuros en combate',
  'improved-initiative': 'Iniciativa mejorada',

  // Raza e idiomas
  human: 'Humano',
  skilled: 'Hábil',
  common: 'Común',
  elven: 'Élfico',
  orc: 'Orco',
  draconic: 'Dracónico',
  celestial: 'Celestial',

  // Condiciones
  shaken: 'Asustado',
  sickened: 'Descompuesto',
  frightened: 'Aterrorizado',
  staggered: 'Tambaleante',
  nauseated: 'Nauseado',
  stunned: 'Aturdido',
  blinded: 'Cegado',
  exhausted: 'Agotado',
  'ability-damage': 'Daño de atributo',
  fatigued: 'Fatigado',
  entangled: 'Enredado',
  grappled: 'Apresado',
  prone: 'Tumbado',

  // Skills
  acrobatics: 'Acrobacias',
  appraise: 'Tasación',
  bluff: 'Engañar',
  climb: 'Trepar',
  craft: 'Artesanía',
  diplomacy: 'Diplomacia',
  'disable-device': 'Inutilizar mecanismo',
  disguise: 'Disfrazarse',
  'escape-artist': 'Escapismo',
  fly: 'Volar',
  'handle-animal': 'Trato con animales',
  heal: 'Sanar',
  intimidate: 'Intimidar',
  'knowledge-arcana': 'Conocimiento (arcano)',
  'knowledge-dungeoneering': 'Conocimiento (dungeons)',
  'knowledge-engineering': 'Conocimiento (ingeniería)',
  'knowledge-geography': 'Conocimiento (geografía)',
  'knowledge-history': 'Conocimiento (historia)',
  'knowledge-local': 'Conocimiento (local)',
  'knowledge-nature': 'Conocimiento (naturaleza)',
  'knowledge-nobility': 'Conocimiento (nobleza)',
  'knowledge-planes': 'Conocimiento (planos)',
  'knowledge-religion': 'Conocimiento (religión)',
  linguistics: 'Lingüística',
  perception: 'Percepción',
  perform: 'Interpretar',
  profession: 'Profesión',
  ride: 'Montar',
  'sense-motive': 'Averiguar intenciones',
  'sleight-of-hand': 'Juego de manos',
  spellcraft: 'Conocimiento de conjuros',
  stealth: 'Sigilo',
  survival: 'Supervivencia',
  swim: 'Nadar',
  'use-magic-device': 'Usar objeto mágico',

  // Equipo (ids del JSON del personaje)
  longsword: 'Espada larga',
  'chain-shirt': 'Camisa de malla',
  'boots-of-levitation': 'Botas de levitación',
  spellbook: 'Libro de conjuros',
  'spell-component-pouch': 'Bolsa de componentes',
  backpack: 'Mochila',
  bedroll: 'Bolsa de dormir',
  waterskin: 'Cantimplora',
  'trail-rations': 'Raciones de viaje',
  'flint-and-steel': 'Yesquero',
  'belt-pouch': 'Riñonera',
  'potion-cure-light-wounds': 'Poción de curar heridas leves',
  'potion-invisibility': 'Poción de invisibilidad',
}

// Escuelas de magia (el campo `school` de src/data/spells.ts queda en inglés, como en el libro).
const ES_SCHOOLS: Readonly<Record<string, string>> = {
  'Abjuration [force]': 'Abjuración [fuerza]',
  'Conjuration (creation)': 'Conjuración (creación)',
  'Conjuration (creation) [acid]': 'Conjuración (creación) [ácido]',
  Divination: 'Adivinación',
  'Enchantment (compulsion) [mind-affecting]': 'Encantamiento (compulsión) [enajenador]',
  'Evocation [cold]': 'Evocación [frío]',
  'Evocation [electricity]': 'Evocación [electricidad]',
  'Evocation [fire]': 'Evocación [fuego]',
  'Evocation [light]': 'Evocación [luz]',
  'Illusion (figment)': 'Ilusión (quimera)',
  'Illusion (glamer)': 'Ilusión (engaño)',
  Necromancy: 'Nigromancia',
  Transmutation: 'Transmutación',
  'Transmutation [cold]': 'Transmutación [frío]',
  Universal: 'Universal',
}

// Detector de idioma mezclado (solo en `npm run dev`, no va al build): cuando falta una traducción y se ve el
// dato en inglés, avisa una vez por texto en la consola. Sirve para pruebas exploratorias.
const warned = new Set<string>()
export function warnMissing(kind: string, key: string): void {
  if (!import.meta.env.DEV || warned.has(`${kind}:${key}`)) return
  warned.add(`${kind}:${key}`)
  console.warn(`[i18n] sin traducción (${kind}): "${key}"`)
}

export function localSchool(school: string): string {
  if (!ES_SCHOOLS[school]) warnMissing('escuela', school)
  return ES_SCHOOLS[school] ?? school
}

// El nombre traducido si existe; si no, el del dato. Skills con subtipo: 'craft:alchemy' → 'Artesanía (alchemy)'.
// Ids con número al final ('magus-arcana-3', 'bonus-feat-5') usan el nombre del id sin número.
export function localName(id: string, fallback: string): string {
  if (ES_NAMES[id]) return ES_NAMES[id]
  const unnumbered = ES_NAMES[id.replace(/-\d+$/, '')]
  if (unnumbered) return unnumbered
  const [base = '', sub] = id.split(':')
  const es = ES_NAMES[base]
  if (sub && es) {
    warnMissing('subtipo', sub)
    return `${es} (${sub})`
  }
  warnMissing('nombre', id)
  return fallback
}

// Conjuros: clave = nombre en inglés, tal como está en el spellbook (también es la clave de src/data/spells.ts,
// de la sesión y de los testids). Solo cambia el texto visible.
const ES_SPELLS: Readonly<Record<string, string>> = {
  'Acid Splash': 'Salpicadura de ácido',
  'Arcane Mark': 'Marca arcana',
  'Dancing Lights': 'Luces danzantes',
  Daze: 'Atontar',
  'Detect Magic': 'Detectar magia',
  'Disrupt Undead': 'Perturbar muertos vivientes',
  Flare: 'Llamarada',
  'Ghost Sound': 'Sonido fantasma',
  Light: 'Luz',
  'Mage Hand': 'Mano del mago',
  'Open/Close': 'Abrir/Cerrar',
  Prestidigitation: 'Prestidigitación',
  'Ray of Frost': 'Rayo de escarcha',
  'Read Magic': 'Leer magia',
  Spark: 'Chispa',
  'Shocking Grasp': 'Contacto electrizante',
  Frostbite: 'Congelación',
  'Corrosive Touch': 'Toque corrosivo',
  Shield: 'Escudo',
  Vanish: 'Desvanecer',
  Grease: 'Grasa',
  'Enlarge Person': 'Agrandar persona',
}

export function localSpell(name: string): string {
  if (!ES_SPELLS[name]) warnMissing('conjuro', name)
  return ES_SPELLS[name] ?? name
}

// Nombre de un buff activo: el efecto que deja un objeto (por id) o, si no, el conjuro (por nombre).
const ITEM_BUFFS: Readonly<Record<string, string>> = {
  'potion-invisibility': 'Invisible',
}
export const localBuff = (id: string): string => ITEM_BUFFS[id] ?? localSpell(id)

// Una línea propia y breve por dote o aptitud (no es el texto del libro: OGL / Community Use). Por id; los ids
// con número usan el id sin número.
const SUMMARIES: Readonly<Record<string, string>> = {
  // Dotes
  'combat-casting': '+4 a concentración al lanzar a la defensiva o apresado',
  'improved-initiative': '+4 a la iniciativa',
  // Raza
  'bonus-feat': 'Una dote extra',
  skilled: '+1 rango de habilidad por nivel',
  // Magus
  'weapon-armor-proficiency': 'Armas sencillas y marciales, armadura ligera',
  'magus-spells': 'Arcanos, de INT, se preparan del libro',
  'arcane-pool': 'Puntos para mejorar el arma y potenciar sus aptitudes',
  cantrips: 'Trucos preparados, se lanzan a voluntad',
  'spell-combat': 'Atacar con el arma y lanzar un conjuro en la misma ronda (−2 al ataque)',
  spellstrike: 'El conjuro de toque se descarga con el golpe del arma',
  'magus-arcana': 'Una aptitud especial a elección',
  'spell-recall': 'Recuperar un conjuro lanzado gastando reserva',
  'knowledge-pool': 'Preparar un conjuro que no está en el libro gastando reserva',
  'medium-armor': 'Lanza conjuros con armadura intermedia sin fallo arcano',
  'improved-spell-combat': 'Combate con conjuros: +2 a concentración',
  'fighter-training': 'Cuenta como guerrero para requisitos de dotes',
  'improved-spell-recall': 'Recordar conjuros cuesta menos',
  'heavy-armor': 'Lanza conjuros con armadura pesada sin fallo arcano',
  'greater-spell-combat': 'Combate con conjuros: +4 a concentración',
  counterstrike: 'Ataque de oportunidad contra quien lanza cerca',
  'greater-spell-access': 'Suma conjuros de la lista de mago',
  'true-magus': 'Culminación de la clase',
}

export function localSummary(id: string): string | undefined {
  const s = SUMMARIES[id] ?? SUMMARIES[id.replace(/-\d+$/, '')]
  return s
}

// Fuente del desglose que no es un id (nombre de ítem o dote): 'Chain shirt' → id 'chain-shirt'.
export const localSource = (source: string): string =>
  localName(source.toLowerCase().replace(/\s+/g, '-'), source)

// Notas del equipo (el JSON las tiene en inglés).
const ES_NOTES: Readonly<Record<string, string>> = {
  'boots-of-levitation': 'Levitar a voluntad (NL 3)',
  'potion-cure-light-wounds': 'Cura 1d8+1',
  'potion-invisibility': 'Invisible 3 minutos; se corta al atacar',
}

export function localNote(id: string, fallback: string | undefined): string | undefined {
  if (!ES_NOTES[id] && fallback) warnMissing('nota', id)
  return ES_NOTES[id] ?? fallback
}
