import { useT } from '../../i18n/useT'
import type { MenuItem } from './menus'

// Tarjeta con el detalle completo de un ítem (mismo marco que SpellCard), a pantalla completa:
//   dónde estás (Personaje › Defensa) · título con el número grande a la derecha · tipo de acción
//   · lo urgente · las columnas o el desglose en filas (Base 10 / Armadura +4, Camisa de malla / Destreza +1) · el texto.
// ✕ VOLVER la cierra.
const BIG_MAX = 8 // `line` corto (un número, "+5", "15") va grande al lado del título; si no, es texto

export function DetailCard({ detail, where, onClose }: { detail: MenuItem['detail']; where?: string; onClose: () => void }) {
  const { t } = useT()
  const { title, tag, stats, line, note, extra, warn, parts } = detail
  const big = line && line.length <= BIG_MAX ? line : undefined
  // Con filas, `note` es el mismo desglose en una línea: no se repite
  const texts = [big ? undefined : line, parts ? undefined : note, extra].filter((s): s is string => Boolean(s))
  return (
    <div className="pcard" role="dialog" aria-label={title} data-testid="play-detail-card">
      <div className="pcard-body">
        {where && <p className="pcard-where">{where}</p>}
        <div className="pcard-head">
          <h2>{title}</h2>
          {big && <span className="pcard-big">{big}</span>}
        </div>
        {tag && <p className="pcard-sub">{tag}</p>}
        {warn && <p className="pcard-text d-warn">{warn}</p>}
        {stats && (
          <dl className="pcard-rows num">
            {stats.map((s) => (
              <div key={s.id}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {parts && (
          <dl className="pcard-rows num" data-testid="play-detail-card-parts">
            {parts.map((p, i) => (
              <div key={i}>
                <dt>
                  {p.label}
                  {p.sub && <small>{p.sub}</small>}
                </dt>
                <dd>{p.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {texts.map((s, i) => (
          <p key={i} className="pcard-text">
            {s}
          </p>
        ))}
      </div>
      <button type="button" className="pcard-close" onClick={onClose} data-testid="play-detail-card-close">
        ✕ {t('play.close')}
      </button>
    </div>
  )
}
