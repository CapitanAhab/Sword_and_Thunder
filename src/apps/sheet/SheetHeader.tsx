import type { ComputedSheet } from '../../core/compute'
import { ABILITIES, BIO_FIELDS } from '../../core/schema'
import { useT } from '../../i18n/useT'
import { alignmentLabel, formatInt, formatValue, statParts } from './labels'
import { localName, localSource } from '../../data/names'
import { Block, OpenParts, type PanelStat } from './StatLine'

// Cabecera de la página 1: nombre a la izquierda, clase, nivel y XP ganada a la derecha, y los atributos en 6
// columnas. Un atributo con desglose (no solo la base) se toca y el desglose aparece debajo.
// La descripción (raza, alineamiento, datos personales, XP para el próximo nivel) va en la página 2.
export function SheetHeader({ sheet, open, onToggle }: { sheet: ComputedSheet; open: string | null; onToggle: (id: string) => void }) {
  const { t, lang } = useT()
  const classes = sheet.classes.map((c) => `${localName(lang, c.id, c.name)} ${c.level}`).join(' / ')
  const items: PanelStat[] = ABILITIES.map((a) => ({ testId: `sheet-ability-${a}`, label: t(`ability.${a}`), stat: sheet.abilities[a].score, signed: false }))

  return (
    <Block>
      {/* El encabezado es lo memorable de la ficha: el nombre en letra de inscripción, el rayo debajo y un
          resplandor de tormenta detrás (sheet.css). Clase y XP a la derecha, en dos renglones. */}
      <header className="sheet-head">
        <div className="sheet-head-name">
          <h1 data-testid="sheet-name">{sheet.name}</h1>
          <span className="sheet-bolt" aria-hidden />
        </div>
        <p className="sheet-head-meta">
          <span data-testid="sheet-level">{classes}</span>
          <span>
            {t('sheet.xp')}{' '}
            <span className="header-xp" data-testid="sheet-xp">
              {formatInt(sheet.xp.current, lang)}
            </span>
          </span>
        </p>
      </header>
      <div className="abilities">
        {ABILITIES.map((a) => {
          const { score, mod } = sheet.abilities[a]
          const tappable = Boolean(statParts(t, score, false, (s) => localSource(lang, s)))
          const id = `sheet-ability-${a}`
          const inner = (
            <>
              <span className="stat-label">{t(`ability.${a}`)}</span>
              <span className="ability-score" data-testid={id}>
                {score.total}
              </span>
              <span className="ability-mod" data-testid={`${id}-mod`}>
                {formatValue(mod, true)}
              </span>
            </>
          )
          return tappable ? (
            <button key={a} type="button" className="ability tap-stat" aria-expanded={open === id} onClick={() => onToggle(id)}>
              {inner}
            </button>
          ) : (
            <div key={a} className="ability">
              {inner}
            </div>
          )
        })}
      </div>
      <OpenParts items={items} open={open} />
    </Block>
  )
}

// Descripción (página 2, dentro de su plegable): raza, alineamiento y tamaño; los datos personales que haya; y la XP
// con el próximo nivel.
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
    <>
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
    </>
  )
}
