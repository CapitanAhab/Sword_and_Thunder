import { useState } from 'react'
import type { AttackLine, ComputedSheet, SkillLine } from '../../core/compute'
import { useT } from '../../i18n/useT'
import { damageTypeLabel, formatValue, prettyCrit, resourceDetailLabel, SKILL_SEP, statParts } from './labels'
import { localName, localSource } from '../../data/names'
import { SheetHeader } from './SheetHeader'
import { BigStat, Block, Conds, MiniPlain, MiniStat, OpenParts, type PanelStat } from './StatLine'

// Página 1, lo que se usa en la mesa, como un panel (una superficie con separadores, sin cajitas): cabecera y
// atributos · PG, CA e Inic en grande · salvaciones · armas · combate · magia. El desglose de un número aparece al
// tocarlo, debajo de su bloque; uno abierto a la vez (tocar otro lo cambia, tocar el mismo lo cierra).
export function PageOne({ sheet }: { sheet: ComputedSheet }) {
  const { t } = useT()
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id))
  const tap = { open, onToggle: toggle }
  const is = (i: PanelStat) => ({ item: i, open: open === i.testId, onToggle: toggle })
  const { ac, saves } = sheet

  const big: PanelStat[] = [
    { testId: 'sheet-hp', label: t('sheet.hp'), stat: sheet.hp, signed: false, icon: '♥', tone: 'blood' },
    { testId: 'sheet-ac', label: t('sheet.ac'), stat: ac.normal, signed: false, icon: '⛨', tone: 'plain' },
    { testId: 'sheet-init', label: t('sheet.init'), stat: sheet.initiative, icon: '⚡', tone: 'bolt' },
  ]
  const acMore: PanelStat[] = [
    { testId: 'sheet-ac-touch', label: t('sheet.touch'), stat: ac.touch, signed: false },
    { testId: 'sheet-ac-flat', label: t('sheet.flatFooted'), stat: ac.flatFooted, signed: false },
  ]
  const saveItems: PanelStat[] = [
    { testId: 'sheet-save-fort', label: t('play.save.fort'), stat: saves.fort },
    { testId: 'sheet-save-ref', label: t('play.save.ref'), stat: saves.ref },
    { testId: 'sheet-save-will', label: t('play.save.will'), stat: saves.will },
  ]
  const combat: PanelStat[] = [
    { testId: 'sheet-cmb', label: t('sheet.cmb'), stat: sheet.cmb },
    { testId: 'sheet-cmd', label: t('sheet.cmd'), stat: sheet.cmd, signed: false },
    { testId: 'sheet-speed', label: t('sheet.speed'), stat: sheet.speed, signed: false, suffix: t('sheet.ft') },
  ]
  const defense = [...big, ...acMore]

  return (
    <div className="panel">
      <SheetHeader sheet={sheet} {...tap} />
      <Block>
        <div className="big-stats">
          {big.map((i) => (
            <BigStat key={i.testId} {...is(i)} />
          ))}
        </div>
        <div className="mini-row mini-center">
          {acMore.map((i) => (
            <MiniStat key={i.testId} {...is(i)} />
          ))}
        </div>
        <OpenParts items={defense} open={open} />
        <Conds items={defense} />
      </Block>
      <Block>
        <div className="big-stats">
          {saveItems.map((i) => (
            <BigStat key={i.testId} {...is(i)} small />
          ))}
        </div>
        <OpenParts items={saveItems} open={open} />
        <Conds items={saveItems} />
      </Block>
      {sheet.attacks.map((a) => (
        <AttackBlock key={a.id} attack={a} {...tap} />
      ))}
      <Block title={t('sheet.section.combat')}>
        <div className="sheet-grid">
          <MiniPlain label={t('sheet.bab')} value={formatValue(sheet.bab, true)} testId="sheet-bab" />
          {combat.map((i) => (
            <MiniStat key={i.testId} {...is(i)} />
          ))}
        </div>
        <OpenParts items={combat} open={open} />
        <Conds items={combat} />
      </Block>
      <MagicBlock sheet={sheet} {...tap} />
    </div>
  )
}

// Magia: nivel de lanzador, concentración y fallo arcano de cada clase lanzadora, y los recursos de clase
// (la Reserva arcana con su mejora máxima).
function MagicBlock({ sheet, open, onToggle }: { sheet: ComputedSheet; open: string | null; onToggle: (id: string) => void }) {
  const { t } = useT()
  if (!sheet.spellcasting.length && !sheet.resources.length) return null
  const many = sheet.spellcasting.length > 1
  const is = (i: PanelStat) => ({ item: i, open: open === i.testId, onToggle })
  const casting = sheet.spellcasting.map((sc) => {
    const who = many ? ` (${localName(sc.classId, sheet.classes.find((c) => c.id === sc.classId)?.name ?? sc.classId)})` : ''
    const items: PanelStat[] = [
      { testId: 'sheet-cl', label: t('sheet.cl') + who, stat: sc.casterLevel, signed: false },
      { testId: 'sheet-concentration', label: t('sheet.concentration'), stat: sc.concentration },
    ]
    return { sc, items }
  })
  const resources: PanelStat[] = sheet.resources.map((r) => ({ testId: `sheet-resource-${r.id}`, label: localName(r.id, r.name), stat: r.max, signed: false }))
  const all = [...casting.flatMap((c) => c.items), ...resources]
  return (
    <Block title={t('sheet.section.magic')} arcane>
      <div className="sheet-grid">
        {casting.map(({ sc, items }) => [
          ...items.map((i) => <MiniStat key={i.testId} {...is(i)} />),
          <MiniPlain key={`${sc.classId}-asf`} label={t('sheet.asf')} value={`${sc.arcaneSpellFailure}%`} testId="sheet-asf" />,
        ])}
        {sheet.resources.map((r, idx) => {
          const item = resources[idx]
          return (
            item && [
              <MiniStat key={r.id} {...is(item)} />,
              ...Object.entries(r.details).map(([k, v]) => (
                <span key={`${r.id}-${k}`} className="tap-stat mini-stat">
                  <span className="stat-label">{resourceDetailLabel(t, k)}</span>{' '}
                  <b className="mini-value" data-testid={`sheet-resource-${r.id}-${k}`}>
                    {formatValue(v, true)}
                  </b>
                </span>
              )),
            ]
          )
        })}
      </div>
      <OpenParts items={all} open={open} />
      <Conds items={all} />
    </Block>
  )
}

