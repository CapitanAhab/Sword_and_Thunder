import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import raw from '../characters/magus.json'
import { applyNotebook, emptyNotebook, notebookSchema, type Notebook } from '../core/notebook'
import { parseCharacter, type Character, type ParseError } from '../core/schema'
import { computeSheet, type ComputedSheet } from '../core/compute'
import { db } from '../data'

// El personaje del JSON, validado, con lo anotado en la libreta encima, y su ficha calculada.
export type CharacterState =
  | { ok: true; character: Character; sheet: ComputedSheet }
  | { ok: false; errors: ParseError[] }

interface NotebookValue {
  base: Character | null // el personaje del JSON, sin la libreta
  notebook: Notebook
  update: (fn: (nb: Notebook) => Notebook) => void
}

const STORAGE_KEY = 'sat.notebook.v1'
const BROKEN_KEY = 'sat.notebook.v1.broken'

const CharacterCtx = createContext<CharacterState | null>(null)
const NotebookCtx = createContext<NotebookValue | null>(null)

// Lo guardado que no valida se copia aparte, para no perderlo, y la libreta arranca vacía.
function loadNotebook(): Notebook {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return emptyNotebook()
    return notebookSchema.parse(JSON.parse(stored))
  } catch {
    try {
      if (stored) localStorage.setItem(BROKEN_KEY, stored)
    } catch {
      // sin storage: no queda la copia
    }
    return emptyNotebook()
  }
}

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [notebook, update] = useReducer((nb: Notebook, fn: (nb: Notebook) => Notebook) => fn(nb), undefined, loadNotebook)
  const base = useMemo(() => parseCharacter(raw), [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook))
    } catch {
      // sin storage: la libreta dura lo que la pestaña
    }
  }, [notebook])

  const value = useMemo<CharacterState>(() => {
    if (!base.ok) return base
    const character = applyNotebook(base.character, notebook)
    return { ok: true, character, sheet: computeSheet(character, db) }
  }, [base, notebook])
  const book = useMemo<NotebookValue>(() => ({ base: base.ok ? base.character : null, notebook, update }), [base, notebook])

  return (
    <NotebookCtx.Provider value={book}>
      <CharacterCtx.Provider value={value}>{children}</CharacterCtx.Provider>
    </NotebookCtx.Provider>
  )
}

export function useCharacter(): CharacterState {
  const ctx = useContext(CharacterCtx)
  if (!ctx) throw new Error('useCharacter must be used inside <CharacterProvider>')
  return ctx
}

export function useNotebook(): NotebookValue {
  const ctx = useContext(NotebookCtx)
  if (!ctx) throw new Error('useNotebook must be used inside <CharacterProvider>')
  return ctx
}
