import type { ComputedSheet } from '../../core/compute'
import { ABILITIES, BIO_FIELDS } from '../../core/schema'
import { useT } from '../../i18n/useT'
import { alignmentLabel, formatInt, formatValue, statParts } from './labels'
import { localName, localSource } from '../../data/names'

// Cabecera de la página 1: nombre, clase y nivel, la XP ganada y los atributos (con desglose si no es solo la base).
// La descripción (raza, alineamiento, datos personales, XP para el próximo nivel) va en la página 2.
export function SheetHeader({ sheet }: { sheet: ComputedSheet }) {
  const { t, lang } = useT()
  const classes = sheet.classes.map((c) => `${localName(lang, c.id, c.name)} ${c.level}`).join(' / ')
  const abilityParts = ABILITIES.map((a) => ({ a, parts: statParts(t, sheet.abilities[a].score, false, (s) => localSource(lang, s)) })).filter((x) => x.parts)

  return (
    <header className="sheet-header card">
      <h1 data-testid="sheet-name">{sheet.name}</h1>
      <p className="muted">
        <span data-testid="sheet-level">{classes}</span> · {t('sheet.xp')}{' '}
        <span className="header-xp" data-testid="sheet-xp">
          {formatInt(sheet.xp.current, lang)}
        </span>
      </p>
      <div className="abilities">
        {ABILITIES.map((a) => {
          const { score, mod } = sheet.abilities[a]
          return (
            <div key={a} className="ability">
              <span className="stat-label">{t(`ability.${a}`)}</span>
              <span className="ability-score" data-testid={`sheet-ability-${a}`}>
                {score.total}
              </span>
              <span className="ability-mod" data-testid={`sheet-ability-${a}-mod`}>
                {formatValue(mod, true)}
              </span>
            </div>
          )
        })}
      </div>
      {abilityParts.map(({ a, parts }) => (
        <p key={a} className="stat-parts ability-parts">
          {t(`ability.${a}`)} {sheet.abilities[a].score.total} <span aria-hidden>= </span>
          <span data-testid={`sheet-ability-${a}-parts`}>{parts}</span>
        </p>
      ))}
    </header>
  )
}

// Descripción (página 2): raza, alineamiento y tamaño; los datos personales que haya; y la XP con el próximo nivel.
export function Description({ sheet }: { sheet: ComputedSheet }) {
  const { t, lang } = useT()
  const { current, next } = sheet.xp
  // Datos personales: solo los que están. Sexo, altura y peso van sin rótulo ("1,80 m" se entiende solo).
  const bio = BIO_FIELDS.flatMap((f) => {
    const v = sheet.bio[f]
    if (!v) return []
    return [f === 'gender' || f === 'height' || f === 'weight' ? v : `${t(`bio.${f}`)} ${v}`]
  }).join(' · ')

  return (
    <section className="card">
      <h2 className="card-title">{t('sheet.section.description')}</h2>
      <p className="line" data-testid="sheet-summary">
        {[localSource(lang, sheet.race), sheet.alignment && alignmentLabel(t, sheet.alignment), t(`size.${sheet.size}`)].filter(Boolean).join(' · ')}
      </p>
      {bio && (
        <p className="line" data-testid="sheet-bio">
          {bio}
        </p>
      )}
      <p className="line">
        {t('sheet.xp')}{' '}
        <span data-testid="sheet-xp-next">
          {formatInt(current, lang)}
          {next !== null && ` / ${formatInt(next, lang)}`}
        </span>
      </p>
    </section>
  )
}
