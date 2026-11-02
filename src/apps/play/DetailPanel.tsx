import { useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/useT'
import type { MenuItem } from './menus'

// Panel del medio, en 3 franjas fijas (así cada dato cae siempre a la misma altura):
//   1 título + tag · 2 datos (columnas, o `line` en grande) · 3 descripción gris (2 renglones).
// Con columnas, `line` y `note` bajan a la descripción. Si algo no entra, termina en "…" y aparece ⓘ:
// tocar el panel abre la tarjeta (la del conjuro, o DetailCard con el texto completo).
export function DetailPanel({ item, onOpenCard }: { item: MenuItem; onOpenCard: () => void }) {
  const testId = 'play-detail'
  const { t, lang } = useT()
  const ref = useRef<HTMLElement | null>(null)
  const [overflow, setOverflow] = useState(false)
  const { title, tag, stats, line, note, extra, warn } = item.detail
  const desc = (stats ? [line, note] : [note, extra]).filter((s): s is string => Boolean(s))
  const tappable = Boolean(item.spell) || overflow
  const key = `${lang}|${JSON.stringify(item.detail)}`

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cut = [...el.querySelectorAll<HTMLElement>('.fit')].some((e) => e.scrollWidth > e.clientWidth + 1)
      const d = el.querySelector<HTMLElement>('.d-desc')
      setOverflow(cut || (d !== null && d.scrollHeight > d.clientHeight + 1))
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
      <div className="d-data">
        {stats ? (
          <div className="d-stats">
            {stats.map((s) => (
              <div key={s.id}>
                <span className="d-label fit">{s.label}</span>
                <span className="d-value fit" data-testid={`play-detail-stat-${s.id}`}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          line && <div className="d-line fit">{line}</div>
        )}
      </div>
      <div className="d-desc">
        {warn && (
          <span className="d-warn" data-testid="play-detail-warn">
            {warn}
          </span>
        )}
        {desc.map((s, i) => (
          <span key={i}>
            {(i > 0 || warn) && <br />}
            {s}
          </span>
        ))}
      </div>
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
