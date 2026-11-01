import type { ComponentType } from 'react'
import { useRoute, type Route } from './router'
import { SheetScreen } from './apps/sheet/SheetScreen'
import { PlayScreen } from './apps/play/PlayScreen'
import { LevelUpScreen } from './apps/levelup/LevelUpScreen'

const SCREENS: Record<Route, ComponentType> = {
  sheet: SheetScreen,
  play: PlayScreen,
  'level-up': LevelUpScreen,
}

// Sin barra de navegación: cada pantalla trae su botón (HUD › 📄 en #/play, ▶ JUGAR en #/sheet).
// #/level-up todavía es un placeholder: solo se abre por URL.
export function App() {
  const route = useRoute()
  const Screen = SCREENS[route]

  return (
    <main>
      <Screen />
    </main>
  )
}
