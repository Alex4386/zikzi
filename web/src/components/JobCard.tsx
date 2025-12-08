import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, UserPlus } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'
import { statusIcons, statusVariants, JobStatus } from '@/lib/job-utils'
import { JobThumbnail } from '@/components/JobThumbnail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface JobUser {
  id: string
  username: string
  display_name: string
}

export interface JobCardJob {
  id: string
  document_name?: string
  status: JobStatus
  file_size: number
  created_at: string
  user?: JobUser | null
}

interface JobCardProps {
  job: JobCardJob
  showUser?: boolean
  showOrphaned?: boolean
  onAssign?: (job: JobCardJob) => void
  renderActions?: (job: JobCardJob) => ReactNode
}

export function JobCard({ job, showUser = false, showOrphaned = false, onAssign, renderActions }: JobCardProps) {
  const { t } = useTranslation()
  const StatusIcon = statusIcons[job.status]

  return (
    <Card className="overflow-hidden group">
      <Link to={`/jobs/${job.id}`}>
        <JobThumbnail jobId={job.id} jobStatus={job.status} documentName={job.document_name} size="lg" />
      </Link>
      <CardContent className="p-3">
        <Link to={`/jobs/${job.id}`} className="hover:text-primary">
          <p className="font-medium text-sm truncate" title={job.document_name || t('jobs.untitled')}>
            {job.document_name || t('jobs.untitled')}
          </p>
        </Link>
        <div className="flex items-center justify-between mt-2">
          <Badge variant={statusVariants[job.status]} className="gap-1 text-xs">
            <StatusIcon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
            <span>{t(`jobs.status.${job.status}`)}</span>
          </Badge>
          <span className="text-xs text-muted-foreground">{formatBytes(job.file_size)}</span>
        </div>
        {showUser && (
          job.user ? (
            <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
              <User className="h-3 w-3" />
              {job.user.display_name}
            </p>
          ) : showOrphaned ? (
            <Badge variant="outline" className="text-yellow-600 text-xs mt-1">
              {t('jobs.orphaned')}
            </Badge>
          ) : null
        )}
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {formatDate(job.created_at)}
        </p>
        {onAssign && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              onAssign(job)
            }}
            className="w-full mt-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <UserPlus className="h-3 w-3" />
            {t('jobs.actions.assign')}
          </Button>
        )}
        {renderActions && (
          <div className="flex items-center justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {renderActions(job)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
