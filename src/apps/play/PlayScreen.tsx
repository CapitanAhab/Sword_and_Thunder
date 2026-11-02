import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { useT } from '../../i18n/useT'
import { href } from '../../router'
import { useCharacter } from '../../state/CharacterContext'
import { SessionProvider, useSession } from '../../state/SessionContext'
import {
  addFreeEffect, adjustPrepared, afterAction, clearUndo, emptyFreeDraft, hpState, nextTurn, prepare, recordAction, rest, sameUndo, setSpellCombatTrade, timesCast,
  trackUndo, turnSummary, undoLast,
  type FreeDraft, type Session, type SessionFix, type SpellCounts,
} from '../../core/session'
import { localName, localSpell } from '../../data/names'
import { endsOnAttack } from '../../data/items'
import type { Lang } from '../../i18n/useT'
import type { Translate } from '../sheet/labels'
import { buildMenu, turnNotice, type After, type MenuCtx, type MenuItem } from './menus'
import { eventFx, fire, registerLayer, unlockAudio } from './fx/effects'
import { Hud } from './Hud'
import { DetailPanel } from './DetailPanel'
import { CursorList } from './CursorList'
import { ActionBar } from './ActionBar'
import { SpellCard } from './SpellCard'
import { DetailCard } from './DetailCard'
import { TurnCard } from './TurnCard'
import './play.css'

// Menú jugable (#/play): HUD → detalle → lista con cursor → barra del pulgar. Lee la ficha + la sesión.
export function PlayScreen() {
  const { t } = useT()
  const state = useCharacter()
  // JSON roto: los errores se ven en la ficha
  if (!state.ok) {
    return (
      <div className="play-error">
        <p data-testid="sheet-parse-errors">{t('sheet.parseError')}</p>
        <a className="play-error-link" href={href('sheet')} data-testid="play-error-sheet">
          📄 {t('sheet.toSheet')}
        </a>
      </div>
    )
  }
  return (
    <SessionProvider character={state.character}>
      <PlayApp />
    </SessionProvider>
  )
}

// Una línea del aviso de "Tocá para empezar" cuando la sesión guardada se ajustó al personaje
function fixText(t: Translate, lang: Lang, fix: SessionFix): string {
  const fill = (key: Parameters<Translate>[0], vars: Record<string, string | number>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t(key))
  switch (fix.kind) {
    case 'spell-removed':
      return fill('play.fix.spell', { name: localSpell(lang, fix.name) })
    case 'prepared-trimmed':
      return fill('play.fix.trimmed', { level: fix.level, max: fix.max })
    case 'resource-capped':
      return fill('play.fix.resource', { name: localName(lang, fix.id, fix.name), from: fix.from, to: fix.to })
    case 'resource-removed':
    case 'item-removed':
      return fill('play.fix.gone', { name: localName(lang, fix.id, fix.id) })
    case 'item-capped':
      return fill('play.fix.itemCapped', { name: localName(lang, fix.id, fix.name), to: fix.to })
    case 'enhancement-off':
      return t('play.fix.enhancement')
    case 'field-dropped':
      return fill('play.fix.field', { field: fix.field })
  }
}

type Frame = { menu: string; sel: number; label: string }
const SWIPE_PX = 60

// Lo que sobrevive al ir a la ficha (📄) y volver (▶ JUGAR): sin "Tocá para empezar" y en el mismo menú y cursor.
// Vive en memoria, así que al recargar se vuelve a empezar (el navegador pide un toque para el audio).
const resume: { started: boolean; stack: Frame[]; draft: SpellCounts; showAllSkills: boolean } = {
  started: false,
  stack: [{ menu: 'root', sel: 0, label: '' }],
  draft: {},
  showAllSkills: false,
}

