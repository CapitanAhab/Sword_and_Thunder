import type { ComponentType } from 'react'
import { useRoute, type Route } from './router'
import { SheetScreen } from './apps/sheet/SheetScreen'
import { PlayScreen } from './apps/play/PlayScreen'

const SCREENS: Record<Route, ComponentType> = {
  sheet: SheetScreen,
  play: PlayScreen,
}

// Sin barra de navegación: cada pantalla trae su botón (HUD › 📄 en #/play, ▶ JUGAR en #/sheet).
export function App() {
  const route = useRoute()
  const Screen = SCREENS[route]

  return (
    <main>
      <Screen />
    </main>
  )
}
