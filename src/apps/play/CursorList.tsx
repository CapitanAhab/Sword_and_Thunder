import { Fragment, useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import type { MenuItem } from './menus'
import { cursorTransition } from './fx/effects'
import { HOLD_MS, useHold } from './useHold'

type Props = {
  items: MenuItem[]
  sel: number
  onTap: (i: number) => void // 1er toque = seleccionar, 2do toque sobre el mismo = confirmar
  onHold: (i: number) => void // ítems `hold`: se confirman manteniendo apretada la fila
  listRef: RefObject<HTMLDivElement | null>
}

// Lista con cursor ›.
export function CursorList({ items, sel, onTap, onHold, listRef }: Props) {
  const cursor = useRef<HTMLSpanElement>(null)

  // El cursor sigue a la fila seleccionada (las filas con encabezado de sección no están a altura fija)
  useLayoutEffect(() => {
    const row = listRef.current?.querySelectorAll<HTMLElement>('.row')[sel]
    if (!row || !cursor.current) return
    cursor.current.style.transition = cursorTransition()
    cursor.current.style.transform = `translateY(${row.offsetTop}px)`
  }, [sel, items, listRef])

  return (
    <div className="list" ref={listRef}>
      <span className="cursor" ref={cursor} aria-hidden="true">
        ›
      </span>
      {items.map((it, i) => (
        <Fragment key={it.id}>
          {it.section && <div className="section">{it.section}</div>}
          <Row item={it} selected={i === sel} onTap={() => onTap(i)} onHold={() => onHold(i)} />
        </Fragment>
      ))}
    </div>
  )
}

function Row({ item, selected, onTap, onHold }: { item: MenuItem; selected: boolean; onTap: () => void; onHold: () => void }) {
  const { holding, handlers } = useHold(onHold)
  return (
    <button
      type="button"
      className={`row${selected ? ' sel' : ''}${item.hold ? ' hold' : ''}${holding ? ' holding' : ''}${item.blocked ? ' blocked' : ''}`}
      style={{ '--hold-ms': `${HOLD_MS}ms` } as CSSProperties}
      onClick={onTap}
      {...(item.hold ? handlers : {})}
      aria-current={selected ? 'true' : undefined}
      aria-disabled={item.blocked || undefined}
      data-testid={`menu-item-${item.id}`}
    >
      <span className="row-label">{item.label}</span>
      {item.badge && <span className={`badge fx-target${item.badge.tone ? ` ${item.badge.tone}` : ''}`}>{item.badge.text}</span>}
    </button>
  )
}
