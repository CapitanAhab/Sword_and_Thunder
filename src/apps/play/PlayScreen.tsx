import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { useT } from '../../i18n/useT'
import { useCharacter } from '../../state/CharacterContext'
import { SessionProvider, useSession } from '../../state/SessionContext'
import { adjustPrepared, hpState, prepare, rest, timesCast, type Session, type SpellCounts } from '../../core/session'
import { buildMenu, type After, type MenuCtx, type MenuItem } from './menus'
import { eventFx, fire, registerLayer, unlockAudio } from './fx/effects'
import { Hud } from './Hud'
import { DetailPanel } from './DetailPanel'
import { CursorList } from './CursorList'
import { ActionBar } from './ActionBar'
import { SpellCard } from './SpellCard'
import { DetailCard } from './DetailCard'
import './play.css'

// Menú jugable (#/play): HUD → detalle → lista con cursor → barra del pulgar. Lee la ficha + la sesión.
export function PlayScreen() {
  const { t } = useT()
  const state = useCharacter()
  if (!state.ok) return <p data-testid="sheet-parse-errors">{t('sheet.parseError')}</p>
  return (
    <SessionProvider character={state.character}>
      <PlayApp />
    </SessionProvider>
  )
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
  const { character, session, sheet, update } = useSession()
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

  const ctx: MenuCtx = { t, lang, sheet, session, character, draft, showAllSkills }
  const frame = stack[stack.length - 1] ?? { menu: 'root', sel: 0, label: '' }
  // Si te morís, te morís: la pantalla de muerte reemplaza al menú hasta Me equivoqué o Revivir (también al recargar).
  const dead = hpState(sheet, session) === 'dead'
  const items = buildMenu(dead ? 'death' : frame.menu, ctx)
  const sel = Math.min(frame.sel, items.length - 1)
  const item = items[sel] ?? items[0]!
  const preparing = !dead && frame.menu === 'prepare'

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
    setStack((s) => s.slice(0, -1))
    fire('back', { target: listRef.current })
  }

  const adjust = (d: number) => {
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

  // Regla A: un solo sonido por confirmación, el más específico.
  const confirm = (it: MenuItem = item, index = sel) => {
    const a = it.action
    // Todo lo que se confirma manteniendo apretado cambia la pantalla: el click al soltar no tiene que confirmar lo nuevo.
    if (it.hold) ghostClick.current = true
    switch (a.type) {
      case 'open':
        if (a.menu === 'prepare') setDraft(session.prepared)
        push(a.menu, it.label)
        fire('submenuEnter', { target: listRef.current })
        break
      case 'execute': // conjuros con ◆: pop + resourceSpend + el Tajo sin sonido; ⚡ y objetos: solo pop + resourceSpend; ataques y trucos: actionExecute
        {
          const deferred = frame.menu.startsWith('touch:') ? a.update : undefined
          if (a.update && !deferred) update(a.update)
          const target = a.fx === 'resourceSpend' ? rowEl(index)?.querySelector<HTMLElement>('.badge') : a.fx === 'start' ? rootRef.current : undefined
          fire(a.fx, { target, noAnim: a.noAnim })
          if (a.slash) fire('actionExecute', { silent: true, noVibrate: true })
          const ms = a.noAnim ? 0 : Math.max(eventFx(a.fx).animation.durationMs, a.slash ? eventFx('actionExecute').animation.durationMs : 0)
          finish(a.after, ms, deferred)
        }
        break
      case 'toggle': // posturas, condiciones, efectos: sin animación de pantalla y sin navegar
        update(a.update)
        fire(a.on ? 'actionExecute' : 'back', { noAnim: true })
        break
      case 'rest': // llega acá solo manteniendo apretado: descansa y abre Preparar con lo de ayer
        ghostClick.current = true
        update((s) => rest(sheet, s))
        setDraft(session.prepared)
        push('prepare', t('play.prepare'))
        fire('rest')
        break
      case 'commit': // pantalla de muerte: sin efecto por ahora; la pila ya está en la raíz
        update(a.update)
        setSel(0)
        break
      case 'prepare':
        adjust(1)
        break
      case 'skills-toggle':
        setShowAllSkills((v) => !v)
        fire('submenuEnter', { target: listRef.current })
        break
      case 'none':
        break
    }
  }

  const done = () => {
    if (swallowGhost()) return
    update((s) => prepare(sheet, s, draft))
    fire('submenuEnter', { noAnim: true })
    finish('root', 0)
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

  return (
    <div className="play" ref={rootRef} onPointerDownCapture={() => (ghostClick.current = false)}>
      <Hud />
      <DetailPanel
        item={item}
        onOpenCard={() => {
          setCard(item.spell ? { spell: item.spell } : { detail: item.detail })
          fire('submenuEnter', { noAnim: true })
        }}
      />
      <div
        className="listwrap"
        onTouchStart={(e) => {
          const p = e.touches[0]
          touch.current = p ? { x: p.clientX, y: p.clientY } : null
        }}
        onTouchEnd={onTouchEnd}
      >
        <div className="crumb">{dead ? t('hpState.dead') : crumb ? `${crumb} ›` : t('play.menu')}</div>
        <CursorList items={items} sel={sel} onTap={onTap} onHold={onHold} listRef={listRef} />
      </div>
      <ActionBar
        mode={preparing ? 'prepare' : 'menu'}
        hold={!preparing && Boolean(item.hold)}
        onCancel={back}
        onConfirm={preparing ? done : () => confirm()}
        onUp={() => (preparing ? adjust(-1) : select(sel - 1))}
        onDown={() => (preparing ? adjust(1) : select(sel + 1))}
      />
      {card && 'spell' in card && <SpellCard spell={card.spell} ctx={ctx} onClose={back} />}
      {card && 'detail' in card && <DetailCard detail={card.detail} onClose={back} />}
      <div className="fx-overlay" ref={(el) => registerLayer('overlay', el)} />
      <div className="fx-slash" ref={(el) => registerLayer('slash', el)} />
      {!started && (
        <button type="button" className="start-screen" onClick={start} data-testid="play-start">
          <small>Sword &amp; Thunder</small>
          <b>{sheet.name}</b>
          <span>▸ {t('play.start')}</span>
          <small>{t('play.startHint')}</small>
        </button>
      )}
    </div>
  )
}
