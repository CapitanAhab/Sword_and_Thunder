import type { CSSProperties } from 'react'
import { useT } from '../../i18n/useT'
import { HOLD_MS, useHold } from './useHold'

// Barra del pulgar: [✕] [▲] [▼] [CONFIRMAR]. En Preparar: [✕] [−] [+] [LISTO].
// Si el ítem es `hold`, CONFIRMAR se mantiene apretado (se llena) y un toque corto no hace nada.
type Props = {
  mode: 'menu' | 'prepare'
  hold: boolean
  onCancel: () => void
  onConfirm: () => void
  onUp: () => void // ▲ o −
  onDown: () => void // ▼ o +
}

export function ActionBar({ mode, hold, onCancel, onConfirm, onUp, onDown }: Props) {
  const { t } = useT()
  const { holding, handlers } = useHold(onConfirm)
  const prep = mode === 'prepare'
  return (
    <div className="actions">
      <button type="button" onClick={onCancel} aria-label={t('play.cancel')} data-testid="btn-cancel">
        ✕
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
