import { useT } from '../../i18n/useT'
import { spells } from '../../data/spells'
import { localSchool, localSpell } from '../../data/names'
import { spellDamage, spellDc, spellRangeText, type MenuCtx } from './menus'

// Tarjeta completa del conjuro (mismo marco que DetailCard, con scroll). ✕ o VOLVER la cierran.
export function SpellCard({ spell, ctx, where, onClose }: { spell: { level: string; name: string }; ctx: MenuCtx; where?: string; onClose: () => void }) {
  const { t, lang } = useT()
  const def = spells[spell.name]
  const dc = spellDc(ctx, spell.level, spell.name)
  const level = spell.level === '0' ? t('play.cantrips') : `${t('play.level')} ${spell.level}`
  const rows: [string, string][] = def
    ? [
        [t('spell.castingTime'), t(def.castingTime === 'round' ? 'spell.round' : 'spell.standard')],
        [t('spell.range'), spellRangeText(ctx, spell.name)],
        [t('spell.target'), def.target[lang]],
        [t('spell.duration'), def.duration[lang]],
        [t('spell.save'), def.save ? def.save[lang] + (dc === null ? '' : ` · ${t('sheet.dc')} ${dc}`) : t('spell.no')],
        [t('spell.sr'), t(def.sr ? 'spell.yes' : 'spell.no')],
        ...(def.damage ? [[t('spell.damage'), spellDamage(ctx, spell.name) + (def.scaling ? ` (${def.scaling[lang]})` : '')] as [string, string]] : []),
      ]
    : []

  return (
    <div className="pcard" role="dialog" aria-label={localSpell(lang, spell.name)} data-testid="play-spell-card">
      <div className="pcard-body">
        {where && <p className="pcard-where">{where}</p>}
        <div className="pcard-head">
          <h2>{localSpell(lang, spell.name)}</h2>
        </div>
        <p className="pcard-sub">
          {level}
          {def && ` · ${localSchool(lang, def.school)}`}
        </p>
        {def ? (
          <>
            <dl className="pcard-rows">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="pcard-text">{def.text[lang]}</p>
          </>
        ) : (
          <p className="pcard-text">{t('play.unknownSpell')}</p>
        )}
      </div>
      <button type="button" className="pcard-close" onClick={onClose} data-testid="play-spell-card-close">
        ✕ {t('play.close')}
      </button>
    </div>
  )
}
