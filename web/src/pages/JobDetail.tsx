import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, Trash2, FileText, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const statusConfig = {
  received: { icon: Clock, variant: 'warning' as const },
  processing: { icon: Loader2, variant: 'default' as const },
  completed: { icon: CheckCircle, variant: 'success' as const },
  failed: { icon: AlertCircle, variant: 'destructive' as const },
}

export default function JobDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [downloading, setDownloading] = useState<'pdf' | 'original' | null>(null)

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.getJob(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteJob(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      navigate('/')
    },
  })

  const handleDelete = () => {
    if (confirm(t('jobDetail.deleteConfirm'))) {
      deleteMutation.mutate()
    }
  }

  const handleDownload = async (type: 'pdf' | 'original') => {
    if (!job) return
    setDownloading(type)
    try {
      const filename = type === 'pdf'
        ? `${job.document_name || 'document'}.pdf`
        : job.document_name || 'document'
      await api.downloadJob(job.id, type, filename)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          {t('common.back')}
        </Button>
        <div className="text-center py-12 text-destructive">
          {t('jobDetail.notFound')}
        </div>
      </div>
    )
  }

  const status = statusConfig[job.status]
  const StatusIcon = status.icon

  return (
    <PageContainer className="max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="mb-6"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        {t('jobDetail.backToJobs')}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{job.document_name || t('jobDetail.untitled')}</CardTitle>
                <p className="text-muted-foreground">{job.app_name || t('jobDetail.unknownApp')}</p>
              </div>
            </div>

            <Badge variant={status.variant} className="gap-1">
              <StatusIcon className={`h-4 w-4 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
              <span className="capitalize">{t(`jobs.status.${job.status}`)}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {job.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{job.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('jobDetail.sourceIp')}</h3>
              <p>{job.source_ip}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('jobDetail.hostname')}</h3>
              <p>{job.hostname || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('jobDetail.fileSize')}</h3>
              <p>{formatBytes(job.file_size)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('jobDetail.pages')}</h3>
              <p>{job.page_count || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('jobDetail.received')}</h3>
              <p>{formatDate(job.created_at)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('jobDetail.processed')}</h3>
              <p>{job.processed_at ? formatDate(job.processed_at) : '-'}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            {job.status === 'completed' && (
              <Button onClick={() => handleDownload('pdf')} disabled={downloading !== null}>
                {downloading === 'pdf' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t('jobDetail.downloadPdf')}
              </Button>
            )}
            {(job.status === 'completed' || job.status === 'failed') && (
              <Button variant="secondary" onClick={() => handleDownload('original')} disabled={downloading !== null}>
                {downloading === 'original' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t('jobDetail.downloadOriginal')}
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('common.delete')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
