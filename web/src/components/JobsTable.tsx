import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, UserPlus } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'
import { statusIcons, statusVariants, JobStatus } from '@/lib/job-utils'
import { JobThumbnail } from '@/components/JobThumbnail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface JobUser {
  id: string
  username: string
  display_name: string
}

export interface JobsTableJob {
  id: string
  document_name?: string
  app_name?: string
  status: JobStatus
  file_size: number
  page_count?: number
  source_ip?: string
  hostname?: string
  created_at: string
  user?: JobUser | null
}

interface JobsTableProps {
  jobs: JobsTableJob[]
  showUser?: boolean
  showOrphaned?: boolean
  showSource?: boolean
  onAssign?: (job: JobsTableJob) => void
  renderActions?: (job: JobsTableJob) => ReactNode
}

export function JobsTable({ jobs, showUser = false, showOrphaned = false, showSource = false, onAssign, renderActions }: JobsTableProps) {
  const { t } = useTranslation()
  const showActionsColumn = onAssign || renderActions

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]"></TableHead>
            <TableHead>{t('jobs.document')}</TableHead>
            {showUser && <TableHead>{t('jobs.user')}</TableHead>}
            {showSource && <TableHead>{t('jobs.source')}</TableHead>}
            <TableHead>{t('common.size')}</TableHead>
            <TableHead>{t('jobs.pages')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            {showActionsColumn && <TableHead className="text-right">{t('common.actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const StatusIcon = statusIcons[job.status]
            return (
              <TableRow key={job.id}>
                <TableCell>
                  <Link to={`/jobs/${job.id}`}>
                    <JobThumbnail jobId={job.id} jobStatus={job.status} documentName={job.document_name} size="sm" />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to={`/jobs/${job.id}`} className="hover:text-primary">
                    <p className="font-medium">{job.document_name || t('jobs.untitled')}</p>
                    {job.app_name && (
                      <p className="text-sm text-muted-foreground">{job.app_name}</p>
                    )}
                  </Link>
                </TableCell>
                {showUser && (
                  <TableCell>
                    {job.user ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{job.user.display_name}</span>
                      </div>
                    ) : showOrphaned ? (
                      <Badge variant="outline" className="text-yellow-600">
                        {t('jobs.orphaned')}
                      </Badge>
                    ) : null}
                  </TableCell>
                )}
                {showSource && (
                  <TableCell>
                    <p className="text-sm">{job.source_ip}</p>
                    {job.hostname && (
                      <p className="text-sm text-muted-foreground">{job.hostname}</p>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-sm">{formatBytes(job.file_size)}</TableCell>
                <TableCell className="text-sm">{job.page_count || '-'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariants[job.status]} className="gap-1">
                    <StatusIcon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                    <span>{t(`jobs.status.${job.status}`)}</span>
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(job.created_at)}
                </TableCell>
                {showActionsColumn && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onAssign && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAssign(job)}
                          className="gap-1"
                        >
                          <UserPlus className="h-4 w-4" />
                          {t('jobs.actions.assign')}
                        </Button>
                      )}
                      {renderActions && renderActions(job)}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
