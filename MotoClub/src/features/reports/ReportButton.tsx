import { Link } from 'react-router'
import { useLocale } from '../../shared/i18n'
import { reportText } from './copy'
import type { ReportTargetType } from './types'

export default function ReportButton({ targetType, targetId }: { targetType: ReportTargetType; targetId: string }) {
  useLocale()
  return <Link className="button button-quiet" to={`/reports?${new URLSearchParams({ targetType, targetId })}`}>{reportText('Пожаловаться')}</Link>
}
