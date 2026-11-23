import {
  canLevelUp, confirmLevelUp, levelUpState, setLevelArcana, setLevelFcb, setLevelFeat, setLevelHp, startLevelUp, toggleLevelSpell, undoLevelUp,
  type LevelUpMissing,
} from '../../core/notebook'
import { db } from '../../data'
import { spells } from '../../data/spells'
import { localName, localSpell, localSummary } from '../../data/names'
import { formatValue } from '../sheet/labels'
import type { Book } from './notebookMenus'
import type { MenuCtx, MenuItem } from './menus'

// Subir de nivel: Personaje › ▲ Subir a nivel N y sus submenús, y Deshacer nivel en la Libreta. Lo que falta, los topes
// y los candidatos salen de core/notebook.ts (levelUpState); acá solo se arman las filas.

const fill = (text: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text)
const onOff = (on: boolean): MenuItem['badge'] => ({ text: on ? 'ON' : 'OFF', tone: on ? 'on' : 'muted' })
const count = (n: number, of: number): MenuItem['badge'] => ({ text: `${n}/${of}`, tone: n >= of ? 'on' : undefined })

// La fila de Personaje: solo con la XP del nivel siguiente (y hasta el tope del asistente).
export function levelUpRow(c: MenuCtx): MenuItem[] {
  if (!c.book || !canLevelUp(c.sheet)) return []
  const label = fill(c.t('levelUp.row'), { n: c.sheet.level + 1 })
  return [{ id: 'levelup', label, detail: { title: label, line: c.t('levelUp.rowNote'), note: c.t('levelUp.draftNote') }, action: { type: 'open', menu: 'levelup' } }]
}

// La fila de la Libreta: borra el último nivel subido acá.
export function levelUpUndoRow(c: MenuCtx, book: Book): MenuItem[] {
  if (!book.notebook.levelUps.some((u) => u.done)) return []
  const n = c.sheet.level
  const label = fill(c.t('levelUp.undo'), { n })
  return [{ id: 'levelup-undo', label, hold: true, detail: { title: label, line: fill(c.t('levelUp.undoNote'), { n }) }, action: { type: 'book', on: false, update: undoLevelUp } }]
}

const draftUpdate = (fn: Parameters<Book['update']>[0]): Parameters<Book['update']>[0] => (nb) => fn(startLevelUp(nb))

