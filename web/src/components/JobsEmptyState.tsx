import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FileText, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface JobsEmptyStateProps {
  isLoading?: boolean
  error?: boolean
  title?: string
  subtitle?: string
  showSetupLink?: boolean
}

export function JobsEmptyState({ isLoading, error, title, subtitle, showSetupLink }: JobsEmptyStateProps) {
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
      {showSetupLink && (
        <Button variant="outline" asChild className="mt-4">
          <Link to="/settings">
            {t('jobs.noJobsSetupLink')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      )}
    </div>
  )
}
