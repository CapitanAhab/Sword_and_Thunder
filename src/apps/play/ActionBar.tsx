import type { CSSProperties } from 'react'
import { useT } from '../../i18n/useT'
import { HOLD_MS, useHold } from './useHold'

// Barra del pulgar: [✕] [▲] [▼] [CONFIRMAR]. En Preparar: [✕] [−] [+] [LISTO].
// Si el ítem es `hold`, CONFIRMAR se mantiene apretado (se llena) y un toque corto no hace nada.
// cancelHold: en el menú principal, con algo para deshacer, mantener ✕ apretado deshace (un toque sigue siendo ✕).
type Props = {
  mode: 'menu' | 'prepare'
  hold: boolean
  onCancel: () => void
  onConfirm: () => void
  onUp: () => void // ▲ o −
  onDown: () => void // ▼ o +
  cancelHold?: boolean
  onCancelHold?: () => void
}

export function ActionBar({ mode, hold, onCancel, onConfirm, onUp, onDown, cancelHold = false, onCancelHold = () => {} }: Props) {
  const { t } = useT()
  const { holding, handlers } = useHold(onConfirm)
  const undo = useHold(onCancelHold)
  const prep = mode === 'prepare'
  return (
    <div className="actions">
      <button
        type="button"
        className={cancelHold ? `hold${undo.holding ? ' holding' : ''}` : undefined}
        style={{ '--hold-ms': `${HOLD_MS}ms` } as CSSProperties}
        onClick={onCancel}
        {...(cancelHold ? undo.handlers : {})}
        aria-label={cancelHold ? t('play.undoHold') : t('play.cancel')}
        data-testid="btn-cancel"
      >
        <span>✕</span>
      </button>
      <button type="button" onClick={onUp} aria-label={t(prep ? 'play.minus' : 'play.up')} data-testid={prep ? 'btn-minus' : 'btn-up'}>
        {prep ? '−' : '▲'}
      </button>
      <button type="button" onClick={onDown} aria-label={t(prep ? 'play.plus' : 'play.down')} data-testid={prep ? 'btn-plus' : 'btn-down'}>
        {prep ? '+' : '▼'}
      </button>
      <button
        type="button"
        className={`confirm${hold ? ' hold' : ''}${holding ? ' holding' : ''}`}
        style={{ '--hold-ms': `${HOLD_MS}ms` } as CSSProperties}
        onClick={hold ? undefined : onConfirm}
        {...(hold ? handlers : {})}
        data-testid="btn-confirm"
      >
        <span>{t(prep ? 'play.done' : 'play.confirm')}</span>
      </button>
    </div>
  )
}