function main(c: MenuCtx, book: Book): MenuItem[] {
  const tr = c.t
  const { draft, status } = levelUpState(book.base, book.notebook, db)
  const die = status.hitDie
  const hpLabel = fill(tr('levelUp.hp'), { die })
  const rankUsed = Object.values(draft.skills).reduce((n, r) => n + r, 0)
  const rankTotal = rankUsed + status.ranksLeft
  const ranksLine = status.ranksLeft < 0 ? fill(tr('levelUp.ranksOver'), { n: -status.ranksLeft }) : fill(tr('levelUp.ranksLeft'), { n: status.ranksLeft })
  const fcbHp = draft.fcb === 'hp'
  const confirmLabel = fill(tr('levelUp.confirm'), { n: status.level })
  const missing = status.missing.map((m: LevelUpMissing) => tr(`levelUp.missing.${m}`)).join(', ')
  const rows: MenuItem[] = [
    {
      id: 'levelup-hp',
      label: hpLabel,
      badge: { text: `${draft.hp ?? '—'}/${die}`, tone: draft.hp ? 'on' : undefined },
      detail: { title: hpLabel, line: tr('levelUp.hpNote') },
      action: {
        type: 'form',
        form: {
          id: 'levelup-hp',
          title: hpLabel,
          note: tr('levelUp.hpNote'),
          fields: [{ id: 'hp', label: fill(tr('levelUp.hpField'), { die }), kind: 'number', value: draft.hp ? String(draft.hp) : '' }],
          actions: [{
            id: 'save',
            label: tr('play.form.save'),
            run: (v) => {
              const n = Number(v.hp)
              if (!Number.isInteger(n) || n < 1 || n > die) return tr('play.form.badNumber')
              book.update(draftUpdate((nb) => setLevelHp(nb, n)))
            },
          }],
        },
      },
    },
    {
      id: 'levelup-fcb',
      label: tr('levelUp.fcb'),
      badge: { text: tr(fcbHp ? 'levelUp.fcbHp' : 'levelUp.fcbSkill') },
      detail: { title: tr('levelUp.fcb'), line: tr('levelUp.fcbNote') },
      action: { type: 'book', on: true, update: draftUpdate((nb) => setLevelFcb(nb, fcbHp ? 'skill' : 'hp')) },
    },
    {
      id: 'levelup-ranks',
      label: tr('levelUp.ranks'),
      badge: { text: `${rankUsed}/${rankTotal}`, tone: status.ranksLeft === 0 ? 'on' : undefined },
      detail: { title: tr('levelUp.ranks'), line: ranksLine, note: fill(tr('levelUp.rankCap'), { n: status.rankCap }) },
      action: { type: 'open', menu: 'levelup-ranks' },
    },
  ]
  if (status.spells > 0) {
    rows.push({
      id: 'levelup-spells',
      label: tr('levelUp.spells'),
      badge: count(draft.spells.length, status.spells),
      detail: { title: tr('levelUp.spells'), line: tr('levelUp.spellsNote'), note: draft.spells.map((s) => localSpell(s.name)).join(', ') || undefined },
      action: { type: 'open', menu: 'levelup-spells' },
    })
  }
  if (status.feat) {
    const def = draft.feat ? db.feats[draft.feat] : undefined
    rows.push({
      id: 'levelup-feat',
      label: tr('levelUp.feat'),
      badge: count(draft.feat ? 1 : 0, 1),
      detail: { title: tr('levelUp.feat'), line: def ? localName(def.id, def.name) : tr('levelUp.featNote') },
      action: { type: 'open', menu: 'levelup-feat' },
    })
  }
  if (status.arcana) {
    rows.push({
      id: 'levelup-arcana',
      label: tr('levelUp.arcana'),
      badge: count(draft.arcana ? 1 : 0, 1),
      detail: { title: tr('levelUp.arcana'), line: draft.arcana?.name ?? tr('levelUp.arcanaNote'), note: draft.arcana?.notes },
      action: {
        type: 'form',
        form: {
          id: 'levelup-arcana',
          title: tr('levelUp.arcana'),
          note: tr('levelUp.arcanaNote'),
          fields: [
            { id: 'name', label: tr('play.form.name'), kind: 'text', value: draft.arcana?.name ?? '' },
            { id: 'notes', label: tr('play.notes'), kind: 'area', value: draft.arcana?.notes ?? '' },
          ],
          actions: [{
            id: 'save',
            label: tr('play.form.save'),
            run: (v) => {
              const name = v.name?.trim()
              if (!name) return tr('play.form.noName')
              const notes = v.notes?.trim()
              book.update(draftUpdate((nb) => setLevelArcana(nb, notes ? { name, notes } : { name })))
            },
          }],
        },
      },
    })
  }
  const ready = status.missing.length === 0
  rows.push({
    id: 'levelup-confirm',
    label: confirmLabel,
    hold: ready,
    blocked: !ready,
    detail: { title: confirmLabel, line: tr('levelUp.confirmNote'), ...(ready ? {} : { warn: fill(tr('levelUp.missing'), { list: missing }) }) },
    action: ready ? { type: 'book', on: true, back: true, update: confirmLevelUp } : { type: 'none' },
  })
  return rows
}

