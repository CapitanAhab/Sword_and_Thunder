import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { es, type MessageKey } from './es'
import { en } from './en'

export type Lang = 'es' | 'en'

const dictionaries: Record<Lang, Record<MessageKey, string>> = { es, en }
const STORAGE_KEY = 'sat.lang'

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

type I18nValue = {
  lang: Lang
  t: (key: MessageKey) => string
  toggleLang: () => void
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readStoredLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // sin storage (modo privado, etc.): el idioma solo dura la sesión
    }
  }, [lang])

  const toggleLang = useCallback(() => setLang((l) => (l === 'es' ? 'en' : 'es')), [])

  const value = useMemo<I18nValue>(
    () => ({ lang, t: (key) => dictionaries[lang][key], toggleLang }),
    [lang, toggleLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx
}