function PlayApp() {
  const { t, lang } = useT()
  const { character, session, sheet, update, fixes } = useSession()
  const [started, setStarted] = useState(resume.started)
  const [stack, setStack] = useState<Frame[]>(resume.stack)
  const [draft, setDraft] = useState<SpellCounts>(resume.draft)
  const [showAllSkills, setShowAllSkills] = useState(resume.showAllSkills)
  useEffect(() => {
    Object.assign(resume, { started, stack, draft, showAllSkills })
  }, [started, stack, draft, showAllSkills])
  // Tarjeta abierta sobre el menú: la del conjuro o la del detalle completo (cuando el panel no alcanza)
  const [card, setCard] = useState<{ spell: { level: string; name: string } } | { detail: MenuItem['detail'] } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)

  // Borrador del modificador Libre (Personaje › Efectos activos › Agregar › Libre…)
  const [free, setFree] = useState<FreeDraft>(emptyFreeDraft)
  // Pantalla de turno (MI TURNO): tapa todo hasta que la tocás
  const [turnCard, setTurnCard] = useState<{ round: number; notice: MenuItem['detail'] } | null>(null)
  // Cada poción de curar suma 1: el HUD abre el editor de PG para sumar la cura
  const [healRequest, setHealRequest] = useState(0)
  const ctx: MenuCtx = { t, lang, sheet, session, character, draft, showAllSkills, free }
  const frame = stack[stack.length - 1] ?? { menu: 'root', sel: 0, label: '' }
  // Si te morís, te morís: la pantalla de muerte reemplaza al menú hasta Me equivoqué o Revivir (también al recargar).
  const dead = hpState(sheet, session) === 'dead'
  const items = buildMenu(dead ? 'death' : frame.menu, ctx)
  const sel = Math.min(frame.sel, items.length - 1)
  const item = items[sel] ?? items[0]!
  const preparing = !dead && frame.menu === 'prepare'
  // El editor del modificador Libre usa la misma barra que Preparar: [✕] [−] [+] [LISTO]
  const editingFree = !dead && frame.menu === 'effect-free'
  // Y el de Ataque por Conc (Combate con conjuros a la defensiva): cambia la sesión en vivo; ✕ vuelve al valor de antes
  const editingTrade = !dead && frame.menu.startsWith('trade:')
  const tradeBefore = useRef(0)
  const editing = preparing || editingFree || editingTrade

  const rowEl = (i: number) => listRef.current?.querySelectorAll<HTMLElement>('.row')[i]
  const setSel = (i: number) => setStack((s) => [...s.slice(0, -1), { ...frame, sel: i }])
  const push = (menu: string, label: string) => setStack((s) => [...s, { menu, sel: 0, label }])

  const select = (i: number) => {
    if (i === sel || i < 0 || i >= items.length) return
    setSel(i)
    const row = rowEl(i)
    row?.scrollIntoView({ block: 'nearest' })
    fire('cursor', { target: row })
  }

  const back = () => {
    // La tarjeta se cierra siempre, también en la pantalla de muerte (si no, no habría forma de salir)
    if (card) {
      setCard(null)
      fire('back', { noAnim: true })
      return
    }
    if (dead) return
    if (stack.length === 1) return
    if (editingTrade) update((s) => setSpellCombatTrade(sheet, s, tradeBefore.current))
    setStack((s) => s.slice(0, -1))
    fire('back', { target: listRef.current })
  }

  const adjust = (d: number) => {
    if (editingFree) {
      const f = item.field as keyof FreeDraft | undefined
      if (!f) return
      // Valores entre −20 y +20; rondas entre 0 (= hasta terminar el combate) y 99
      setFree((p) => ({ ...p, [f]: f === 'rounds' ? Math.max(0, Math.min(99, p[f] + d)) : Math.max(-20, Math.min(20, p[f] + d)) }))
      fire('cursor', { noAnim: true })
      return
    }
    if (editingTrade) {
      update((s) => setSpellCombatTrade(sheet, s, s.spellCombatTrade + d))
      fire('cursor', { noAnim: true })
      return
    }
    if (!item.spell) return
    const { level, name } = item.spell
    setDraft((dr) => adjustPrepared(sheet, dr, level, name, d, timesCast(session, level, name)))
    fire('cursor', { noAnim: true })
  }

  // Al completar una acción se vuelve al menú principal (o a ¿Pegó?) cuando termina su animación.
  // La vuelta no suena ni vibra: el único sonido es el de la confirmación (Regla A).
  const finishTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(finishTimer.current), [])
  // Al morir: se corta cualquier vuelta pendiente, se cierra la tarjeta y la pila queda en la raíz
  // (así, al deshacer o revivir, se vuelve al menú principal).
  useEffect(() => {
    if (!dead) return
    window.clearTimeout(finishTimer.current)
    setCard(null)
    setStack([{ menu: 'root', sel: 0, label: '' }])
  }, [dead])
  // deferred: cambio que se aplica al navegar (en ¿Pegó?, para que la lista no quede vacía durante el Tajo)
  const finish = (after: After, ms: number, deferred?: (s: Session) => Session) => {
    if (after === 'stay') return
    window.clearTimeout(finishTimer.current)
    finishTimer.current = window.setTimeout(() => {
      if (deferred) update(deferred)
      setCard(null)
      setStack((s) => {
        const home = s[0] ?? { menu: 'root', sel: 0, label: '' }
        return after === 'root' ? [home] : [home, { menu: after.menu, sel: 0, label: after.label }]
      })
      fire(after === 'root' ? 'back' : 'submenuEnter', { target: listRef.current, silent: true, noVibrate: true })
    }, ms)
  }

  // Al soltar el hold de Descansar, el navegador manda un click sobre lo que quedó bajo el dedo
  // (CONFIRMAR ya es LISTO, o una fila de Preparar). Ese click se ignora; un toque nuevo lo resetea.
  const ghostClick = useRef(false)
  const swallowGhost = () => {
    const ghost = ghostClick.current
    ghostClick.current = false
    return ghost
  }

  const openCard = (it: MenuItem) => {
    setCard(it.spell ? { spell: it.spell } : { detail: it.detail })
    fire('submenuEnter', { noAnim: true })
  }

  // Deshacer por flujo: un flujo va desde que salís del menú principal hasta que volvés (lanzar → ¿Le pegaste? → Le
  // pegué; Descansar → Preparar → LISTO). flowUndo es lo que guardó para deshacer el primer paso que gastó recursos:
  // los pasos siguientes lo conservan, así deshacer vuelve atrás el flujo entero. Si en el medio cambió (p. ej. un
  // cambio de PG en el HUD), el flujo ya no sigue.
  const flowUndo = useRef<Session['undo']>(null)
  const track = (fn: (s: Session) => Session, label: string) => (s: Session) => {
    const inFlow = sameUndo(flowUndo.current, s.undo)
    const next = trackUndo(s, fn(s), label, inFlow)
    flowUndo.current = next.undo
    return next
  }

  // Regla A: un solo sonido por confirmación, el más específico.
  const confirm = (it: MenuItem = item, index = sel) => {
    const a = it.action
    // Todo lo que se confirma manteniendo apretado cambia la pantalla: el click al soltar no tiene que confirmar lo nuevo.
    if (it.hold) ghostClick.current = true
    // Desde el menú principal arranca un flujo nuevo
    if (stack.length === 1) flowUndo.current = null
    switch (a.type) {
      case 'open':
        if (a.menu === 'prepare') setDraft(session.prepared)
        if (a.menu === 'effect-free') setFree(emptyFreeDraft())
        if (a.menu.startsWith('trade:')) tradeBefore.current = session.spellCombatTrade
        push(a.menu, it.label)
        fire('submenuEnter', { target: listRef.current })
        break
      case 'execute': // conjuros con ◆: pop + resourceSpend + el Tajo sin sonido; ⚡ y objetos: solo pop + resourceSpend; ataques y trucos: actionExecute
        {
          // Deshacer: si gasta recursos se guarda (o sigue el flujo); si no (Atacar, Maniobrar…), borra lo que había.
          // En ¿Le pegaste? sin un lanzamiento antes (Descargar toque), el nombre es el de la pantalla.
          const onTouch = frame.menu.startsWith('touch:')
          const label = onTouch ? frame.label : it.label.replace(/^↻ /, '')
          const step = track(a.update ?? ((s: Session) => s), label)
          const deferred = onTouch ? step : undefined
          if (!deferred) update(step)
          // Acción del turno en combate: queda como la última, para ↻ Repetir (las respuestas de ¿Le pegaste? no cuentan)
          if (session.combat && it.act && it.act !== 'downtime' && !deferred) {
            const origin = it.origin ?? { menu: frame.menu, item: it.id }
            update((s) => recordAction(s, origin.menu, origin.item))
          }
          // Cualquier acción del turno usa la acción preparada (salvo prepararla, también desde ↻ Repetir), y atacar
          // o lanzar sobre alguien corta lo que termina al atacar (la invisibilidad)
          if (it.act && it.act !== 'downtime' && (it.origin?.item ?? it.id) !== 'ready') {
            update((s) => afterAction(s, Boolean(it.offensive), endsOnAttack))
          }
          // Poción de curar: al volver al menú principal se abre el editor de PG para sumar la cura
          if (it.heals) setHealRequest((n) => n + 1)
          const target = a.fx === 'resourceSpend' ? rowEl(index)?.querySelector<HTMLElement>('.badge') : a.fx === 'start' ? rootRef.current : undefined
          fire(a.fx, { target, noAnim: a.noAnim })
          if (a.slash) fire('actionExecute', { silent: true, noVibrate: true })
          const ms = a.noAnim ? 0 : Math.max(eventFx(a.fx).animation.durationMs, a.slash ? eventFx('actionExecute').animation.durationMs : 0)
          finish(a.after, ms, deferred)
        }
        break
      case 'toggle': // posturas, condiciones, efectos: sin animación de pantalla y sin navegar (no se deshacen: se vuelven a tocar)
        update(track(a.update, it.label))
        fire(a.on ? 'actionExecute' : 'back', { noAnim: true })
        // Los efectos comunes de Agregar (3 niveles adentro) vuelven al menú principal, como Libre › LISTO
        if (a.after === 'root') finish('root', 0)
        break
      case 'rest': // llega acá solo manteniendo apretado: descansa y abre Preparar con lo de ayer (se puede deshacer)
        ghostClick.current = true
        update(track((s) => rest(sheet, s), t('play.rest')))
        setDraft(session.prepared)
        push('prepare', t('play.prepare'))
        fire('rest')
        break
      case 'commit': // pantalla de muerte: sin efecto por ahora; la pila ya está en la raíz. No se deshace.
        flowUndo.current = null
        update((s) => clearUndo(a.update(s)))
        setSel(0)
        break
      case 'prepare':
        adjust(1)
        break
      case 'skills-toggle':
        setShowAllSkills((v) => !v)
        fire('submenuEnter', { target: listRef.current })
        break
      case 'none': // fila de solo lectura: el 2do toque abre la tarjeta con todo (las bloqueadas no hacen nada)
        if (it.nav === 'info') openCard(it)
        break
    }
  }

  // Preparar después de Descansar es parte del mismo flujo: deshacer vuelve atrás los dos. Preparar suelto no gasta
  // recursos: no se deshace (borra lo que había).
  const done = () => {
    if (swallowGhost()) return
    if (editingFree) {
      // LISTO del Libre: lo agrega (si todo es 0, no agrega nada). Como los ON/OFF, no se deshace: se apaga en Efectos activos.
      update(track((s) => addFreeEffect(s, free), t('play.freeEffect')))
      fire('submenuEnter', { noAnim: true })
      finish('root', 0)
      return
    }
    if (editingTrade) {
      // LISTO de Ataque por Conc: el valor ya quedó en la sesión; vuelve a la lista de conjuros (no es una acción).
      // Como los ON/OFF, no se deshace.
      update(track((s) => s, t('play.trade')))
      fire('submenuEnter', { noAnim: true })
      setStack((s) => s.slice(0, -1))
      return
    }
    update(track((s) => prepare(sheet, s, draft), t('play.prepare')))
    fire('submenuEnter', { noAnim: true })
    finish('root', 0)
  }

  // MI TURNO (desde cualquier pantalla): avanza la ronda, deja el menú principal con el cursor en la fila de arriba
  // (↻ Repetir) y tapa todo con la pantalla de turno (qué se apagó, qué sigue, lo urgente) hasta que la tocás.
  // Transición 8-bit de la ficha (sin sonido) + el sonido de submenuEnter: un solo sonido (Regla A). Cerrarla no suena.
  const onTurn = () => {
    window.clearTimeout(finishTimer.current)
    setCard(null)
    flowUndo.current = null
    const summary = turnSummary(sheet, session, nextTurn(session))
    setTurnCard({ round: summary.round, notice: turnNotice(ctx, summary) })
    update(nextTurn)
    setStack([{ menu: 'root', sel: 0, label: '' }])
    fire('sheetPageChange', { target: rootRef.current })
    fire('submenuEnter', { noAnim: true })
  }

  // Un ítem `hold` no se confirma con un toque: solo con la fila o CONFIRMAR apretados.
  const onTap = (i: number) => {
    if (swallowGhost()) return
    if (i !== sel) select(i)
    else if (!items[i]?.hold) confirm()
  }
  const onHold = (i: number) => {
    const it = items[i]
    if (!it) return
    if (i !== sel) setSel(i)
    confirm(it, i)
  }

  const start = () => {
    unlockAudio()
    setStarted(true)
    fire('start', { target: rootRef.current })
  }

  // Swipe → vuelve (si el gesto es más vertical que horizontal, es scroll)
  const onTouchEnd = (e: TouchEvent) => {
    const end = e.changedTouches[0]
    const begin = touch.current
    touch.current = null
    if (!begin || !end) return
    const dx = end.clientX - begin.x
    if (dx > SWIPE_PX && Math.abs(dx) > Math.abs(end.clientY - begin.y)) back()
  }

  const crumb = stack.slice(1).map((f) => f.label).join(' › ')

  // Deshacer: en el menú principal, mantener ✕ 1 s vuelve la sesión a como estaba antes de lo último.
  const canUndo = !dead && stack.length === 1 && !card && Boolean(session.undo)
  const undoNow = () => {
    if (!canUndo) return
    ghostClick.current = true
    update(undoLast)
    fire('back', { noAnim: true })
  }

  return (
    <div className="play" ref={rootRef} onPointerDownCapture={() => (ghostClick.current = false)}>
      <Hud onTurn={onTurn} healRequest={healRequest} />
      <DetailPanel item={item} onOpenCard={() => openCard(item)} />
      <div
        className="listwrap"
        onTouchStart={(e) => {
          const p = e.touches[0]
          touch.current = p ? { x: p.clientX, y: p.clientY } : null
        }}
        onTouchEnd={onTouchEnd}
      >
        <div className="crumb">
          {dead ? t('hpState.dead') : crumb ? `${crumb} ›` : t('play.menu')}
          {canUndo && session.undo && (
            <span className="undo-hint" data-testid="play-undo">
              {' · ↶ '}
              {session.undo.label}
            </span>
          )}
        </div>
        <CursorList items={items} sel={sel} onTap={onTap} onHold={onHold} listRef={listRef} />
      </div>
      <ActionBar
        mode={editing ? 'prepare' : 'menu'}
        hold={!editing && Boolean(item.hold)}
        onCancel={back}
        cancelHold={canUndo}
        onCancelHold={undoNow}
        onConfirm={editing ? done : () => confirm()}
        onUp={() => (editing ? adjust(-1) : select(sel - 1))}
        onDown={() => (editing ? adjust(1) : select(sel + 1))}
      />
      {card && 'spell' in card && <SpellCard spell={card.spell} ctx={ctx} onClose={back} />}
      {card && 'detail' in card && <DetailCard detail={card.detail} onClose={back} />}
      {turnCard && !dead && <TurnCard round={turnCard.round} notice={turnCard.notice} onClose={() => setTurnCard(null)} />}
      <div className="fx-overlay" ref={(el) => registerLayer('overlay', el)} />
      <div className="fx-slash" ref={(el) => registerLayer('slash', el)} />
      {!started && (
        <button type="button" className="start-screen" onClick={start} data-testid="play-start">
          <small>Sword &amp; Thunder</small>
          <b>{sheet.name}</b>
          <span>▸ {t('play.start')}</span>
          <small>{t('play.startHint')}</small>
          {fixes.length > 0 && (
            <small className="start-notice" data-testid="play-start-notice">
              {t('play.fix.title')} {fixes.map((f) => fixText(t, lang, f)).join(' · ')}
            </small>
          )}
        </button>
      )}
    </div>
  )
}
