import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { useT } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/es'
import type { ParseError } from '../../core/schema'
import { href } from '../../router'
import { useCharacter } from '../../state/CharacterContext'
import { IssuesBanner } from './IssuesBanner'
import { PageOne } from './PageOne'
import { PageTwo } from './PageTwo'
import { fire } from '../play/fx/effects'
// Tipografías de la ficha, empaquetadas (andan offline): Marcellus para el nombre y los títulos,
// Barlow Semi Condensed para el texto y los números. Solo los pesos que se usan, alfabeto latino.
import '@fontsource/marcellus/latin-400.css'
import '@fontsource/barlow-semi-condensed/latin-400.css'
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import './sheet.css'

// Ficha de solo lectura en 2 páginas, como la oficial. Lo único que se toca es el cambio de página.
const PAGES = [1, 2] as const
type Page = (typeof PAGES)[number]
const PAGE_KEY = 'sat.sheet.page'

// Un error del JSON en el idioma activo: "abilities.str: tiene que ser un número (hay un texto)".
const TYPE_KEYS: Record<string, MessageKey> = {
  number: 'parseError.t.number', string: 'parseError.t.string', boolean: 'parseError.t.boolean',
  array: 'parseError.t.array', object: 'parseError.t.object', null: 'parseError.t.null',
}
function parseErrorText(t: (key: MessageKey) => string, e: ParseError): string {
  const typeName = (type = '') => {
    const key = TYPE_KEYS[type]
    return key ? t(key) : type
  }
  const vars: Record<string, string> = {
    path: e.path, expected: typeName(e.expected), received: typeName(e.received), options: e.options ?? '', limit: e.limit ?? '',
  }
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t(`parseError.${e.kind}`))
}
const SWIPE_PX = 60

function readStoredPage(): Page {
  try {
    return localStorage.getItem(PAGE_KEY) === '2' ? 2 : 1
  } catch {
    return 1
  }
}

export function SheetScreen() {
  const { t, toggleLang } = useT()
  const state = useCharacter()
  const [page, setPage] = useState<Page>(readStoredPage)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const shownPage = useRef(page)

  // sheetPageChange (effects-config.json): boot 8-bit al cambiar de página, no al entrar
  useEffect(() => {
    if (shownPage.current === page) return
    fire('sheetPageChange', { target: pageRef.current, dir: page > shownPage.current ? 1 : -1 })
    shownPage.current = page
  }, [page])

  // La fila de arriba: páginas, ▶ JUGAR y el idioma. Con el JSON roto, las páginas van apagadas.
  const nav = (onSelect?: (p: Page) => void) => (
    <nav className="pages">
      {PAGES.map((p) => (
        <button
          key={p}
          type="button"
          className="page-btn"
          aria-current={onSelect && page === p ? 'page' : undefined}
          disabled={!onSelect}
          onClick={() => onSelect?.(p)}
          data-testid={`sheet-page-${p}`}
        >
          {t(`sheet.page.${p}`)}
        </button>
      ))}
      <a className="page-btn page-link" href={href('play')} data-testid="sheet-play">
        ▶ {t('nav.play')}
      </a>
      <button type="button" className="page-btn page-link" onClick={toggleLang} data-testid="lang-toggle">
        {t('lang.toggle')}
      </button>
    </nav>
  )

  if (!state.ok) {
    return (
      <section className="sheet">
        {nav()}
        <div data-testid="sheet-parse-errors">
          <h1>{t('sheet.parseError')}</h1>
          <ul>
            {state.errors.map((e, i) => (
              <li key={`${i}:${e.path}`}>
                <code>{parseErrorText(t, e)}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>
    )
  }

  const { character, sheet } = state
  const selectPage = (next: Page) => {
    setPage(next)
    window.scrollTo(0, 0)
    try {
      localStorage.setItem(PAGE_KEY, String(next))
    } catch {
      // sin storage: la página no se recuerda
    }
  }

  // Swipe horizontal: ← página 2, → página 1. Si el gesto es más vertical que horizontal, es scroll.
  const onTouchEnd = (e: TouchEvent) => {
    const end = e.changedTouches[0]
    const start = touch.current
    touch.current = null
    if (!start || !end) return
    const dx = end.clientX - start.x
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(end.clientY - start.y)) return
    if (dx < 0 && page === 1) selectPage(2)
    if (dx > 0 && page === 2) selectPage(1)
  }

  return (
    <section className="sheet">
      {nav(selectPage)}
      <IssuesBanner sheet={sheet} />
      <div
        className="page"
        ref={pageRef}
        onTouchStart={(e) => {
          const p = e.touches[0]
          touch.current = p ? { x: p.clientX, y: p.clientY } : null
        }}
        onTouchEnd={onTouchEnd}
      >
        {page === 1 ? <PageOne sheet={sheet} /> : <PageTwo sheet={sheet} character={character} />}
      </div>
      <footer className="sheet-footer">{t('sheet.footer')}</footer>
    </section>
  )
}
