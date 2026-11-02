import { useState } from 'react'
import type { AttackLine, ComputedSheet, SkillLine } from '../../core/compute'
import { useT } from '../../i18n/useT'
import { conditionalTexts, damageTypeLabel, formatValue, prettyCrit, resourceDetailLabel, SKILL_SEP, statParts } from './labels'
import { localName, localSource } from '../../data/names'
import { SheetHeader } from './SheetHeader'
import { PlainLine, StatBox, StatLine } from './StatLine'

// Página 1, lo que se usa en la mesa: cabecera, PG, defensas, salvaciones, combate, armas y magia.
export function PageOne({ sheet }: { sheet: ComputedSheet }) {
  const { t, lang } = useT()
  const { ac, saves } = sheet
  const acParts = statParts(t, ac.normal, false, (s) => localSource(lang, s))

  return (
    <>
      <SheetHeader sheet={sheet} />
      <section className="card">
        <h2 className="card-title">{t('sheet.section.hpInit')}</h2>
        <StatLine label={t('sheet.hp')} stat={sheet.hp} signed={false} testId="sheet-hp" />
        <StatLine label={t('sheet.init')} stat={sheet.initiative} testId="sheet-init" />
      </section>
      <section className="card">
        <h2 className="card-title">{t('sheet.section.defense')}</h2>
        <div className="stat-boxes">
          <StatBox label={t('sheet.ac')} stat={ac.normal} signed={false} testId="sheet-ac" />
          <StatBox label={t('sheet.touch')} stat={ac.touch} signed={false} testId="sheet-ac-touch" />
          <StatBox label={t('sheet.flatFooted')} stat={ac.flatFooted} signed={false} testId="sheet-ac-flat" />
        </div>
        {/* El desglose de la CA es largo: va debajo de las cajitas */}
        {acParts && (
          <p className="stat-parts">
            {t('sheet.ac')} <span aria-hidden>= </span>
            <span data-testid="sheet-ac-parts">{acParts}</span>
          </p>
        )}
        {conditionalTexts(t, ac.normal, false).map((c) => (
          <p key={c} className="stat-cond" data-testid="sheet-ac-conditional">
            {c}
          </p>
        ))}
      </section>
      <section className="card">
        <h2 className="card-title">{t('sheet.section.saves')}</h2>
        <div className="stat-boxes">
          <StatBox label={t('sheet.fort')} stat={saves.fort} testId="sheet-save-fort" withParts />
          <StatBox label={t('sheet.ref')} stat={saves.ref} testId="sheet-save-ref" withParts />
          <StatBox label={t('sheet.will')} stat={saves.will} testId="sheet-save-will" withParts />
        </div>
      </section>
      <section className="card">
        <h2 className="card-title">{t('sheet.section.combat')}</h2>
        <PlainLine label={t('sheet.bab')} value={formatValue(sheet.bab, true)} testId="sheet-bab" />
        <StatLine label={t('sheet.cmb')} stat={sheet.cmb} testId="sheet-cmb" />
        <StatLine label={t('sheet.cmd')} stat={sheet.cmd} signed={false} testId="sheet-cmd" />
        <StatLine label={t('sheet.speed')} stat={sheet.speed} signed={false} suffix={t('sheet.ft')} testId="sheet-speed" />
      </section>
      {sheet.attacks.map((a) => (
        <AttackCard key={a.id} attack={a} />
      ))}
      <MagicCard sheet={sheet} />
    </>
  )
}

// Magia: nivel de lanzador, concentración y fallo arcano de cada clase lanzadora, y los recursos de clase
// (la Reserva arcana con su mejora máxima).
function MagicCard({ sheet }: { sheet: ComputedSheet }) {
  const { t, lang } = useT()
  if (!sheet.spellcasting.length && !sheet.resources.length) return null
  const many = sheet.spellcasting.length > 1
  return (
    <section className="card">
      <h2 className="card-title">{t('sheet.section.magic')}</h2>
      {sheet.spellcasting.map((sc) => {
        const who = many ? ` (${localName(lang, sc.classId, sheet.classes.find((c) => c.id === sc.classId)?.name ?? sc.classId)})` : ''
        return (
          <div key={sc.classId}>
            <StatLine label={t('sheet.cl') + who} stat={sc.casterLevel} signed={false} testId="sheet-cl" />
            <StatLine label={t('sheet.concentration')} stat={sc.concentration} testId="sheet-concentration" />
            <PlainLine label={t('sheet.asf')} value={`${sc.arcaneSpellFailure}%`} testId="sheet-asf" />
          </div>
        )
      })}
      {sheet.resources.map((r) => (
        <div key={r.id}>
          <StatLine label={localName(lang, r.id, r.name)} stat={r.max} signed={false} testId={`sheet-resource-${r.id}`} />
          {Object.entries(r.details).map(([k, v]) => (
            <p key={k} className="stat-parts" data-testid={`sheet-resource-${r.id}-${k}`}>
              {resourceDetailLabel(t, k)} {formatValue(v, true)}
            </p>
          ))}
        </div>
      ))}
    </section>
  )
}

