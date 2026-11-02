import type { ClassActionDef, ClassDef, RaceDef, RuleCtx, RulesDb } from './defs'
import { makeStat, signed, type Modifier, type ModifierType, type Stat } from './modifiers'
import { abilityMod } from './rules/pf1e/abilities'
import { ARMOR_RANK, CMD_AC_TYPES, TOUCH_EXCLUDED, armoredSpeed, isMelee, strToDamage } from './rules/pf1e/combat'
import { baseAttack, baseSave, featsByLevel, iterativeAttacks } from './rules/pf1e/progression'
import { computeLoad, loadedSpeed, type Load } from './rules/pf1e/load'
import { SIZE } from './rules/pf1e/size'
import { SKILLS, SKILL_BY_ID, splitSkillKey, type SkillDef } from './rules/pf1e/skills'
import { bonusSpells, spellDc } from './rules/pf1e/spells'
import { xpForNextLevel, type XpTrack } from './rules/pf1e/xp'
import {
  ABILITIES,
  type Ability,
  type Bio,
  type Character,
  type ModifierInput,
  type Size,
  type Target,
  type WeaponCategory,
} from './schema'

// computeSheet: character.json (+ sesión) → todos los valores derivados de la ficha.
// Función pura: no lee localStorage ni React. Las vistas solo muestran lo que sale de acá.

export interface SessionContext {
  modifiers?: readonly Modifier[] // buffs, condiciones, Arcane Pool sobre el arma…
  conditions?: readonly string[] // activa los modifiers con esa `condition` (ej. 'casting-defensively')
  defensiveTrade?: number // ataque cambiado por concentración en las variantes que lo permiten (se recorta al tope)
}

export type IssueCode =
  | 'unknown-race'
  | 'unknown-class'
  | 'unknown-feat'
  | 'unknown-skill'
  | 'racial-ability-choice-missing'
  | 'ability-increase-wrong-level'
  | 'hp-over-hit-die'
  | 'first-level-hp-not-max'
  | 'ranks-over-level'
  | 'skill-ranks-overspent'
  | 'feats-over-limit'
  | 'default-prepared-invalid'

export interface Issue {
  code: IssueCode
  detail?: string
}

export interface AttackVariant {
  id: string // 'standard' | id de la variante de clase ('spell-combat')
  name: string
  attack: Stat
  fullAttack: number[] // bonos del ataque completo: [+6, +1]
  damage: Stat
  damageText: string // "1d8+3"
}

export interface AttackLine {
  id: string
  name: string
  category: WeaponCategory
  critical: string
  damageType?: string
  range?: number
  variants: AttackVariant[]
}

export interface SkillLine {
  id: string // clave del JSON: 'perception', 'craft:alchemy'
  baseId: string
  name: string
  ability: Ability
  ranks: number
  classSkill: boolean
  trainedOnly: boolean
  armorCheck: boolean
  usable: boolean // false si es trained-only y no tiene rangos
  stat: Stat
}

export interface SpellcastingLine {
  classId: string
  ability: Ability // atributo de lanzamiento
  casterLevel: Stat
  concentration: Stat
  // Concentración dentro de una variante con ataque cambiado (ej. 'spell-combat' a la defensiva); solo si hay cambio
  concentrationBy: Record<string, Stat>
  spellsPerDay: number[] // por nivel de conjuro, ya con los extra por atributo
  bonusSpells: number[]
  dcs: number[]
  arcaneSpellFailure: number // %
}

export interface ResourceLine {
  id: string
  name: string
  classId: string
  max: Stat
  details: Record<string, number>
}

export interface FeatureLine {
  id: string
  name: string
  source: string // id de raza o clase
  level?: number
}

export interface ActionLine extends ClassActionDef {
  classId: string
}

