import { Fragment, useState, type ReactNode } from 'react'
import type { ComputedSheet, FeatureLine, SpellcastingLine } from '../../core/compute'
import type { Character } from '../../core/schema'
import { emptySession } from '../../core/session'
import { useT, type Lang } from '../../i18n/useT'
import { alignmentLabel, damageTypeLabel, formatKg, minus, prettyCrit, slotLabel } from './labels'
import { Description } from './SheetHeader'
import { SkillsCard } from './PageOne'
import { localName, localNote, localSource, localSpell, localSummary } from '../../data/names'
import { spells as spellDefs } from '../../data/spells'
import { SpellCard } from '../play/SpellCard'
import { spellDamage, spellRangeText, type MenuCtx } from '../play/menus'

type SpellRef = { level: string; name: string }

// Lo que está abierto en la página 2 se recuerda en este navegador (solo una comodidad: sin storage, arranca cerrado).
const OPEN_KEY = 'sat.sheet.open'
function readOpen(): Set<string> {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

// Página 2, la consulta, en plegables: cada sección es una fila con un resumen y se abre al tocarla.
// Descripción, habilidades, conjuros, dotes, rasgos, aptitudes, equipo (con la armadura arriba), dinero, idiomas y notas.
// Todo nombre visible pasa por names.ts (en ES todo en español; los datos quedan en inglés).
export function PageTwo({ sheet, character }: { sheet: ComputedSheet; character: Character }) {
  const { t, lang } = useT()
  const [card, setCard] = useState<SpellRef | null>(null)
  const [opened, setOpened] = useState<Set<string>>(readOpen)
  const toggle = (id: string) =>
    setOpened((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]))
      } catch {
        // sin storage: lo abierto no se recuerda
      }
      return next
    })
  const fold = (id: string) => ({ id, open: opened.has(id), onToggle: () => toggle(id) })

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
      .join(', ')

  const weaponLine = (w: (typeof weapons)[number]) => (
    <>
      {localName(lang, w.id, w.name)}
      {w.enhancement ? ` +${w.enhancement}` : ''}  {w.damage} {prettyCrit(w.critical)}
      {w.damageType && ` ${damageTypeLabel(t, w.damageType)}`}
    </>
  )
  const itemLine = (i: (typeof items)[number]) => (
    <>
      {localName(lang, i.id, i.name)}
      {qty(i.quantity)}
      {i.slot && ` (${slotLabel(t, i.slot)})`}
      {i.notes && <small className="muted item-note">{localNote(lang, i.id, i.notes)}</small>}
    </>
  )
  // Carga: lo que lleva sobre el tope de la carga en la que está (ligera → tope de ligera; excedida → tope de pesada)
  const load = sheet.load
  const loadCap = load ? (load.category === 'light' ? load.light : load.category === 'medium' ? load.medium : load.heavy) : 0

  // La tarjeta del conjuro es la de #/play; en la ficha no hay sesión (solo lectura, sin efectos).
  const cardCtx: MenuCtx = { t, lang, sheet, session: emptySession(), character, draft: {}, showAllSkills: false }
  const sc = sheet.spellcasting[0]
  const { available, spent } = sheet.skillRanks
  const trained = sheet.skills.filter((s) => s.ranks > 0).length
  const featureCount = sheet.features.length
  const spellSummary = Object.entries(character.spellbook)
    .filter(([, list]) => list.length)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([lv, list]) => (lv === '0' ? `${list.length} ${t('play.cantrips').toLowerCase()}` : `${t('play.level')} ${lv}: ${list.length}`))

  return (
    <div className="panel">
      <Fold {...fold('description')} title={t('sheet.section.description')} summary={<Parts items={[localSource(lang, sheet.race), sheet.alignment && alignmentLabel(t, sheet.alignment)]} />}>
        <Description sheet={sheet} />
      </Fold>

      <Fold
        {...fold('skills')}
        title={t('sheet.skills')}
        summary={
          <Parts
            items={[
              String(trained),
              <>
                {t('sheet.ranks')} <span data-testid="sheet-skill-ranks">{spent}/{available}</span>
              </>,
            ]}
          />
        }
      >
        <SkillsCard sheet={sheet} />
      </Fold>

      {/* El spellbook es del personaje; los /día y CD salen de la primera clase lanzadora */}
      {sc && (
        <Fold {...fold('spells')} arcane title={t('sheet.spells')} summary={<Parts items={spellSummary} />}>
          <Spellbook sc={sc} spellbook={character.spellbook} ctx={cardCtx} cantrips={fold('cantrips')} onOpen={setCard} />
        </Fold>
      )}

      <Fold
        {...fold('feats')}
        title={t('sheet.feats')}
        summary={
          <span data-testid="sheet-feat-slots">
            {sheet.featSlots.used}/{sheet.featSlots.available}
          </span>
        }
      >
        <ul className="plain-list">
          {sheet.feats.map((f) => {
            const summary = localSummary(lang, f.id)
            return (
              <li key={f.id + (f.param ?? '')}>
                <span data-testid={`sheet-feat-${f.id}`}>
                  {localName(lang, f.id, f.name)}
                  {f.param && ` (${localSource(lang, f.param)})`}
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
      </Fold>

      {character.traits.length > 0 && (
        <Fold {...fold('traits')} title={t('sheet.traits')} summary={String(character.traits.length)}>
          <ul className="plain-list">
            {character.traits.map((tr) => (
              <li key={tr.name}>{localSource(lang, tr.name)}</li>
            ))}
          </ul>
        </Fold>
      )}

      <Fold {...fold('abilities')} title={t('sheet.specialAbilities')} summary={String(featureCount)}>
        {raceFeatures.length > 0 && <FeatureGroup head={localSource(lang, sheet.race)} features={raceFeatures} lang={lang} />}
        {sheet.classes.map((c) => {
          const own = sheet.features.filter((f) => f.source === c.id)
          if (!own.length) return null
          return <FeatureGroup key={c.id} head={`${localName(lang, c.id, c.name)} ${c.level}`} features={own} lang={lang} testId={`sheet-features-${c.id}`} />
        })}
      </Fold>

      <Fold
        {...fold('equipment')}
        title={t('sheet.equipment')}
        summary={
          load && (
            <span data-testid="sheet-load">
              <Parts items={[`${formatKg(load.carried, lang)}/${formatKg(loadCap, lang)} ${t('sheet.kg')}`, t(`load.${load.category}`)]} />
            </span>
          )
        }
      >
        {/* La armadura y el escudo van primero, con lo que dan y lo que cuestan */}
        {armor && (
          <p className="line">
            {localSource(lang, armor.name)}
            {armor.enhancement ? ` +${armor.enhancement}` : ''}, {t(`armorCategory.${armor.category}`)}
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
        {load && load.category !== 'light' && (
          // Lo que impone la carga (con armadura vale el peor de los dos; la velocidad, en la página 1)
          <p className="muted line" data-testid="sheet-load-effects">
            {[load.maxDex !== null && `${t('sheet.maxDex')} +${load.maxDex}`, load.acp && `${t('sheet.acp')} ${minus(String(load.acp))}`].filter(Boolean).join(', ')}
          </p>
        )}
        {load ? (
          // Con pesos: un objeto por fila y su peso a la derecha (kg; los que no tienen peso, "—")
          <ul className="plain-list">
            {weapons.map((w) => (
              <GearRow key={w.id} id={w.id} weight={w.weight} lang={lang}>
                {weaponLine(w)}
              </GearRow>
            ))}
            {armor && (
              <GearRow id="armor" weight={armor.weight} lang={lang}>
                {localSource(lang, armor.name)}
                {armor.enhancement ? ` +${armor.enhancement}` : ''}
              </GearRow>
            )}
            {shield && (
              <GearRow id="shield" weight={shield.weight} lang={lang}>
                {localSource(lang, shield.name)}
                {shield.enhancement ? ` +${shield.enhancement}` : ''}
              </GearRow>
            )}
            {items.map((i) => (
              <GearRow key={i.id} id={i.id} weight={i.weight === undefined ? undefined : i.weight * i.quantity} lang={lang}>
                {itemLine(i)}
              </GearRow>
            ))}
          </ul>
        ) : (
          <>
            <ul className="plain-list">
              {weapons.map((w) => (
                <li key={w.id}>{weaponLine(w)}</li>
              ))}
              {detailed.map((i) => (
                <li key={i.id}>{itemLine(i)}</li>
              ))}
            </ul>
            {plain.length > 0 && <p className="line">{plain.map((i) => localName(lang, i.id, i.name) + qty(i.quantity)).join(', ')}</p>}
          </>
        )}
      </Fold>

      <Fold {...fold('wealth')} title={t('sheet.wealth')}>
        <p className="line" data-testid="sheet-wealth">
          {(['pp', 'gp', 'sp', 'cp'] as const).map((k) => `${character.wealth[k]} ${t(`gold.${k}`)}`).join(', ')}
        </p>
      </Fold>

      <Fold {...fold('languages')} title={t('sheet.languages')} summary={String(sheet.languages.known.length)}>
        <p className="line" data-testid="sheet-languages">
          {sheet.languages.known.map((l) => localSource(lang, l)).join(', ')}
          {sheet.languages.pending > 0 && ` (+${sheet.languages.pending} ${t('sheet.languagesPending')})`}
        </p>
      </Fold>

      {character.notes && (
        <Fold {...fold('notes')} title={t('sheet.notes')}>
          <p className="line sheet-notes" data-testid="sheet-notes">
            {character.notes}
          </p>
        </Fold>
      )}

      {card && (
        <div className="sheet-spell-overlay">
          <SpellCard spell={card} ctx={cardCtx} onClose={() => setCard(null)} />
        </div>
      )}
    </div>
  )
}

// Partes de un resumen, separadas por espacio (sin puntos medios): "Humano  Neutral", "24,75/38 kg  ligera".
// Entre cada parte queda un espacio de texto, así el texto del elemento se lee bien ("24,75/38 kg ligera").
function Parts({ items }: { items: ReactNode[] }) {
  const list = items.filter((x) => x !== false && x !== null && x !== undefined && x !== '')
  return (
    <>
      {list.map((x, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="sheet-part">{x}</span>
        </Fragment>
      ))}
    </>
  )
}

// Una sección plegable: la fila (título a la izquierda, resumen y ▾ / ▴ a la derecha) se toca para abrirla.
// Abierta, lleva una rayita al costado: violeta si es lo mágico (`arcane`), amarilla si no.
function Fold({ id, title, summary, open, onToggle, arcane = false, children }: {
  id: string
  title: string
  summary?: ReactNode
  open: boolean
  onToggle: () => void
  arcane?: boolean
  children: ReactNode
}) {
  return (
    <section className={`panel-block fold${arcane ? ' is-arcane' : ''}`}>
      <button type="button" className="fold-row" aria-expanded={open} onClick={onToggle} data-testid={`sheet-fold-${id}`}>
        <span className="fold-title">{title}</span>
        {summary && <span className="fold-summary">{summary}</span>}
        <span className="fold-arrow" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
  )
}

// Una fila del equipo con su peso a la derecha (kg; sin peso anotado, "—").
function GearRow({ id, weight, lang, children }: { id: string; weight: number | undefined; lang: Lang; children: ReactNode }) {
  return (
    <li className="gear-row">
      <span>{children}</span>
      <span className="gear-weight" data-testid={`sheet-weight-${id}`}>
        {weight ? formatKg(weight, lang) : '—'}
      </span>
    </li>
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

// Conjuros por nivel: la cabecera (Nivel 1  2/día (+1 INT)  CD 15) y una fila por conjuro con dos columnas a la
// derecha: el alcance y el daño o, si no hace daño, la salvación. Tocar una fila abre la tarjeta. Los trucos van plegados.
function Spellbook({ sc, spellbook, ctx, cantrips, onOpen }: {
  sc: SpellcastingLine
  spellbook: Character['spellbook']
  ctx: MenuCtx
  cantrips: { open: boolean; onToggle: () => void }
  onOpen: (s: SpellRef) => void
}) {
  const { t, lang } = useT()
  const levels = [...new Set([...sc.spellsPerDay.keys(), ...Object.keys(spellbook).map(Number)])].sort((a, b) => a - b)
  const effect = (name: string) => spellDamage(ctx, name).split(' ')[0] || spellDefs[name]?.save?.[lang].split(' ')[0] || ''

  return (
    <>
      {levels.map((lv) => {
        const list = spellbook[String(lv)] ?? []
        const perDay = sc.spellsPerDay[lv]
        const bonus = sc.bonusSpells[lv]
        const dc = sc.dcs[lv]
        const head = (
          <Parts
            items={[
              <span className="spell-level-name">{lv === 0 ? t('play.cantrips') : `${t('sheet.spellLevel')} ${lv}`}</span>,
              perDay !== undefined && `${perDay}${t('sheet.perDay')}${bonus ? ` (+${bonus} ${t(`ability.${sc.ability}`)})` : ''}`,
              dc !== undefined && <span className="spell-dc">{`${t('sheet.dc')} ${dc}`}</span>,
            ]}
          />
        )
        const folded = lv === 0 && !cantrips.open
        return (
          <div key={lv} className="spell-level">
            {lv === 0 ? (
              <button type="button" className="spell-head fold-row" aria-expanded={cantrips.open} onClick={cantrips.onToggle} data-testid="sheet-spells-0-toggle">
                <span data-testid="sheet-spells-0">{head}</span>
                <span className="fold-summary">{list.length}</span>
                <span className="fold-arrow" aria-hidden>
                  {cantrips.open ? '▴' : '▾'}
                </span>
              </button>
            ) : (
              <p className="spell-head" data-testid={`sheet-spells-${lv}`}>
                {head}
              </p>
            )}
            {!folded && (
              <ul className="plain-list">
                {list.map((s) => (
                  <li key={s}>
                    <button type="button" className="spell-row" onClick={() => onOpen({ level: String(lv), name: s })} data-testid={`sheet-spell-${lv}-${s}`}>
                      <span className="spell-name">{localSpell(lang, s)}</span>
                      <span className="spell-range">{spellRangeText(ctx, s)}</span>{' '}
                      <span className="spell-effect">{effect(s)}</span>
                      <span className="muted" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </>
  )
}
