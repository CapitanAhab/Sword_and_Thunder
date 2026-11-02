import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import type { Character } from '../core/schema'
import { computeSheet, type ComputedSheet } from '../core/compute'
import {
  applySession, newSession, parseSessionFields, reconcileSession, toSessionContext, type Session, type SessionFix,
} from '../core/session'
import { db } from '../data'
import { spellBuffs } from '../data/spells'
import { itemBuffs } from '../data/items'

// Modifiers de cada buff activo: los de conjuros (por nombre) y los de objetos (por id)
const buffMods = { ...spellBuffs, ...itemBuffs }

// Sesión de #/play (HP, slots, Arcane Pool, posturas…) en el localStorage del celular, separada de la ficha.
// El reducer recibe funciones puras de core/session.ts: update((s) => castSpell(s, '1', 'Shield')).
const STORAGE_KEY = 'sat.session.v1'
// Copia de lo guardado cuando algún campo no validaba y se descartó (para revisarlo a mano)
const BROKEN_KEY = 'sat.session.v1.broken'

type Update = (s: Session) => Session

type SessionValue = {
  character: Character
  session: Session
  sheet: ComputedSheet // ficha con la sesión aplicada (posturas, condiciones, mejora del arma)
  update: (fn: Update) => void
  fixes: SessionFix[] // lo que se ajustó al cargar (vacío si nada): se avisa en "Tocá para empezar"
}

const SessionCtx = createContext<SessionValue | null>(null)

// La ficha del personaje sin sesión: los máximos contra los que se ajusta lo guardado
const baseSheet = (character: Character) => computeSheet(character, db)

// Lo guardado, campo por campo, y ajustado al personaje actual. Sin nada guardado (o si no es una sesión):
// sesión nueva con la preparación por defecto del personaje.
function load(character: Character): { session: Session; fixes: SessionFix[] } {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // sin storage: sesión nueva
  }
  let parsed: ReturnType<typeof parseSessionFields> = null
  try {
    parsed = raw ? parseSessionFields(JSON.parse(raw)) : null
  } catch {
    parsed = null
  }
  if (!parsed) return { session: newSession(character), fixes: [] }
  if (parsed.dropped.length && raw) {
    try {
      localStorage.setItem(BROKEN_KEY, raw)
    } catch {
      // sin storage: no queda la copia
    }
  }
  const { session, fixes } = reconcileSession(character, baseSheet(character), parsed.session)
  return { session, fixes: [...parsed.dropped.map((field): SessionFix => ({ kind: 'field-dropped', field })), ...fixes] }
}

export function SessionProvider({ character, children }: { character: Character; children: ReactNode }) {
  const [initial] = useState(() => load(character))
  const [session, update] = useReducer((s: Session, fn: Update) => fn(s), initial.session)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // sin storage: la sesión dura lo que la pestaña
    }
  }, [session])

  // Si el personaje cambia con la app abierta (JSON editado), la sesión se vuelve a ajustar, sin aviso.
  const shownCharacter = useRef(character)
  useEffect(() => {
    if (shownCharacter.current === character) return
    shownCharacter.current = character
    update((s) => reconcileSession(character, baseSheet(character), s).session)
  }, [character])

  const sheet = useMemo(
    () => computeSheet(applySession(character, session), db, toSessionContext(session, buffMods)),
    [character, session],
  )
  const value = useMemo<SessionValue>(() => ({ character, session, sheet, update, fixes: initial.fixes }), [character, session, sheet, initial])
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