export interface ComputedSheet {
  name: string
  race: string
  size: Size
  alignment: string
  bio: Bio // datos personales (deidad, origen, edad…), tal cual el JSON; vacío si no hay
  level: number
  xp: { current: number; next: number | null; track: XpTrack } // next = null en nivel 20
  languages: { known: string[]; pending: number } // pending: los que le quedan por elegir (INT + Linguistics)
  classes: { id: string; name: string; level: number }[]
  abilities: Record<Ability, { score: Stat; mod: number }>
  hp: Stat
  bab: number
  initiative: Stat
  ac: { normal: Stat; touch: Stat; flatFooted: Stat }
  armorCheckPenalty: number
  saves: { fort: Stat; ref: Stat; will: Stat }
  cmb: Stat
  cmd: Stat
  speed: Stat
  load: Load | null // peso que lleva y topes de carga, en kg (null si el JSON no anota ningún peso)
  attacks: AttackLine[]
  touch: Record<string, { melee: Stat; ranged: Stat }> // ataques de toque de conjuros, por variante ('standard', 'spell-combat')
  // Cambio de ataque por concentración: tope, valor aplicado y las variantes que lo permiten (null si ninguna)
  defensiveTrade: { max: number; value: number; variants: string[] } | null
  skills: SkillLine[]
  skillRanks: { available: number; spent: number }
  feats: { id: string; name: string; param?: string; known: boolean }[]
  featSlots: { available: number; used: number }
  spellcasting: SpellcastingLine[]
  resources: ResourceLine[]
  features: FeatureLine[]
  actions: ActionLine[] // acciones de clase ya filtradas por nivel (menú de #/play)
  issues: Issue[]
}

const FALLBACK_RACE: RaceDef = { id: 'unknown', name: 'Unknown', size: 'medium', speed: 30, bonusFeats: 0, skillRanksPerLevel: 0, languages: [], features: [] }

const mod = (target: Target, type: ModifierType, value: number, source: string): Modifier => ({ target, type, value, source })
const withSource = (m: ModifierInput, source: string): Modifier => ({ ...m, source })
// Fuente del cambio de ataque por concentración (en el desglose; en ES la traduce src/data/names.ts)
const TRADE_SOURCE = 'Attack for concentration'

