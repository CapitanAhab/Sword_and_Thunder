import { createContext, useContext, useMemo, type ReactNode } from 'react'
import raw from '../characters/magus.json'
import { parseCharacter, type Character, type ParseError } from '../core/schema'
import { computeSheet, type ComputedSheet } from '../core/compute'
import { db } from '../data'

// Personaje base (el JSON del repo) ya validado y calculado. Más adelante, la subida de nivel podrá sumar un override desde localStorage.
export type CharacterState =
  | { ok: true; character: Character; sheet: ComputedSheet }
  | { ok: false; errors: ParseError[] }

const CharacterCtx = createContext<CharacterState | null>(null)

export function CharacterProvider({ children }: { children: ReactNode }) {
  const value = useMemo<CharacterState>(() => {
    const result = parseCharacter(raw)
    return result.ok ? { ok: true, character: result.character, sheet: computeSheet(result.character, db) } : result
  }, [])
  return <CharacterCtx.Provider value={value}>{children}</CharacterCtx.Provider>
}

export function useCharacter(): CharacterState {
  const ctx = useContext(CharacterCtx)
  if (!ctx) throw new Error('useCharacter must be used inside <CharacterProvider>')
  return ctx
}
