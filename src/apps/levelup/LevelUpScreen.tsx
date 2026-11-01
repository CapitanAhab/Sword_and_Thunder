import { useT } from '../../i18n/useT'

// Placeholder: el wizard de subida de nivel todavía no existe.
export function LevelUpScreen() {
  const { t } = useT()
  return (
    <section className="placeholder">
      <h1>{t('nav.levelUp')}</h1>
      <p>{t('common.comingSoon')}</p>
    </section>
  )
}
