import { useTranslation } from 'react-i18next'
import { FileText, Loader2 } from 'lucide-react'

interface JobsEmptyStateProps {
  isLoading?: boolean
  error?: boolean
  title?: string
  subtitle?: string
}

export function JobsEmptyState({ isLoading, error, title, subtitle }: JobsEmptyStateProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        {t('jobs.failedToLoad')}
      </div>
    )
  }

  return (
    <div className="text-center py-12 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>{title || t('jobs.noJobsFound')}</p>
      {subtitle && <p className="text-sm mt-2">{subtitle}</p>}
    </div>
  )
}