// Un arma: el nombre con crítico · tipo · alcance, y una fila por variante (ataque y daño). Tocar una variante
// abre su desglose del ataque y el del daño.
function AttackBlock({ attack, open, onToggle }: { attack: AttackLine; open: string | null; onToggle: (id: string) => void }) {
  const { t } = useT()
  const named = (s: string) => localSource(s)
  const meta = [prettyCrit(attack.critical), attack.damageType && damageTypeLabel(t, attack.damageType), attack.range && `${attack.range} ${t('sheet.ft')}`]
  const damageParts = attack.variants[0] ? statParts(t, attack.variants[0].damage, true, named) : ''
  const nameOf = (id: string, fallback: string) => (id === 'standard' ? t('sheet.attack.standard') : localName(id, fallback))
  const openVariant = attack.variants.find((v) => open === `sheet-attack-${attack.id}-${v.id}`)
  const openParts = openVariant ? statParts(t, openVariant.attack, true, named) : ''

  return (
    <Block
      title={localName(attack.id, attack.name)}
      meta={meta.filter(Boolean).map((m) => (
        <span key={String(m)}>{m}</span>
      ))}
    >
      {attack.variants.map((v) => {
        const testId = `sheet-attack-${attack.id}-${v.id}`
        const tappable = Boolean(statParts(t, v.attack, true, named) || damageParts)
        const cells = (
          <>
            <span className="attack-name">{nameOf(v.id, v.name)}</span>
            <span className="attack-bonus" data-testid={testId}>
              {v.fullAttack.map((b) => formatValue(b, true)).join('/')}
            </span>
            <span className="attack-damage" data-testid={`${testId}-damage`}>
              {v.damageText}
            </span>
          </>
        )
        return tappable ? (
          <button key={v.id} type="button" className="attack-row tap-row" aria-expanded={open === testId} onClick={() => onToggle(testId)}>
            {cells}
          </button>
        ) : (
          <div key={v.id} className="attack-row">
            {cells}
          </div>
        )
      })}
      {openVariant && openParts && (
        <p className="stat-parts panel-parts">
          {nameOf(openVariant.id, openVariant.name)} <span aria-hidden>= </span>
          <span data-testid={`sheet-attack-${attack.id}-${openVariant.id}-parts`}>{openParts}</span>
        </p>
      )}
      {openVariant && damageParts && (
        <p className="stat-parts panel-parts">
          {t('sheet.damage')} <span aria-hidden>= </span>
          <span data-testid={`sheet-attack-${attack.id}-damage-parts`}>{damageParts}</span>
        </p>
      )}
    </Block>
  )
}

// Habilidades (página 2, dentro de su plegable). Por defecto solo las que tienen rangos; el botón muestra las demás.
export function SkillsCard({ sheet }: { sheet: ComputedSheet }) {
  const { t } = useT()
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null) // un solo desglose abierto a la vez (no se guarda)
  // Orden alfabético por el nombre que se ve (cambia con el idioma)
  const byName = (a: SkillLine, b: SkillLine) => localName(a.id, a.name).localeCompare(localName(b.id, b.name), 'es')
  const visible = (showAll ? sheet.skills : sheet.skills.filter((s) => s.ranks > 0)).slice().sort(byName)

  return (
    <>
      <ul className="skill-list">
        {visible.map((s) => (
          <SkillRow key={s.id} skill={s} open={openId === s.id} onToggle={() => setOpenId((id) => (id === s.id ? null : s.id))} />
        ))}
      </ul>
      <p className="muted skills-legend">{t('sheet.skills.legend')}</p>
      <button type="button" className="text-btn" onClick={() => setShowAll((v) => !v)} data-testid="sheet-skills-toggle">
        {showAll ? `${t('sheet.skills.showTrained')} ▴` : `${t('sheet.skills.showAll')} ${sheet.skills.length} ▾`}
      </button>
    </>
  )
}

// Una fila usable se toca para abrir su desglose ("+4 INT · 1 rango · +3 de clase"); las que piden rangos y no tienen ("—"), no.
function SkillRow({ skill, open, onToggle }: { skill: SkillLine; open: boolean; onToggle: () => void }) {
  const { t } = useT()
  const parts = skill.usable ? statParts(t, skill.stat, true, (s) => localSource(s), SKILL_SEP) : ''
  const cells = (
    <>
      <span className="skill-mark" aria-hidden>
        {skill.classSkill ? '●' : ''}
      </span>
      <span className="skill-name">{localName(skill.id, skill.name)}</span>
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
