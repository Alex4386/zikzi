import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, CheckCircle, Clock, AlertCircle, Loader2, UserPlus, LayoutGrid, List } from 'lucide-react'
import { api, AdminJob, AdminUser } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'
import { PageContainer } from '@/components/PageContainer'
import { JobThumbnail } from '@/components/JobThumbnail'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

export default function OrphanedJobs() {
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

  const handleAssign = (job: AdminJob) => {
    setSelectedJob(job)
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
          <h1 className="text-2xl font-bold">Orphaned Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Jobs from unregistered IP addresses that need to be assigned to users
          </p>
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'grid' | 'table')}>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Failed to load orphaned jobs
        </div>
      ) : data?.jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No orphaned jobs</p>
          <p className="text-sm mt-2">All jobs are assigned to users</p>
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {job.source_ip}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDate(job.created_at)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        handleAssign(job)
                      }}
                      className="w-full mt-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <UserPlus className="h-3 w-3" />
                      Assign
                    </Button>
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
                  <TableHead>Source</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssign(job)}
                          className="gap-1"
                        >
                          <UserPlus className="h-4 w-4" />
                          Assign
                        </Button>
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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Job to User</DialogTitle>
            <DialogDescription>
              Assign "{selectedJob?.document_name || 'Untitled'}" to a user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
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
                Cancel
              </Button>
              <Button
                onClick={confirmAssign}
                disabled={!selectedUserId || assignMutation.isPending}
              >
                {assignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
