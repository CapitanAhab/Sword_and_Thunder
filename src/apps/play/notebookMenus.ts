import { localName, localNote, localSource } from '../../data/names'
import {
  addCoins, addItem, addXp, backupText, COINS, parseBackup, removeItem, setNotes, setQuantity, toggleArmor, toggleEquipped, toggleShield,
  toggleWeapon, type Coin, type Notebook,
} from '../../core/notebook'
import { itemsLeft, type Session } from '../../core/session'
import type { Character } from '../../core/schema'
import { formatInt } from '../sheet/labels'
import type { FormSpec, FormValues } from './FormCard'
import type { MenuCtx, MenuItem } from './menus'

// Lo que se anota en la mesa: Notas, Inventario, Oro y XP, Respaldo. Filas de la pestaña Personaje y sus submenús.
export interface Book {
  base: Character // el personaje del JSON: Inventario muestra también lo que te sacaste
  notebook: Notebook
  update: (fn: (nb: Notebook) => Notebook) => void
  setSession: (s: Session) => void
}

const onOff = (on: boolean): MenuItem['badge'] => ({ text: on ? 'ON' : 'OFF', tone: on ? 'on' : 'muted' })

// --- Oro y XP ---
function amountForm(c: MenuCtx, book: Book, id: string, title: string, have: string, add: (nb: Notebook, by: number) => Notebook): FormSpec {
  const apply = (sign: number) => (v: FormValues) => {
    const n = Number(v.amount)
    if (!Number.isInteger(n) || n <= 0) return c.t('play.form.badNumber')
    book.update((nb) => add(nb, sign * n))
  }
  return {
    id,
    title,
    note: `${c.t('play.form.have')} ${have}`,
    fields: [{ id: 'amount', label: c.t('play.form.amount'), kind: 'number', value: '' }],
    actions: [
      { id: 'subtract', label: c.t('play.form.subtract'), run: apply(-1) },
      { id: 'add', label: c.t('play.form.add'), run: apply(1) },
    ],
  }
}

function purse(c: MenuCtx, book: Book): MenuItem[] {
  const { character, sheet, t: tr } = c
  const next = sheet.xp.next === null ? '' : ` / ${formatInt(sheet.xp.next)}`
  const xpText = `${formatInt(character.xp)}${next}`
  const coinRow = (coin: Coin): MenuItem => {
    const title = tr(`play.coin.${coin}`)
    const text = `${formatInt(character.wealth[coin])} ${tr(`gold.${coin}`)}`
    return {
      id: `coin-${coin}`,
      label: title,
      badge: { text },
      detail: { title, line: text },
      action: { type: 'form', form: amountForm(c, book, `coin-${coin}`, title, text, (nb, by) => addCoins(nb, book.base, coin, by)) },
    }
  }
  return [
    {
      id: 'xp',
      label: tr('sheet.xp'),
      badge: { text: xpText },
      detail: { title: tr('sheet.xp'), line: xpText },
      action: { type: 'form', form: amountForm(c, book, 'xp', tr('sheet.xp'), xpText, (nb, by) => addXp(nb, book.base, by)) },
    },
    ...COINS.map(coinRow),
  ]
}

// --- Inventario ---
function addItemForm(c: MenuCtx, book: Book): FormSpec {
  const tr = c.t
  return {
    id: 'add-item',
    title: tr('play.addItem'),
    fields: [
      { id: 'name', label: tr('play.form.name'), kind: 'text', value: '' },
      { id: 'quantity', label: tr('play.form.quantity'), kind: 'number', value: '1' },
      { id: 'weight', label: tr('play.form.weight'), kind: 'decimal', value: '' },
    ],
    actions: [{
      id: 'save',
      label: tr('play.form.save'),
      run: (v) => {
        const name = v.name?.trim()
        const quantity = Number(v.quantity)
        const weightText = v.weight?.trim().replace(',', '.') ?? ''
        const weight = Number(weightText)
        if (!name) return tr('play.form.noName')
        if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(weight) || weight < 0) return tr('play.form.badNumber')
        book.update((nb) => addItem(nb, { name, quantity, ...(weightText ? { weight } : {}) }))
      },
    }],
  }
}

function inventory(c: MenuCtx, book: Book): MenuItem[] {
  const { session, t: tr } = c
  const { base, notebook: nb } = book
  const { armor, shield, weapons } = base.equipment
  const onItem = (id: string, title: string, on: boolean, update: (n: Notebook) => Notebook): MenuItem => ({
    id: `gear-${id}`,
    label: title,
    badge: onOff(on),
    detail: { title, line: tr('play.gearNote') },
    action: { type: 'book', on: !on, update },
  })
  const items = [...base.equipment.items, ...nb.addedItems].filter((i) => !nb.removedItems.includes(i.id))
  return [
    { id: 'add-item', label: `+ ${tr('play.addItem')}`, detail: { title: tr('play.addItem'), line: tr('play.addItemNote') }, action: { type: 'form', form: addItemForm(c, book) } },
    ...(armor ? [onItem('armor', localSource(armor.name), !nb.armorOff, toggleArmor)] : []),
    ...(shield ? [onItem('shield', localSource(shield.name), !nb.shieldOff, toggleShield)] : []),
    ...weapons.map((w) => onItem(w.id, localName(w.id, w.name), !nb.weaponsOff.includes(w.id), (n) => toggleWeapon(n, w.id))),
    ...items.map((i): MenuItem => {
      const counted = i.consumable || (nb.quantity[i.id] ?? i.quantity) > 1
      const title = localName(i.id, i.name)
      return {
        id: `stock-${i.id}`,
        label: title,
        badge: counted ? { text: `×${itemsLeft(c.character, session, i.id)}` } : onOff(!nb.unequipped.includes(i.id)),
        detail: { title, ...(i.notes ? { line: localNote(i.id, i.notes) ?? i.notes } : {}) },
        action: { type: 'open', menu: `stock:${i.id}` },
      }
    }),
  ]
}

