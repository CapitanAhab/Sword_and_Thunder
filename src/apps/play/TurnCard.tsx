import { useT } from '../../i18n/useT'
import type { MenuItem } from './menus'

// Pantalla de turno: tapa todo (HUD, lista y barra) hasta que la tocás. Debajo, el menú ya quedó en el principal.
// Muestra lo urgente (en amarillo), lo que sigue activo y lo que se apagó al empezar el turno.
export function TurnCard({ round, notice, onClose }: { round: number; notice: MenuItem['detail']; onClose: () => void }) {
  const { t } = useT()
  const { line, lineWarn, note, extra } = notice
  return (
    <button type="button" className="spell-card turn-card" onClick={onClose} aria-label={notice.title} data-testid="play-turn-notice">
      <span className="turn-card-head">
        <b data-testid="play-turn-round">⚔ {t('play.turn.round').replace('{n}', String(round))}</b>
        <span>{t('play.turn.yours')}</span>
      </span>
      <span className="turn-card-body">
        {line && <span className={lineWarn ? 'spell-text d-warn' : 'spell-text'}>{line}</span>}
        {extra && <span className="spell-text">{extra}</span>}
        {note && <span className="spell-text turn-card-muted">{note}</span>}
      </span>
      <span className="spell-card-close turn-card-continue" data-testid="btn-turn-continue">
        {t('play.turn.continue')}
      </span>
    </button>
  )
}
