import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/useT'
import { href } from '../../router'
import { useSession } from '../../state/SessionContext'
import { changeHp, clampHp, currentHp, hpState, nextTurn, resourceLeft } from '../../core/session'
import { STANCES, type StanceId } from '../../core/rules/pf1e/actions'
import { formatValue, minus } from '../sheet/labels'
import { localName, localSpell } from '../../data/names'
import { fire, hpBarMs, isMuted, setMuted, type HpSide } from './fx/effects'

// HUD de arriba: solo mirar. Interacciones: la barra de HP (tocar → [−] 7/11 (−4) [+], se aplica sola a los 1,5 s)
// y, en combate, MI TURNO ▸ (avanza la ronda: core/session.ts → nextTurn).
const APPLY_MS = 1500
const HOLD_MS = 400

export function Hud() {
  const { t, lang, toggleLang } = useT()
  const { sheet, session, update } = useSession()
  const [muted, setMutedState] = useState(isMuted)
  const [pending, setPending] = useState<number | null>(null) // null = no se está editando
  const [side, setSide] = useState<HpSide>('damage')
  const pendingRef = useRef(0)
  const idle = useRef<number | undefined>(undefined)
  const hold = useRef<number | undefined>(undefined)
  const hudRef = useRef<HTMLElement>(null)

  useEffect(() => () => {
    window.clearTimeout(idle.current)
    window.clearTimeout(hold.current)
  }, [])

  const hp = currentHp(sheet, session)
  const dead = hpState(sheet, session) === 'dead' // muerto: el PG no se edita (pantalla de muerte)
  const shown = pending === null ? hp : hp + pending
  const pct = Math.max(0, Math.min(100, (shown / sheet.hp.total) * 100))

  const commit = () => {
    window.clearTimeout(hold.current)
    const delta = pendingRef.current
    pendingRef.current = 0
    setPending(null)
    if (!delta) return
    const s: HpSide = delta < 0 ? 'damage' : 'heal'
    setSide(s)
    update((x) => changeHp(sheet, x, delta))
    fire('hpChange', { side: s, target: hudRef.current })
  }
  const schedule = () => {
    window.clearTimeout(idle.current)
    idle.current = window.setTimeout(commit, APPLY_MS)
  }
  const step = (d: number) => {
    const next = clampHp(sheet, hp + pendingRef.current + d) - hp
    pendingRef.current = next
    setPending(next)
    schedule()
  }
  // Mantener apretado: repite y acelera
  const press = (d: number) => {
    step(d)
    let n = 0
    const tick = () => {
      step(d)
      n++
      hold.current = window.setTimeout(tick, n > 8 ? 50 : 120)
    }
    hold.current = window.setTimeout(tick, HOLD_MS)
  }
  const release = () => window.clearTimeout(hold.current)
  const openEditor = () => {
    pendingRef.current = 0
    setPending(0)
    schedule()
  }

  const pool = sheet.resources[0]
  const perception = sheet.skills.find((s) => s.id === 'perception')
  const rounds = (n: number | undefined) => (n ? ` ${n}r` : '')
  const chips = [
    ...(session.stance && session.stance in STANCES ? [{ id: session.stance, text: t(`stanceChip.${session.stance as StanceId}`) }] : []),
    ...(session.charging ? [{ id: 'charged', text: t('play.chip.charged') }] : []),
    ...(session.enhancement ? [{ id: 'enhancement', text: `${t('play.chip.weapon')} +${session.enhancement.bonus}${rounds(session.enhancement.rounds)}` }] : []),
    ...session.conditions.map((c) => ({ id: c, text: localName(lang, c, c.charAt(0).toUpperCase() + c.slice(1)) })),
    ...session.buffs.map((b) => ({ id: `buff-${b}`, text: `${localSpell(lang, b)}${rounds(session.buffRounds[b])}` })),
    ...(session.held ? [{ id: 'held', text: `${t('play.chip.held')}: ${localSpell(lang, session.held.name)}${session.held.charges > 1 ? ` ×${session.held.charges}` : ''}` }] : []),
    ...(session.castDefensively ? [{ id: 'defensive', text: t('play.chip.defensive') }] : []),
  ]
  const combat = session.combat
  const myTurn = () => {
    update(nextTurn)
    fire('submenuEnter', { noAnim: true })
  }
  const saves = [
    { id: 'fort', label: t('sheet.fort'), value: sheet.saves.fort.total },
    { id: 'ref', label: t('sheet.ref'), value: sheet.saves.ref.total },
    { id: 'will', label: t('sheet.will'), value: sheet.saves.will.total },
  ]
  const toggleMute = () => {
    setMuted(!muted)
    setMutedState(!muted)
  }

  return (
    <header className="hud" ref={hudRef}>
      <div className="hud-top">
        {combat ? (
          <>
            <span className="hud-name hud-round" data-testid="hud-round">
              ⚔ {combat.round ? `${t('play.round')} ${combat.round}` : t('play.combat')}
            </span>
            <button type="button" className="hud-turn" onClick={myTurn} data-testid="btn-turn">
              {t('play.myTurn')}
            </button>
          </>
        ) : (
          <span className="hud-name">
            {sheet.name} · {sheet.classes.map((c) => `${localName(lang, c.id, c.name)} ${c.level}`).join(' / ')}
          </span>
        )}
        {/* Si había un cambio de PG sin aplicar (antes de 1,5 s), se aplica antes de salir para no perderlo */}
        <a className="hud-icon" href={href('sheet')} onClick={() => pending !== null && commit()} aria-label={t('nav.sheet')} data-testid="hud-sheet">
          📄
        </a>
        <button type="button" className="hud-icon" onClick={toggleLang} data-testid="hud-lang">
          {t('lang.toggle')}
        </button>
        <button type="button" className="hud-icon" onClick={toggleMute} aria-pressed={muted} aria-label={t('play.mute')} data-testid="hud-mute">
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {pending === null ? (
        <button type="button" className="hud-hp" onClick={dead ? undefined : openEditor} aria-label={dead ? t('hpState.dead') : t('play.hpEdit')} aria-disabled={dead || undefined}>
          <span className="hud-hp-ico">{dead ? '☠' : '♥'}</span>
          <span data-testid="hud-hp">
            {minus(String(hp))}/{sheet.hp.total}
          </span>
          <span className="hud-bar">
            <i style={{ width: `${pct}%`, transition: `width ${hpBarMs(side)}ms ease-out` }} />
          </span>
        </button>
      ) : (
        <div className="hud-hp editing">
          <button type="button" className="hud-step" onPointerDown={() => press(-1)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} onContextMenu={(e) => e.preventDefault()} aria-label={t('play.minus')} data-testid="hud-hp-minus">
            −
          </button>
          <span className="hud-hp-edit" data-testid="hud-hp">
            {minus(String(shown))}/{sheet.hp.total}
            {pending !== 0 && <small className={pending < 0 ? 'neg' : 'pos'}> ({formatValue(pending, true)})</small>}
          </span>
          <button type="button" className="hud-step" onPointerDown={() => press(1)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} onContextMenu={(e) => e.preventDefault()} aria-label={t('play.plus')} data-testid="hud-hp-plus">
            +
          </button>
        </div>
      )}

      <div className="hud-stats">
        <span data-testid="hud-ac">⛨ {sheet.ac.normal.total}</span>
        {perception && <span data-testid="hud-perception">👁 {formatValue(perception.stat.total, true)}</span>}
        {pool && (
          <span className="gold" data-testid="hud-pool">
            ⚡ <span className="fx-target">{resourceLeft(sheet, session, pool.id)}</span>/{pool.max.total}
          </span>
        )}
      </div>

      <div className="hud-stats hud-rolls">
        {saves.map((s) => (
          <span key={s.id}>
            <small>{s.label}</small> <b data-testid={`hud-save-${s.id}`}>{formatValue(s.value, true)}</b>
          </span>
        ))}
        <span>
          <small>{t('sheet.init')}</small> <b data-testid="hud-init">{formatValue(sheet.initiative.total, true)}</b>
        </span>
      </div>

      {chips.length > 0 && (
        <div className="hud-chips">
          {chips.map((c) => (
            <span key={c.id} className="hud-chip" data-testid={`hud-chip-${c.id}`}>
              {c.text}
            </span>
          ))}
        </div>
      )}
    </header>
  )
}
