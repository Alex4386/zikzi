import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { api, AdminJob, AdminUser } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { JobsGrid } from '@/components/JobsGrid'
import { JobsTable, JobsTableJob } from '@/components/JobsTable'
import { JobsPagination } from '@/components/JobsPagination'
import { JobsEmptyState } from '@/components/JobsEmptyState'
import { ViewModeToggle } from '@/components/ViewModeToggle'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function OrphanedJobs() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'orphaned', page],
    queryFn: () => api.getOrphanedJobs(page, 20),
  })

  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.getAdminUsers(),
  })

  const assignMutation = useMutation({
    mutationFn: ({ jobId, userId }: { jobId: string; userId: string }) =>
      api.assignJob(jobId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orphaned'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setAssignDialogOpen(false)
      setSelectedJob(null)
      setSelectedUserId('')
    },
  })

  const handleAssign = (job: JobsTableJob) => {
    setSelectedJob(job as AdminJob)
    setAssignDialogOpen(true)
  }

  const confirmAssign = () => {
    if (selectedJob && selectedUserId) {
      assignMutation.mutate({ jobId: selectedJob.id, userId: selectedUserId })
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('jobs.orphanedJobs')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('jobs.orphanedJobsDescription')}
          </p>
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {isLoading || error || !data?.jobs.length ? (
        <JobsEmptyState
          isLoading={isLoading}
          error={!!error}
          title={t('jobs.noOrphanedJobs')}
          subtitle={t('jobs.allJobsAssigned')}
        />
      ) : viewMode === 'grid' ? (
        <JobsGrid
          jobs={data.jobs}
          onAssign={handleAssign}
        />
      ) : (
        <JobsTable
          jobs={data.jobs}
          showSource
          onAssign={handleAssign}
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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('jobs.assign.title')}</DialogTitle>
            <DialogDescription>
              {t('jobs.assign.description', { name: selectedJob?.document_name || t('jobs.untitled') })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('jobs.assign.selectUser')} />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user: AdminUser) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.display_name} (@{user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={confirmAssign}
                disabled={!selectedUserId || assignMutation.isPending}
              >
                {assignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('jobs.assign.assignButton')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
