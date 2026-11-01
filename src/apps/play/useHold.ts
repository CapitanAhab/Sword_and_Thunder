import { useEffect, useRef, useState, type MouseEvent } from 'react'

// Regla "mantener apretado": acciones que no se pueden disparar por un toque al pasar (Descansar y las dos opciones de la pantalla de muerte).
// Se confirma tras HOLD_MS sin soltar; si se suelta antes, no pasa nada. `holding` maneja el llenado (CSS).
export const HOLD_MS = 1000

export function useHold(onDone: () => void, ms = HOLD_MS) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const cancel = () => {
    window.clearTimeout(timer.current)
    setHolding(false)
  }
  const start = () => {
    window.clearTimeout(timer.current)
    setHolding(true)
    timer.current = window.setTimeout(() => {
      setHolding(false)
      onDone()
    }, ms)
  }

  return {
    holding,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: MouseEvent) => e.preventDefault(),
    },
  }
}
