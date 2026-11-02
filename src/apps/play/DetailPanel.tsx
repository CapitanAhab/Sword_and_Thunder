import { useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/useT'
import type { MenuItem } from './menus'

// Franja de detalle, abajo (entre la lista y los botones), de alto fijo para que nada salte:
//   1 título + ⓘ + tag
//   2 y 3 el cuerpo: las columnas en una línea (Atq +3 · Daño 1d8+3 · …) y debajo la descripción gris,
//     o, sin columnas, `line` y la descripción repartidas en los dos renglones.
// Lo urgente (amarillo) suma un renglón abajo solo cuando hay algo. Si algo no entra, termina en "…" y aparece ⓘ:
// tocar la franja abre la tarjeta (la del conjuro, o DetailCard con el texto completo).
export function DetailPanel({ item, onOpenCard }: { item: MenuItem; onOpenCard: () => void }) {
  const testId = 'play-detail'
  const { t, lang } = useT()
  const ref = useRef<HTMLElement | null>(null)
  const [overflow, setOverflow] = useState(false)
  const { title, tag, stats, line, note, extra, warn } = item.detail
  const desc = (stats ? [line, note, extra] : [note, extra]).filter((s): s is string => Boolean(s)).join(' · ')
  // Sin columnas: `line` usa un renglón si hay descripción debajo, si no, los dos (y al revés)
  const first = stats ? null : line
  const tappable = Boolean(item.spell) || overflow
  const key = `${lang}|${JSON.stringify(item.detail)}`

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cut = [...el.querySelectorAll<HTMLElement>('.fit')].some((e) => e.scrollWidth > e.clientWidth + 1)
      const clamped = [...el.querySelectorAll<HTMLElement>('.clamp')].some((e) => e.scrollHeight > e.clientHeight + 1)
      setOverflow(cut || clamped)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [key, tappable])

  const body = (
    <>
      <div className="d1">
        <span className="d-title fit">{title}</span>
        {tappable && (
          <span className="d-info" data-testid="play-detail-info">
            ⓘ
          </span>
        )}
        {tag && (
          <span className="d-tag" data-testid="play-detail-tag">
            {tag}
          </span>
        )}
      </div>
      <div className="d-body">
        {stats && (
          <div className="d-stats">
            {stats.map((s) => (
              <span key={s.id} className="d-stat fit">
                <span className="d-label">{s.label}</span>{' '}
                <span className="d-value" data-testid={`play-detail-stat-${s.id}`}>
                  {s.value}
                </span>
              </span>
            ))}
          </div>
        )}
        {first && <div className={`d-line clamp ${desc ? 'rows-1' : 'rows-2'}`}>{first}</div>}
        {desc && <div className={`d-desc clamp ${stats || first ? 'rows-1' : 'rows-2'}`}>{desc}</div>}
      </div>
      {warn && (
        <div className="d-warn fit" data-testid="play-detail-warn">
          {warn}
        </div>
      )}
    </>
  )
  const setRef = (el: HTMLElement | null) => {
    ref.current = el
  }
  return tappable ? (
    <button
      type="button"
      className="detail tappable"
      ref={setRef}
      onClick={onOpenCard}
      aria-label={t(item.spell ? 'play.cardHint' : 'play.detailHint')}
      data-testid={testId}
    >
      {body}
    </button>
  ) : (
    <div className="detail" ref={setRef} data-testid={testId}>
      {body}
    </div>
  )
}
