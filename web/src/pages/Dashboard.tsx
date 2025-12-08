import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Download, Trash2, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { api, PrintJob } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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

export default function Dashboard() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
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
    if (confirm(`Delete "${job.document_name || 'Untitled'}"?`)) {
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Print Jobs</h1>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
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
          <p>No print jobs yet</p>
          <p className="text-sm mt-2">Send a document to port 9100 to get started</p>
        </div>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
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
                {data?.jobs.map((job) => {
                  const StatusIcon = statusIcons[job.status]
                  return (
                    <TableRow key={job.id}>
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
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {job.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(job)}
                              disabled={downloadingJobId === job.id}
                              title="Download PDF"
                            >
                              {downloadingJobId === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(job)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

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
        </>
      )}
    </div>
  )
}