// `rules` (razas, clases, dotes, conjuros) siempre lo pasa quien llama: core/ no importa src/data/.
export function computeSheet(character: Character, rules: RulesDb, session: SessionContext = {}): ComputedSheet {
  const issues: Issue[] = []
  const stat = (mods: Modifier[]) => makeStat(mods, session.conditions ?? [])
  const charLevel = character.levels.length

  const race = rules.races[character.race] ?? FALLBACK_RACE
  if (!rules.races[character.race]) issues.push({ code: 'unknown-race', detail: character.race })
  const size = character.size ?? race.size
  const sz = SIZE[size]

  // Niveles por clase, en orden de aparición
  const classLevels = new Map<string, number>()
  for (const lv of character.levels) classLevels.set(lv.class, (classLevels.get(lv.class) ?? 0) + 1)
  const classes: { def: ClassDef; level: number }[] = []
  for (const [id, level] of classLevels) {
    const def = rules.classes[id]
    if (def) classes.push({ def, level })
    else issues.push({ code: 'unknown-class', detail: id })
  }

  // Modifiers de todas las fuentes. Las dotes se agregan después de los atributos.
  const pool: Modifier[] = [
    ...(race.modifiers ?? []).map((m) => withSource(m, race.name)),
    ...character.traits.flatMap((t) => t.modifiers.map((m) => withSource(m, t.name))),
    ...character.equipment.items
      .filter((i) => i.equipped && !i.consumable)
      .flatMap((i) => i.modifiers.map((m) => withSource(m, i.name))),
    ...(session.modifiers ?? []),
  ]
  const pick = (...targets: Target[]) => pool.filter((m) => targets.includes(m.target))

  // --- Atributos ---
  character.levels.forEach((lv, i) => {
    if (lv.abilityIncrease && (i + 1) % 4 !== 0) issues.push({ code: 'ability-increase-wrong-level', detail: String(i + 1) })
  })
  if (race.flexibleAbilityBonus && !character.racialAbilityChoice) issues.push({ code: 'racial-ability-choice-missing' })
  const racialBonus = (a: Ability) =>
    (race.abilityMods?.[a] ?? 0) + (character.racialAbilityChoice === a ? (race.flexibleAbilityBonus ?? 0) : 0)
  const increasesUpTo = (a: Ability, level: number) =>
    character.levels.filter((lv, i) => i < level && lv.abilityIncrease === a).length

  const abilities = {} as Record<Ability, { score: Stat; mod: number }>
  for (const a of ABILITIES) {
    const target = `ability.${a}` as const
    const mods = [mod(target, 'base', character.abilities[a], 'base')]
    const racial = racialBonus(a)
    if (racial) mods.push(mod(target, 'racial', racial, race.name))
    const increases = increasesUpTo(a, charLevel)
    if (increases) mods.push(mod(target, 'base', increases, 'level-up'))
    const score = stat([...mods, ...pick(target)])
    abilities[a] = { score, mod: abilityMod(score.total) }
  }
  const am = Object.fromEntries(ABILITIES.map((a) => [a, abilities[a].mod])) as Record<Ability, number>

  // --- Dotes ---
  const featCtx: RuleCtx = { level: charLevel, mods: am }
  const feats = character.feats.map((f) => {
    const def = rules.feats[f.id]
    if (!def) {
      issues.push({ code: 'unknown-feat', detail: f.id })
      return { id: f.id, name: f.id, param: f.param, known: false }
    }
    const ms = typeof def.modifiers === 'function' ? def.modifiers(featCtx) : (def.modifiers ?? [])
    pool.push(...ms.map((m) => withSource(m, def.name)))
    return { id: f.id, name: def.name, param: f.param, known: true }
  })
  const featSlots = {
    available:
      featsByLevel(charLevel) +
      race.bonusFeats +
      classes.reduce((n, c) => n + (c.def.bonusFeatLevels ?? []).filter((l) => l <= c.level).length, 0),
    used: feats.length,
  }
  if (featSlots.used > featSlots.available) issues.push({ code: 'feats-over-limit' })

  const bab = classes.reduce((n, c) => n + baseAttack(c.def.bab, c.level), 0)

  // --- HP ---
  let hitDice = 0
  let conHp = 0
  character.levels.forEach((lv, i) => {
    const def = rules.classes[lv.class]
    if (def && lv.hp > def.hitDie) issues.push({ code: 'hp-over-hit-die', detail: String(i + 1) })
    if (def && i === 0 && lv.hp !== def.hitDie) issues.push({ code: 'first-level-hp-not-max' })
    hitDice += lv.hp
    conHp += Math.max(1, lv.hp + am.con) - lv.hp // mínimo 1 HP por nivel
  })
  const fcbHp = character.levels.filter((lv) => lv.fcb === 'hp').length
  const hp = stat([
    mod('hp', 'base', hitDice, 'hit-dice'),
    mod('hp', 'ability', conHp, 'con'),
    ...(fcbHp ? [mod('hp', 'base', fcbHp, 'fcb')] : []),
    ...pick('hp'),
  ])

  // --- Salvaciones e iniciativa ---
  const save = (key: 'fort' | 'ref' | 'will', ability: Ability) =>
    stat([
      mod(`save.${key}`, 'base', classes.reduce((n, c) => n + baseSave(c.def.saves[key], c.level), 0), 'base-save'),
      mod(`save.${key}`, 'ability', am[ability], ability),
      ...pick('saves', `save.${key}`),
    ])
  const saves = { fort: save('fort', 'con'), ref: save('ref', 'dex'), will: save('will', 'wis') }
  const initiative = stat([mod('initiative', 'ability', am.dex, 'dex'), ...pick('initiative')])

  // --- Carga (kg) ---
  // Va antes de la CA: la carga media o pesada limita la DES, penaliza y frena, como la armadura (vale el peor).
  const eq = character.equipment
  const weights = [eq.armor?.weight, eq.shield?.weight, ...eq.weapons.map((w) => w.weight), ...eq.items.map((i) => (i.weight === undefined ? undefined : i.weight * i.quantity))]
  const listed = weights.filter((w): w is number => w !== undefined)
  const load = listed.length ? computeLoad(abilities.str.score.total, size, listed.reduce((a, b) => a + b, 0)) : null
  const loadSource = load && load.category !== 'light' ? `load-${load.category}` : null

  // --- CA ---
  const { armor, shield } = character.equipment
  const acpOf = (g?: { armorCheckPenalty: number; masterwork: boolean }) =>
    g ? Math.min(0, g.armorCheckPenalty + (g.masterwork ? 1 : 0)) : 0
  const gearAcp = acpOf(armor) + acpOf(shield)
  const loadAcp = load?.acp ?? 0
  const armorCheckPenalty = Math.min(gearAcp, loadAcp)
  // En el desglose de las habilidades, la fuente es la que manda (armadura o carga)
  const acpSource = loadAcp < gearAcp && loadSource ? loadSource : 'armor-check-penalty'
  const maxDex = Math.min(armor?.maxDex ?? Infinity, shield?.maxDex ?? Infinity, load?.maxDex ?? Infinity)
  const acMods: Modifier[] = [
    mod('ac', 'base', 10, 'base'),
    ...(armor ? [mod('ac', 'armor', armor.armorBonus + armor.enhancement, armor.name)] : []),
    ...(shield ? [mod('ac', 'shield', shield.shieldBonus + shield.enhancement, shield.name)] : []),
    mod('ac', 'ability', Math.min(am.dex, maxDex), 'dex'),
    ...(sz.mod ? [mod('ac', 'size', sz.mod, 'size')] : []),
    ...pick('ac'),
  ]
  const ac = {
    normal: stat(acMods),
    touch: stat(acMods.filter((m) => !TOUCH_EXCLUDED.has(m.type))),
    // desprevenido: pierde el bono de DES (no la penalización) y los dodge
    flatFooted: stat(acMods.filter((m) => !(m.type === 'dodge' || (m.type === 'ability' && m.value > 0)))),
  }

  // --- Maniobras ---
  const specialSize = (target: Target) => (sz.special ? [mod(target, 'size', sz.special, 'size')] : [])
  const cmb = stat([mod('cmb', 'base', bab, 'bab'), mod('cmb', 'ability', am.str, 'str'), ...specialSize('cmb'), ...pick('cmb')])
  const cmd = stat([
    mod('cmd', 'base', 10, 'base'),
    mod('cmd', 'base', bab, 'bab'),
    mod('cmd', 'ability', am.str, 'str'),
    mod('cmd', 'ability', am.dex, 'dex'),
    ...specialSize('cmd'),
    ...pick('ac').filter((m) => CMD_AC_TYPES.has(m.type)).map((m): Modifier => ({ ...m, target: 'cmd' })),
    ...pick('cmd'),
  ])

  // --- Velocidad ---
  // Armadura media o pesada y carga media o pesada frenan igual: se aplica una sola vez, la peor, con su fuente.
  const speedMods = [mod('speed', 'base', race.speed, 'base')]
  const armorSlow = armor && armor.category !== 'light' ? armoredSpeed(race.speed) - race.speed : 0
  const loadSlow = load ? loadedSpeed(race.speed, load.category) - race.speed : 0
  if (loadSlow < armorSlow && loadSource) speedMods.push(mod('speed', 'base', loadSlow, loadSource))
  else if (armorSlow && armor) speedMods.push(mod('speed', 'base', armorSlow, armor.name))
  const speed = stat([...speedMods, ...pick('speed')])

  // --- Cambio de ataque por concentración (Spell Combat a la defensiva) ---
  // Tope: el mod. del atributo de lanzamiento de la clase que tiene la variante. Lo que pide la sesión se recorta.
  const tradeVariants = classes.flatMap(({ def, level }) =>
    (def.attackVariants ?? []).filter((v) => v.defensiveTrade && level >= v.minLevel).map((v) => ({ id: v.id, ability: def.spellcasting?.ability })),
  )
  const tradeMax = Math.max(0, ...tradeVariants.map((v) => (v.ability ? am[v.ability] : 0)))
  const trade = Math.max(0, Math.min(session.defensiveTrade ?? 0, tradeMax))
  const tradeFor = (variantId: string, target: 'attack' | 'concentration'): Modifier[] =>
    trade && tradeVariants.some((v) => v.id === variantId)
      ? [target === 'attack' ? mod('attack', 'untyped', -trade, TRADE_SOURCE) : mod('concentration', 'circumstance', trade, TRADE_SOURCE)]
      : []

  // --- Ataques ---
  const attacks = character.equipment.weapons.map((w): AttackLine => {
    const melee = isMelee(w.category)
    const attackAbility: Ability = melee ? 'str' : 'dex'
    const enhAttack = Math.max(w.enhancement, w.masterwork ? 1 : 0) // masterwork no se suma a la mejora mágica
    const attackMods = [
      mod('attack', 'base', bab, 'bab'),
      mod('attack', 'ability', am[attackAbility], attackAbility),
      ...(sz.mod ? [mod('attack', 'size', sz.mod, 'size')] : []),
      ...(enhAttack ? [mod('attack', 'enhancement', enhAttack, w.name)] : []),
      ...pick('attack', melee ? 'attack.melee' : 'attack.ranged'),
    ]
    const damage = stat([
      ...(w.category !== 'ranged' ? [mod('damage', 'ability', strToDamage(w.category, am.str), 'str')] : []),
      ...(w.enhancement ? [mod('damage', 'enhancement', w.enhancement, w.name)] : []),
      ...pick('damage', melee ? 'damage.melee' : 'damage.ranged'),
    ])
    const damageText = w.damage + (damage.total ? signed(damage.total) : '')
    const variant = (id: string, name: string, extra: Modifier[]): AttackVariant => {
      const attack = stat([...attackMods, ...extra])
      return { id, name, attack, fullAttack: iterativeAttacks(bab).map((b) => attack.total - bab + b), damage, damageText }
    }
    const variants = [variant('standard', 'Standard', [])]
    for (const c of classes) {
      for (const v of c.def.attackVariants ?? []) {
        if (c.level >= v.minLevel && v.appliesTo(w)) variants.push(variant(v.id, v.name, [...v.modifiers.map((m) => withSource(m, v.name)), ...tradeFor(v.id, 'attack')]))
      }
    }
    return { id: w.id, name: w.name, category: w.category, critical: w.critical, damageType: w.damageType, range: w.range, variants }
  })

  // --- Ataques de toque (conjuros): sin arma, con las variantes de clase (Spell Combat −2) ---
  const touchMods = (melee: boolean): Modifier[] => [
    mod('attack', 'base', bab, 'bab'),
    mod('attack', 'ability', melee ? am.str : am.dex, melee ? 'str' : 'dex'),
    ...(sz.mod ? [mod('attack', 'size', sz.mod, 'size')] : []),
    ...pick('attack', melee ? 'attack.melee' : 'attack.ranged'),
  ]
  const touchLine = (extra: Modifier[]) => ({ melee: stat([...touchMods(true), ...extra]), ranged: stat([...touchMods(false), ...extra]) })
  const touch: ComputedSheet['touch'] = { standard: touchLine([]) }
  for (const c of classes) {
    for (const v of c.def.attackVariants ?? []) {
      if (c.level >= v.minLevel) touch[v.id] = touchLine([...v.modifiers.map((m) => withSource(m, v.name)), ...tradeFor(v.id, 'attack')])
    }
  }

  // --- Skills ---
  const ranks = character.skills
  for (const [key, r] of Object.entries(ranks)) {
    const { baseId, subtype } = splitSkillKey(key)
    const def = SKILL_BY_ID.get(baseId)
    if (!def || (subtype && !def.subtypes)) issues.push({ code: 'unknown-skill', detail: key })
    if (r > charLevel) issues.push({ code: 'ranks-over-level', detail: key })
  }
  const classSkills = new Set(classes.flatMap((c) => c.def.classSkills))
  const skillLine = (def: SkillDef, key: string, subtype?: string): SkillLine => {
    const r = ranks[key] ?? 0
    const classSkill = classSkills.has(def.id)
    const target = `skill.${def.id}` as const
    const mods = [mod(target, 'ability', am[def.ability], def.ability)]
    if (r > 0) mods.push(mod(target, 'base', r, 'ranks'))
    if (r > 0 && classSkill) mods.push(mod(target, 'base', 3, 'class-skill')) // +3 solo con ≥1 rango
    if (def.acp && armorCheckPenalty) mods.push(mod(target, 'base', armorCheckPenalty, acpSource))
    const sizeBonus = def.id === 'stealth' ? sz.stealth : def.id === 'fly' ? sz.fly : 0
    if (sizeBonus) mods.push(mod(target, 'size', sizeBonus, 'size'))
    return {
      id: key,
      baseId: def.id,
      name: subtype ? `${def.name} (${subtype})` : def.name,
      ability: def.ability,
      ranks: r,
      classSkill,
      trainedOnly: def.trainedOnly,
      armorCheck: def.acp,
      usable: !def.trainedOnly || r > 0,
      stat: stat([...mods, ...pick('skills', target, `skill.${key}`)]),
    }
  }
  const skills = SKILLS.flatMap((def) => {
    if (!def.subtypes) return [skillLine(def, def.id)]
    const subs = Object.keys(ranks)
      .map((k) => ({ key: k, ...splitSkillKey(k) }))
      .filter((s) => s.baseId === def.id && s.subtype)
    return subs.length ? subs.map((s) => skillLine(def, s.key, s.subtype)) : [skillLine(def, def.id)]
  })

  // Rangos por nivel: clase + INT de ese nivel (mín. 1) + raza + FCB. Los aumentos de INT no son retroactivos.
  const intModAt = (level: number) =>
    abilityMod(character.abilities.int + racialBonus('int') + increasesUpTo('int', level))
  const skillRanks = {
    available: character.levels.reduce((n, lv, i) => {
      const def = rules.classes[lv.class]
      const classPart = def ? Math.max(1, def.skillRanks + intModAt(i + 1)) : 0
      return n + classPart + race.skillRanksPerLevel + (lv.fcb === 'skill' ? 1 : 0)
    }, 0),
    spent: Object.values(ranks).reduce((n, r) => n + r, 0),
  }
  if (skillRanks.spent > skillRanks.available) issues.push({ code: 'skill-ranks-overspent' })

  // --- Conjuros ---
  const spellcasting = classes.flatMap(({ def, level }): SpellcastingLine[] => {
    const sc = def.spellcasting
    if (!sc) return []
    const castMod = am[sc.ability]
    const casterLevel = stat([mod('caster-level', 'base', level, 'class-level'), ...pick('caster-level')])
    const concMods = [
      mod('concentration', 'base', casterLevel.total, 'caster-level'),
      mod('concentration', 'ability', castMod, sc.ability),
      ...pick('concentration'),
    ]
    const concentration = stat(concMods)
    const concentrationBy: Record<string, Stat> = Object.fromEntries(
      (def.attackVariants ?? []).flatMap((v): [string, Stat][] => {
        const extra = tradeFor(v.id, 'concentration')
        return extra.length ? [[v.id, stat([...concMods, ...extra])]] : []
      }),
    )
    const row = sc.spellsPerDay[level - 1] ?? []
    const allowed = sc.armorWithoutFailure?.(level) ?? null
    const armorAsf = armor && !(allowed && ARMOR_RANK[armor.category] <= ARMOR_RANK[allowed]) ? armor.arcaneSpellFailure : 0
    return [{
      classId: def.id,
      ability: sc.ability,
      casterLevel,
      concentration,
      concentrationBy,
      spellsPerDay: row.map((n, s) => n + bonusSpells(castMod, s)),
      bonusSpells: row.map((_, s) => bonusSpells(castMod, s)),
      dcs: row.map((_, s) => spellDc(s, castMod)),
      arcaneSpellFailure: sc.tradition === 'arcane' ? Math.min(100, armorAsf + (shield?.arcaneSpellFailure ?? 0)) : 0,
    }]
  })

  // Preparación por defecto (sesión nueva de #/play): cada conjuro en el spellbook de su nivel, los trucos
  // una sola vez y no más que los /día de la primera clase lanzadora.
  const perDay = spellcasting[0]?.spellsPerDay ?? []
  for (const [level, names] of Object.entries(character.defaultPrepared)) {
    const book = character.spellbook[level] ?? []
    names.forEach((name, i) => {
      if (!book.includes(name)) issues.push({ code: 'default-prepared-invalid', detail: name })
      else if (level === '0' && names.indexOf(name) !== i) issues.push({ code: 'default-prepared-invalid', detail: name })
    })
    const max = perDay[Number(level)] ?? 0
    if (names.length > max) issues.push({ code: 'default-prepared-invalid', detail: `${level}: ${names.length}/${max}` })
  }

  // --- Recursos y rasgos ---
  const resources = classes.flatMap(({ def, level }) =>
    (def.resources ?? []).map((r): ResourceLine => {
      const ctx: RuleCtx = { level, mods: am }
      const max = stat([mod(`resource.${r.id}`, 'base', r.max(ctx), def.name), ...pick(`resource.${r.id}`)])
      return { id: r.id, name: r.name, classId: def.id, max, details: r.details?.(ctx) ?? {} }
    }),
  )
  const features: FeatureLine[] = [
    ...race.features.map((f) => ({ ...f, source: race.id })),
    ...classes.flatMap(({ def, level }) =>
      def.features.filter((f) => f.level <= level).map((f) => ({ ...f, source: def.id })),
    ),
  ]

  const actions = classes.flatMap(({ def, level }) =>
    (def.actions ?? []).filter((a) => a.minLevel <= level).map((a): ActionLine => ({ ...a, classId: def.id })),
  )

  // --- Idiomas y XP ---
  const languages = {
    known: [...race.languages, ...character.languages],
    pending: Math.max(0, am.int + (ranks['linguistics'] ?? 0) - character.languages.length),
  }
  const xp = { current: character.xp, next: xpForNextLevel(character.xpTrack, charLevel), track: character.xpTrack }

  return {
    name: character.name,
    race: race.name,
    size,
    alignment: character.alignment,
    bio: character.bio ?? {},
    level: charLevel,
    xp,
    languages,
    classes: classes.map(({ def, level }) => ({ id: def.id, name: def.name, level })),
    abilities,
    hp,
    bab,
    initiative,
    ac,
    armorCheckPenalty,
    saves,
    cmb,
    cmd,
    speed,
    load,
    attacks,
    touch,
    defensiveTrade: tradeVariants.length && tradeMax ? { max: tradeMax, value: trade, variants: tradeVariants.map((v) => v.id) } : null,
    skills,
    skillRanks,
    feats,
    featSlots,
    spellcasting,
    resources,
    features,
    actions,
    issues,
  }
}
