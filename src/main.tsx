import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n/useT'
import { CharacterProvider } from './state/CharacterContext'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <CharacterProvider>
        <App />
      </CharacterProvider>
    </I18nProvider>
  </StrictMode>,
)
