import { useLayoutEffect, useRef } from 'react'
import { fire } from './effects'

// Animación de una tarjeta al aparecer. Antes del primer pintado, para que no se vea un cuadro sin animar.
export function useCardFx() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    fire('cardOpen', { target: ref.current })
  }, [])
  return ref
}
