import { useState } from 'react'
import type { ComputedSheet, FeatureLine, SpellcastingLine } from '../../core/compute'
import type { Character } from '../../core/schema'
import { emptySession } from '../../core/session'
import { useT, type Lang } from '../../i18n/useT'
import { damageTypeLabel, formatValue, minus, prettyCrit, resourceDetailLabel, slotLabel } from './labels'
import { PlainLine, StatLine } from './StatLine'
import { localName, localNote, localSource, localSpell, localSummary } from '../../data/names'
import { SpellCard } from '../play/SpellCard'
import type { MenuCtx } from '../play/menus'

type SpellRef = { level: string; name: string }

// Página 2 de la oficial: armadura, equipo, dinero, dotes, aptitudes especiales y conjuros.
// Todo nombre visible pasa por names.ts (en ES todo en español; los datos quedan en inglés).
export function PageTwo({ sheet, character }: { sheet: ComputedSheet; character: Character }) {
  const { t, lang } = useT()
  const [card, setCard] = useState<SpellRef | null>(null)
  const { armor, shield, weapons, items } = character.equipment
  const raceFeatures = sheet.features.filter((f) => !sheet.classes.some((c) => c.id === f.source))
  // Ítems con slot o notas van en su propia fila; el resto, en una línea
  const detailed = items.filter((i) => i.slot || i.notes)
  const plain = items.filter((i) => !i.slot && !i.notes)
  const qty = (n: number) => (n > 1 ? ` ×${n}` : '')
  const gear = (g: { armorBonus?: number; shieldBonus?: number; enhancement: number; maxDex: number | null; armorCheckPenalty: number; arcaneSpellFailure: number }) =>
    [
      `+${(g.armorBonus ?? g.shieldBonus ?? 0) + g.enhancement} ${t('sheet.ac')}`,
      g.maxDex !== null && `${t('sheet.maxDex')} +${g.maxDex}`,
      g.armorCheckPenalty && `${t('sheet.acp')} ${minus(String(g.armorCheckPenalty))}`,
      g.arcaneSpellFailure && `${t('sheet.asfShort')} ${g.arcaneSpellFailure}%`,
    ]
      .filter(Boolean)
      .join(' · ')

  // La tarjeta del conjuro es la de #/play; en la ficha no hay sesión (solo lectura, sin efectos).
  const cardCtx: MenuCtx = { t, lang, sheet, session: emptySession(), character, draft: {}, showAllSkills: false }

  return (
    <>
      {(armor || shield) && (
        <section className="card">
          <h2 className="card-title">{t('sheet.armor')}</h2>
          {armor && (
            <p className="line">
              {localSource(lang, armor.name)}
              {armor.enhancement ? ` +${armor.enhancement}` : ''} · {t(`armorCategory.${armor.category}`)}
              <small className="muted item-note">{gear(armor)}</small>
            </p>
          )}
          {shield && (
            <p className="line">
              {localSource(lang, shield.name)}
              {shield.enhancement ? ` +${shield.enhancement}` : ''}
              <small className="muted item-note">{gear(shield)}</small>
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">{t('sheet.equipment')}</h2>
        <ul className="plain-list">
          {weapons.map((w) => (
            <li key={w.id}>
              {localName(lang, w.id, w.name)}
              {w.enhancement ? ` +${w.enhancement}` : ''}  {w.damage} {prettyCrit(w.critical)}
              {w.damageType && ` ${damageTypeLabel(t, w.damageType)}`}
            </li>
          ))}
          {detailed.map((i) => (
            <li key={i.id}>
              {localName(lang, i.id, i.name)}
              {qty(i.quantity)}
              {i.slot && ` (${slotLabel(t, i.slot)})`}
              {i.notes && <small className="muted item-note">{localNote(lang, i.id, i.notes)}</small>}
            </li>
          ))}
        </ul>
        {plain.length > 0 && <p className="line">{plain.map((i) => localName(lang, i.id, i.name) + qty(i.quantity)).join(' · ')}</p>}
      </section>

      <section className="card">
        <h2 className="card-title">{t('sheet.wealth')}</h2>
        <p className="line" data-testid="sheet-wealth">
          {(['pp', 'gp', 'sp', 'cp'] as const).map((k) => `${character.wealth[k]} ${t(`gold.${k}`)}`).join(' · ')}
        </p>
      </section>

      <section className="card">
        <h2 className="card-title card-title-split">
          {t('sheet.feats')} <span data-testid="sheet-feat-slots">{sheet.featSlots.used}/{sheet.featSlots.available}</span>
        </h2>
        <ul className="plain-list">
          {sheet.feats.map((f) => {
            const summary = localSummary(lang, f.id)
            return (
              <li key={f.id + (f.param ?? '')}>
                <span data-testid={`sheet-feat-${f.id}`}>
                  {localName(lang, f.id, f.name)}
                  {f.param && ` (${f.param})`}
                </span>
                {summary && (
                  <small className="muted item-note" data-testid={`sheet-feat-${f.id}-summary`}>
                    {summary}
                  </small>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {character.traits.length > 0 && (
        <section className="card">
          <h2 className="card-title">{t('sheet.traits')}</h2>
          <ul className="plain-list">
            {character.traits.map((tr) => (
              <li key={tr.name}>{tr.name}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">{t('sheet.specialAbilities')}</h2>
        {raceFeatures.length > 0 && <FeatureGroup head={localSource(lang, sheet.race)} features={raceFeatures} lang={lang} />}
        {sheet.classes.map((c) => {
          const own = sheet.features.filter((f) => f.source === c.id)
          if (!own.length) return null
          return <FeatureGroup key={c.id} head={`${localName(lang, c.id, c.name)} ${c.level}`} features={own} lang={lang} testId={`sheet-features-${c.id}`} />
        })}
        {sheet.resources.map((r) => (
          <div key={r.id}>
            <StatLine label={localName(lang, r.id, r.name)} stat={r.max} signed={false} testId={`sheet-resource-${r.id}`} />
            {Object.entries(r.details).map(([k, v]) => (
              <p key={k} className="stat-parts" data-testid={`sheet-resource-${r.id}-${k}`}>
                {resourceDetailLabel(t, k)} {formatValue(v, true)}
              </p>
            ))}
          </div>
        ))}
      </section>

      {sheet.spellcasting.map((sc) => (
        <section key={sc.classId} className="card">
          <h2 className="card-title">
            {t('sheet.spells')}
            {sheet.spellcasting.length > 1 && ` · ${sheet.classes.find((c) => c.id === sc.classId)?.name}`}
          </h2>
          <StatLine label={t('sheet.cl')} stat={sc.casterLevel} signed={false} testId="sheet-cl" />
          <StatLine label={t('sheet.concentration')} stat={sc.concentration} testId="sheet-concentration" />
          <PlainLine label={t('sheet.asf')} value={`${sc.arcaneSpellFailure}%`} testId="sheet-asf" />
        </section>
      ))}
      {/* El spellbook es del personaje; los /día y CD salen de la primera clase lanzadora */}
      {sheet.spellcasting[0] && <Spellbook sc={sheet.spellcasting[0]} spellbook={character.spellbook} onOpen={setCard} />}

      {card && (
        <div className="sheet-spell-overlay">
          <SpellCard spell={card} ctx={cardCtx} onClose={() => setCard(null)} />
        </div>
      )}
    </>
  )
}

// Aptitudes de una raza o clase: nombre y, debajo, su línea breve.
function FeatureGroup({ head, features, lang, testId }: { head: string; features: FeatureLine[]; lang: Lang; testId?: string }) {
  return (
    <div className="feature-group">
      <p className="line-head">{head}</p>
      <ul className="plain-list" data-testid={testId}>
        {features.map((f) => {
          const summary = localSummary(lang, f.id)
          return (
            <li key={f.id}>
              {localName(lang, f.id, f.name)}
              {summary && (
                <small className="muted item-note" data-testid={`sheet-feature-${f.id}-summary`}>
                  {summary}
                </small>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Spellbook({ sc, spellbook, onOpen }: { sc: SpellcastingLine; spellbook: Character['spellbook']; onOpen: (s: SpellRef) => void }) {
  const { t, lang } = useT()
  const levels = [...new Set([...sc.spellsPerDay.keys(), ...Object.keys(spellbook).map(Number)])].sort((a, b) => a - b)

  return (
    <>
      {levels.map((lv) => {
        const spells = spellbook[String(lv)] ?? []
        const perDay = sc.spellsPerDay[lv]
        const bonus = sc.bonusSpells[lv]
        const dc = sc.dcs[lv]
        const head = [
          lv === 0 ? t('play.cantrips') : `${t('sheet.spellLevel')} ${lv}`,
          perDay !== undefined && `${perDay}${t('sheet.perDay')}${bonus ? ` (+${bonus} ${t(`ability.${sc.ability}`)})` : ''}`,
          dc !== undefined && `${t('sheet.dc')} ${dc}`,
        ]
        return (
          <section key={lv} className="card">
            <h2 className="card-title" data-testid={`sheet-spells-${lv}`}>
              {head.filter(Boolean).join(' · ')}
            </h2>
            {/* Tocar un conjuro abre su tarjeta (solo lectura) */}
            <ul className="spell-list">
              {spells.map((s) => (
                <li key={s}>
                  <button type="button" className="spell-btn" onClick={() => onOpen({ level: String(lv), name: s })} data-testid={`sheet-spell-${lv}-${s}`}>
                    {localSpell(lang, s)} <span className="muted" aria-hidden>ⓘ</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