function stockMenu(c: MenuCtx, book: Book, id: string): MenuItem[] {
  const { t: tr } = c
  const { base, notebook: nb } = book
  const item = [...base.equipment.items, ...nb.addedItems].find((i) => i.id === id)
  if (!item) return []
  const title = localName(id, item.name)
  const on = !nb.unequipped.includes(id)
  return [
    { id: 'quantity', label: tr('play.form.quantity'), badge: { text: `×${itemsLeft(c.character, c.session, id)}` }, detail: { title, line: tr('play.quantityNote') }, action: { type: 'open', menu: `qty:${id}` } },
    { id: 'equipped', label: tr('play.equipped'), badge: onOff(on), detail: { title, line: tr('play.equippedNote') }, action: { type: 'book', on: !on, update: (n) => toggleEquipped(n, id) } },
    { id: 'remove-item', label: tr('play.removeItem'), hold: true, detail: { title, line: tr('play.removeItemNote') }, action: { type: 'book', on: false, back: true, update: (n) => removeItem(n, id) } },
  ]
}

function qtyMenu(c: MenuCtx, book: Book, id: string): MenuItem[] {
  const item = [...book.base.equipment.items, ...book.notebook.addedItems].find((i) => i.id === id)
  if (!item) return []
  const title = localName(id, item.name)
  return [{
    id: 'qty-edit',
    label: c.t('play.form.quantity'),
    badge: { text: `×${itemsLeft(c.character, c.session, id)}` },
    detail: { title, line: c.t('play.quantityNote'), note: c.t('play.valueNote') },
    action: { type: 'prepare' },
  }]
}

// Con objetos ya usados, lo que se cambia es lo que queda: la cantidad total suma los usados.
export const stockDelta = (nb: Notebook, c: Character, id: string, d: number): Notebook => {
  const item = c.equipment.items.find((i) => i.id === id)
  return item ? setQuantity(nb, id, Math.max(0, item.quantity + d)) : nb
}

// --- Respaldo ---
function backup(c: MenuCtx, book: Book): MenuItem[] {
  const tr = c.t
  const text = backupText(book.notebook, c.session)
  return [
    {
      id: 'backup-copy',
      label: tr('play.backupCopy'),
      detail: { title: tr('play.backupCopy'), line: tr('play.backupCopyNote') },
      action: {
        type: 'form',
        copy: text,
        form: {
          id: 'backup-copy',
          title: tr('play.backupCopy'),
          note: tr('play.backupByHand'),
          fields: [{ id: 'text', label: tr('play.backup'), kind: 'area', value: text, readOnly: true }],
          actions: [],
        },
      },
    },
    {
      id: 'backup-paste',
      label: tr('play.backupPaste'),
      detail: { title: tr('play.backupPaste'), line: tr('play.backupPasteNote') },
      action: {
        type: 'form',
        form: {
          id: 'backup-paste',
          title: tr('play.backupPaste'),
          note: tr('play.backupPasteNote'),
          fields: [{ id: 'text', label: tr('play.backup'), kind: 'area', value: '' }],
          actions: [{
            id: 'replace',
            label: tr('play.backupReplace'),
            hold: true,
            run: (v) => {
              const parsed = parseBackup(v.text ?? '')
              if (!parsed) return tr('play.backupInvalid')
              book.update(() => parsed.notebook)
              book.setSession(parsed.session)
            },
          }],
        },
      },
    },
  ]
}

// --- Filas de Personaje ---
export function bookRows(c: MenuCtx): MenuItem[] {
  const { book, t: tr } = c
  if (!book) return []
  const notes = c.character.notes ?? ''
  return [
    {
      id: 'notes',
      label: tr('play.notes'),
      detail: { title: tr('play.notes'), line: notes || tr('play.notesEmpty') },
      action: {
        type: 'form',
        form: {
          id: 'notes',
          title: tr('play.notes'),
          fields: [{ id: 'text', label: tr('play.notes'), kind: 'area', value: notes }],
          actions: [{ id: 'save', label: tr('play.form.save'), run: (v) => book.update((nb) => setNotes(nb, v.text ?? '')) }],
        },
      },
    },
    { id: 'inventory', label: tr('play.inventory'), detail: { title: tr('play.inventory'), line: tr('play.inventoryNote') }, action: { type: 'open', menu: 'inventory' } },
    { id: 'purse', label: tr('play.purse'), detail: { title: tr('play.purse'), line: tr('play.purseNote') }, action: { type: 'open', menu: 'purse' } },
    { id: 'backup', label: tr('play.backup'), detail: { title: tr('play.backup'), line: tr('play.backupNote') }, action: { type: 'open', menu: 'backup' } },
  ]
}

export function bookMenu(kind: string, c: MenuCtx, id: string): MenuItem[] {
  const { book } = c
  if (!book) return []
  switch (kind) {
    case 'inventory': return inventory(c, book)
    case 'stock': return stockMenu(c, book, id)
    case 'qty': return qtyMenu(c, book, id)
    case 'purse': return purse(c, book)
    case 'backup': return backup(c, book)
    default: return []
  }
}