function AttackCard({ attack }: { attack: AttackLine }) {
  const { t, lang } = useT()
  const named = (s: string) => localSource(lang, s)
  const meta = [prettyCrit(attack.critical), attack.damageType && damageTypeLabel(t, attack.damageType), attack.range && `${attack.range} ${t('sheet.ft')}`]
  const damageParts = attack.variants[0] ? statParts(t, attack.variants[0].damage, true, named) : ''

  return (
    <section className="card">
      <h2 className="card-title">
        {localName(lang, attack.id, attack.name)} <span className="card-title-meta">{meta.filter(Boolean).join(' · ')}</span>
      </h2>
      {attack.variants.map((v) => {
        const name = v.id === 'standard' ? t('sheet.attack.standard') : localName(lang, v.id, v.name)
        const testId = `sheet-attack-${attack.id}-${v.id}`
        const parts = statParts(t, v.attack, true, named)
        return (
          <div key={v.id} className="attack-row">
            <span>{name}</span>
            <span className="attack-bonus" data-testid={testId}>
              {v.fullAttack.map((b) => formatValue(b, true)).join('/')}
            </span>
            <span className="attack-damage" data-testid={`${testId}-damage`}>
              {v.damageText}
            </span>
            {parts && (
              <span className="stat-parts attack-parts">
                <span aria-hidden>= </span>
                <span data-testid={`${testId}-parts`}>{parts}</span>
              </span>
            )}
          </div>
        )
      })}
      {damageParts && (
        <p className="stat-parts">
          {t('sheet.damage')} <span aria-hidden>= </span>
          <span data-testid={`sheet-attack-${attack.id}-damage-parts`}>{damageParts}</span>
        </p>
      )}
    </section>
  )
}

// Habilidades (página 2). Por defecto solo las que tienen rangos; el botón muestra las demás.
export function SkillsCard({ sheet }: { sheet: ComputedSheet }) {
  const { t, lang } = useT()
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null) // un solo desglose abierto a la vez (no se guarda)
  // Orden alfabético por el nombre que se ve (cambia con el idioma)
  const byName = (a: SkillLine, b: SkillLine) => localName(lang, a.id, a.name).localeCompare(localName(lang, b.id, b.name), lang)
  const { available, spent } = sheet.skillRanks
  const visible = (showAll ? sheet.skills : sheet.skills.filter((s) => s.ranks > 0)).slice().sort(byName)

  return (
    <section className="card">
      <h2 className="card-title card-title-split">
        {t('sheet.skills')}
        <span>
          {t('sheet.ranks')} <span data-testid="sheet-skill-ranks">{spent}/{available}</span>
        </span>
      </h2>
      <ul className="skill-list">
        {visible.map((s) => (
          <SkillRow key={s.id} skill={s} open={openId === s.id} onToggle={() => setOpenId((id) => (id === s.id ? null : s.id))} />
        ))}
      </ul>
      <p className="muted skills-legend">{t('sheet.skills.legend')}</p>
      <button type="button" className="text-btn" onClick={() => setShowAll((v) => !v)} data-testid="sheet-skills-toggle">
        {showAll ? `${t('sheet.skills.showTrained')} ▴` : `${t('sheet.skills.showAll')} ${sheet.skills.length} ▾`}
      </button>
    </section>
  )
}

// Una fila usable se toca para abrir su desglose ("+4 INT · 1 rango · +3 de clase"); las que piden rangos y no tienen ("—"), no.
function SkillRow({ skill, open, onToggle }: { skill: SkillLine; open: boolean; onToggle: () => void }) {
  const { t, lang } = useT()
  const parts = skill.usable ? statParts(t, skill.stat, true, (s) => localSource(lang, s), SKILL_SEP) : ''
  const cells = (
    <>
      <span className="skill-mark" aria-hidden>
        {skill.classSkill ? '●' : ''}
      </span>
      <span className="skill-name">{localName(lang, skill.id, skill.name)}</span>
      <span className="skill-arrow muted" aria-hidden>
        {parts ? (open ? '▴' : '▾') : ''}
      </span>
      <span className="skill-total" data-testid={`sheet-skill-${skill.id}`}>
        {skill.usable ? formatValue(skill.stat.total, true) : '—'}
      </span>
      {open && parts && (
        <span className="stat-parts skill-parts" data-testid={`sheet-skill-${skill.id}-parts`}>
          {parts}
        </span>
      )}
    </>
  )
  return (
    <li>
      {parts ? (
        <button type="button" className="skill-row skill-btn" aria-expanded={open} onClick={onToggle} data-testid={`sheet-skill-${skill.id}-row`}>
          {cells}
        </button>
      ) : (
        <div className={`skill-row${skill.usable ? '' : ' is-unusable'}`}>{cells}</div>
      )}
    </li>
  )
}
