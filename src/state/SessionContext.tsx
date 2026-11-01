import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { Character } from '../core/schema'
import { computeSheet, type ComputedSheet } from '../core/compute'
import { applySession, newSession, parseSession, toSessionContext, type Session } from '../core/session'
import { db } from '../data'
import { spellBuffs } from '../data/spells'

// Sesión de #/play (HP, slots, Arcane Pool, posturas…) en el localStorage del celular, separada de la ficha.
// El reducer recibe funciones puras de core/session.ts: update((s) => castSpell(s, '1', 'Shield')).
const STORAGE_KEY = 'sat.session.v1'

type Update = (s: Session) => Session

type SessionValue = {
  character: Character
  session: Session
  sheet: ComputedSheet // ficha con la sesión aplicada (posturas, condiciones, mejora del arma)
  update: (fn: Update) => void
}

const SessionCtx = createContext<SessionValue | null>(null)

// Sin sesión guardada (o si no valida): sesión nueva con la preparación por defecto del personaje.
function readStored(character: Character): Session {
  const fresh = () => newSession(character)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseSession(JSON.parse(raw), fresh) : fresh()
  } catch {
    return fresh()
  }
}

export function SessionProvider({ character, children }: { character: Character; children: ReactNode }) {
  const [session, update] = useReducer((s: Session, fn: Update) => fn(s), character, readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // sin storage: la sesión dura lo que la pestaña
    }
  }, [session])

  const sheet = useMemo(
    () => computeSheet(applySession(character, session), db, toSessionContext(session, spellBuffs)),
    [character, session],
  )
  const value = useMemo<SessionValue>(() => ({ character, session, sheet, update }), [character, session, sheet])
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
