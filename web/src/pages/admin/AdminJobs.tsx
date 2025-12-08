import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { JobsGrid } from '@/components/JobsGrid'
import { JobsTable } from '@/components/JobsTable'
import { JobsPagination } from '@/components/JobsPagination'
import { JobsEmptyState } from '@/components/JobsEmptyState'
import { ViewModeToggle } from '@/components/ViewModeToggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AdminJobs() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.getAdminUsers(),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'jobs', page, statusFilter, userFilter],
    queryFn: () => api.getAdminJobs(
      page,
      20,
      statusFilter === 'all' ? undefined : statusFilter,
      userFilter === 'all' ? undefined : userFilter
    ),
  })

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t('jobs.allJobs')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Select
            value={userFilter}
            onValueChange={(value) => {
              setUserFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('jobs.filter.byUser')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('jobs.filter.allUsers')}</SelectItem>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.display_name} (@{user.username})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[150px]">
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
        <JobsEmptyState isLoading={isLoading} error={!!error} />
      ) : viewMode === 'grid' ? (
        <JobsGrid
          jobs={data.jobs}
          showUser
          showOrphaned
        />
      ) : (
        <JobsTable
          jobs={data.jobs}
          showUser
          showOrphaned
          showSource
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
