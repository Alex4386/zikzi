import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, Trash2, Loader2 } from 'lucide-react'
import { api, PrintJob } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { JobsGrid } from '@/components/JobsGrid'
import { JobsTable, JobsTableJob } from '@/components/JobsTable'
import { JobsPagination } from '@/components/JobsPagination'
import { JobsEmptyState } from '@/components/JobsEmptyState'
import { ViewModeToggle } from '@/components/ViewModeToggle'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Dashboard() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs', page, statusFilter],
    queryFn: () => api.getJobs(page, 20, statusFilter === 'all' ? undefined : statusFilter),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const handleDelete = (job: PrintJob) => {
    if (confirm(t('jobs.deleteConfirm', { name: job.document_name || t('jobs.untitled') }))) {
      deleteMutation.mutate(job.id)
    }
  }

  const handleDownload = async (job: PrintJob) => {
    setDownloadingJobId(job.id)
    try {
      const filename = `${job.document_name || 'document'}.pdf`
      await api.downloadJob(job.id, 'pdf', filename)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloadingJobId(null)
    }
  }

  const renderJobActions = (job: JobsTableJob) => (
    <>
      {job.status === 'completed' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.preventDefault()
            handleDownload(job as PrintJob)
          }}
          disabled={downloadingJobId === job.id}
          title={t('jobs.actions.downloadPdf')}
        >
          {downloadingJobId === job.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <Button
        variant="destructive"
        size="icon"
        className="h-7 w-7"
        onClick={(e) => {
          e.preventDefault()
          handleDelete(job as PrintJob)
        }}
        disabled={deleteMutation.isPending}
        title={t('common.delete')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </>
  )

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">{t('jobs.title')}</h1>
        <div className="flex items-center gap-3">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('jobs.filter.byStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('jobs.status.all')}</SelectItem>
              <SelectItem value="received">{t('jobs.status.received')}</SelectItem>
              <SelectItem value="processing">{t('jobs.status.processing')}</SelectItem>
              <SelectItem value="completed">{t('jobs.status.completed')}</SelectItem>
              <SelectItem value="failed">{t('jobs.status.failed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading || error || !data?.jobs.length ? (
        <JobsEmptyState
          isLoading={isLoading}
          error={!!error}
          title={t('jobs.noJobs')}
          subtitle={t('jobs.noJobsHint')}
          showSetupLink={!isLoading && !error}
        />
      ) : viewMode === 'grid' ? (
        <JobsGrid
          jobs={data.jobs}
          renderActions={renderJobActions}
        />
      ) : (
        <JobsTable
          jobs={data.jobs}
          showSource
          renderActions={renderJobActions}
        />
      )}

      {data && (
        <JobsPagination
          page={page}
          pageSize={20}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </PageContainer>
  )
}
