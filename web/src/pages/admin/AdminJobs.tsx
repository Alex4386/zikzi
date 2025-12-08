import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, CheckCircle, Clock, AlertCircle, Loader2, User, LayoutGrid, List } from 'lucide-react'
import { api, AdminJob } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'
import { PageContainer } from '@/components/PageContainer'
import { JobThumbnail } from '@/components/JobThumbnail'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'

const statusIcons = {
  received: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
}

const statusVariants = {
  received: 'warning' as const,
  processing: 'default' as const,
  completed: 'success' as const,
  failed: 'destructive' as const,
}

export default function AdminJobs() {
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
        <h1 className="text-2xl font-bold">All Jobs</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'grid' | 'table')}>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={userFilter}
            onValueChange={(value) => {
              setUserFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
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
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Failed to load jobs
        </div>
      ) : data?.jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No jobs found</p>
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {data?.jobs.map((job: AdminJob) => {
              const StatusIcon = statusIcons[job.status]
              return (
                <Card key={job.id} className="overflow-hidden group">
                  <Link to={`/jobs/${job.id}`}>
                    <JobThumbnail jobId={job.id} jobStatus={job.status} documentName={job.document_name} size="lg" />
                  </Link>
                  <CardContent className="p-3">
                    <Link to={`/jobs/${job.id}`} className="hover:text-primary">
                      <p className="font-medium text-sm truncate" title={job.document_name || 'Untitled'}>
                        {job.document_name || 'Untitled'}
                      </p>
                    </Link>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant={statusVariants[job.status]} className="gap-1 text-xs">
                        <StatusIcon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                        <span className="capitalize">{job.status}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatBytes(job.file_size)}</span>
                    </div>
                    {job.user ? (
                      <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {job.user.display_name}
                      </p>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 text-xs mt-1">
                        Orphaned
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {formatDate(job.created_at)}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.jobs.map((job: AdminJob) => {
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
                          <p className="font-medium">{job.document_name || 'Untitled'}</p>
                          {job.app_name && (
                            <p className="text-sm text-muted-foreground">{job.app_name}</p>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {job.user ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{job.user.display_name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600">
                            Orphaned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{job.source_ip}</p>
                        {job.hostname && (
                          <p className="text-sm text-muted-foreground">{job.hostname}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatBytes(job.file_size)}</TableCell>
                      <TableCell className="text-sm">{job.page_count || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[job.status]} className="gap-1">
                          <StatusIcon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                          <span className="capitalize">{job.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(job.created_at)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= data.total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
