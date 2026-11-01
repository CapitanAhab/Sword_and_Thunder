import { useT } from '../../i18n/useT'
import type { MenuItem } from './menus'

// Tarjeta con el detalle completo de un ítem que no entra en el panel (misma maqueta que SpellCard).
export function DetailCard({ detail, onClose }: { detail: MenuItem['detail']; onClose: () => void }) {
  const { t } = useT()
  const { title, tag, stats, line, note, extra, warn } = detail
  return (
    <div className="spell-card" role="dialog" aria-label={title} data-testid="play-detail-card">
      <div className="spell-card-body">
        <h2>{title}</h2>
        {tag && <p className="spell-school">{tag}</p>}
        {warn && <p className="spell-text d-warn">{warn}</p>}
        {stats && (
          <dl>
            {stats.map((s) => (
              <div key={s.id}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {[line, note, extra]
          .filter((s): s is string => Boolean(s))
          .map((s, i) => (
            <p key={i} className="spell-text">
              {s}
            </p>
          ))}
      </div>
      <button type="button" className="spell-card-close" onClick={onClose} data-testid="play-detail-card-close">
        ✕ {t('play.close')}
      </button>
    </div>
  )
}
