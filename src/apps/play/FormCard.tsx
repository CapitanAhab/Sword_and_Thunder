import { useState, type CSSProperties } from 'react'
import { useT } from '../../i18n/useT'
import { useCardFx } from './fx/useCardFx'
import { HOLD_MS, useHold } from './useHold'

// Formulario a pantalla completa, con el marco de las tarjetas: anotar oro, notas, un objeto, el respaldo.
export type FormValues = Record<string, string>

export interface FormField {
  id: string
  label: string
  kind: 'text' | 'number' | 'decimal' | 'area'
  value: string
  readOnly?: boolean
}

export interface FormAction {
  id: string
  label: string
  hold?: boolean // se confirma manteniendo apretado
  run: (values: FormValues) => string | void // un texto = error: el formulario sigue abierto
}

export interface FormSpec {
  id: string
  title: string
  note?: string
  fields: FormField[]
  actions: FormAction[]
}

function ActionButton({ action, onRun }: { action: FormAction; onRun: () => void }) {
  const { holding, handlers } = useHold(onRun)
  return (
    <button
      type="button"
      className={action.hold ? `pform-action hold${holding ? ' holding' : ''}` : 'pform-action'}
      style={{ '--hold-ms': `${HOLD_MS}ms` } as CSSProperties}
      onClick={action.hold ? undefined : onRun}
      {...(action.hold ? handlers : {})}
      data-testid={`form-${action.id}`}
    >
      <span>{action.label}</span>
    </button>
  )
}

export function FormCard({ spec, where, onClose, onDone }: { spec: FormSpec; where: string; onClose: () => void; onDone: (held: boolean) => void }) {
  const { t } = useT()
  const cardRef = useCardFx()
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(spec.fields.map((f) => [f.id, f.value])))
  const [error, setError] = useState('')

  const run = (action: FormAction) => {
    const problem = action.run(values)
    if (problem) setError(problem)
    else onDone(Boolean(action.hold))
  }

  return (
    <div ref={cardRef} className="pcard" role="dialog" aria-label={spec.title} data-testid={`form-${spec.id}`}>
      <div className="pcard-body pform">
        <p className="pcard-where">{where}</p>
        <div className="pcard-head">
          <h2>{spec.title}</h2>
        </div>
        {spec.note && <p className="pcard-text">{spec.note}</p>}
        {spec.fields.map((f, i) => {
          const common = {
            value: values[f.id] ?? '',
            readOnly: f.readOnly,
            autoFocus: i === 0 && !f.readOnly,
            onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f.id]: e.target.value })),
            'data-testid': `form-field-${f.id}`,
          }
          return (
            <label key={f.id} className={f.kind === 'area' ? 'pform-field grow' : 'pform-field'}>
              <span>{f.label}</span>
              {f.kind === 'area' ? (
                <textarea {...common} />
              ) : (
                <input {...common} type="text" inputMode={f.kind === 'number' ? 'numeric' : f.kind === 'decimal' ? 'decimal' : 'text'} />
              )}
            </label>
          )
        })}
        {error && <p className="pcard-text d-warn" data-testid="form-error">{error}</p>}
      </div>
      <div className="pform-actions">
        <button type="button" className="pform-action" onClick={onClose} aria-label={t('play.cancel')} data-testid="form-close">
          ✕
        </button>
        {spec.actions.map((a) => (
          <ActionButton key={a.id} action={a} onRun={() => run(a)} />
        ))}
      </div>
    </div>
  )
}
