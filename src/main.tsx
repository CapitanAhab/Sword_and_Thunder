import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CharacterProvider } from './state/CharacterContext'
import { App } from './App'
import '@fontsource/marcellus/latin-400.css'
import '@fontsource/barlow-semi-condensed/latin-400.css'
import '@fontsource/barlow-semi-condensed/latin-500.css'
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CharacterProvider>
      <App />
    </CharacterProvider>
  </StrictMode>,
)