// Una fila por habilidad: − / + cambian los rangos nuevos (PlayScreen → stepLevelRank, con los topes del core).
// Primero las de clase. La fila: atributo y rangos de antes → ahora, y el total que queda; la franja, el detalle.
function ranks(c: MenuCtx, book: Book): MenuItem[] {
  const tr = c.t
  const { draft, preview, status } = levelUpState(book.base, book.notebook, db)
  const left = status.ranksLeft < 0 ? fill(tr('levelUp.ranksOver'), { n: -status.ranksLeft }) : fill(tr('levelUp.ranksLeft'), { n: status.ranksLeft })
  const list = [...preview.skills.filter((s) => s.classSkill), ...preview.skills.filter((s) => !s.classSkill)]
  return list.map((s, i): MenuItem => {
    const added = draft.skills[s.id] ?? 0
    const before = s.ranks - added
    const name = localName(s.id, s.name)
    const ability = tr(`ability.${s.ability}`)
    const ranksText = added ? `${before}→${s.ranks}` : String(s.ranks)
    const oldTotal = c.sheet.skills.find((x) => x.id === s.id)?.stat.total
    const total = formatValue(s.stat.total, true)
    return {
      id: `levelup-rank-${s.id}`,
      label: name,
      section: i === 0 || s.classSkill !== list[i - 1]?.classSkill ? tr(s.classSkill ? 'play.skills.class' : 'play.skills.other') : undefined,
      hint: `${ability} ${ranksText}`,
      badge: { text: total, tone: added ? 'on' : undefined },
      detail: {
        title: name,
        line: fill(tr('levelUp.rankRow'), { ranks: added ? `${before} → ${s.ranks}` : String(s.ranks), cap: status.rankCap }),
        note: fill(tr('levelUp.totalRow'), { total: oldTotal !== undefined && oldTotal !== s.stat.total ? `${formatValue(oldTotal, true)} → ${total}` : total }),
        extra: left,
      },
      field: s.id,
      action: { type: 'prepare' },
    }
  })
}

function spellChoices(c: MenuCtx, book: Book): MenuItem[] {
  const tr = c.t
  const { draft, status } = levelUpState(book.base, book.notebook, db)
  if (!status.spellChoices.length) {
    return [{ id: 'levelup-spells-none', label: tr('levelUp.noSpells'), detail: { title: tr('levelUp.spells'), line: tr('levelUp.noSpells') }, action: { type: 'none' } }]
  }
  const full = draft.spells.length >= status.spells
  const byName = [...status.spellChoices].sort((x, y) => localSpell(x.name).localeCompare(localSpell(y.name), 'es'))
  return byName.map((sp): MenuItem => {
    const on = draft.spells.some((x) => x.level === sp.level && x.name === sp.name)
    const name = localSpell(sp.name)
    const item: MenuItem = {
      id: `levelup-spell-${sp.name}`,
      label: name,
      badge: onOff(on),
      spell: sp,
      detail: { title: name, line: spells[sp.name]?.summary, note: `${tr('play.level')} ${sp.level}` },
      action: { type: 'book', on: !on, update: draftUpdate((nb) => toggleLevelSpell(nb, sp.level, sp.name)) },
    }
    return full && !on ? { ...item, blocked: true, detail: { ...item.detail, warn: fill(tr('levelUp.spellsFull'), { n: status.spells }) }, action: { type: 'none' } } : item
  })
}

function featChoices(book: Book): MenuItem[] {
  const { draft, status } = levelUpState(book.base, book.notebook, db)
  return status.featChoices.map((id): MenuItem => {
    const def = db.feats[id]
    const name = localName(id, def?.name ?? id)
    const on = draft.feat === id
    return {
      id: `levelup-feat-${id}`,
      label: name,
      badge: onOff(on),
      detail: { title: name, line: localSummary(id) },
      action: { type: 'book', on: !on, update: draftUpdate((nb) => setLevelFeat(nb, on ? null : id)) },
    }
  })
}

export function levelUpMenu(kind: string, c: MenuCtx): MenuItem[] {
  const { book } = c
  if (!book) return []
  switch (kind) {
    case 'levelup': return main(c, book)
    case 'levelup-ranks': return ranks(c, book)
    case 'levelup-spells': return spellChoices(c, book)
    case 'levelup-feat': return featChoices(book)
    default: return []
  }
}
