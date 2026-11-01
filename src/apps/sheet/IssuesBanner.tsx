import type { ComputedSheet, Issue } from '../../core/compute'
import { useT } from '../../i18n/useT'
import { issueLabel } from './labels'

// Solo aparece si el JSON tiene problemas. Para los de "de más" se agrega usado/disponible.
export function IssuesBanner({ sheet }: { sheet: ComputedSheet }) {
  const { t } = useT()
  if (!sheet.issues.length) return null

  const withCount = (issue: Issue): Issue => {
    if (issue.code === 'skill-ranks-overspent') return { ...issue, detail: `${sheet.skillRanks.spent}/${sheet.skillRanks.available}` }
    if (issue.code === 'feats-over-limit') return { ...issue, detail: `${sheet.featSlots.used}/${sheet.featSlots.available}` }
    return issue
  }

  return (
    <div className="issues-banner" role="alert" data-testid="sheet-issues">
      <strong>
        ⚠ {sheet.issues.length} {t(sheet.issues.length === 1 ? 'sheet.issues.one' : 'sheet.issues.many')}
      </strong>
      <ul>
        {sheet.issues.map((issue, i) => (
          <li key={i} data-testid={`sheet-issue-${issue.code}`}>
            {issueLabel(t, withCount(issue))}
          </li>
        ))}
      </ul>
    </div>
  )
}
