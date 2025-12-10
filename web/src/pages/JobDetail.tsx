import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, Trash2, FileText, CheckCircle, Clock, AlertCircle, Loader2, ChevronDown, Image } from 'lucide-react'
import { api } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'
import { PageContainer } from '@/components/PageContainer'
import { Note } from '@/components/Note'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ActionCollections, ActionCollectionItem } from '@/components/ActionCollections'

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
  const [thumbnailOpen, setThumbnailOpen] = useState(false)


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
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 bg-muted rounded-lg shrink-0">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-2xl break-words">{job.document_name || t('jobDetail.untitled')}</CardTitle>
                <p className="text-muted-foreground truncate">{job.app_name || t('jobDetail.unknownApp')}</p>
              </div>
            </div>

            <Badge variant={status.variant} className="gap-1 bg-background border whitespace-nowrap self-start sm:self-auto">
              <StatusIcon className={`h-4 w-4 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
              <span className="capitalize">{t(`jobs.status.${job.status}`)}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {job.error && (
            <Note variant="error" title={t('common.error')}>
              {job.error}
            </Note>
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

          <div className="flex gap-3 pt-4 border-t justify-end">
            <ActionCollections
              actions={[
                ...(job.status === 'completed' ? [{
                  type: 'button',
                  label: t('jobDetail.downloadPdf'),
                  Icon: Download,
                  onClick: () => handleDownload('pdf'),
                  disabled: downloading !== null,
                  spinIcon: downloading === 'pdf',
                } as ActionCollectionItem] : []),
                ...((job.status === 'completed' || job.status === 'failed') ? [{
                  type: 'button',
                  label: t('jobDetail.downloadOriginal'),
                  Icon: Download,
                  onClick: () => handleDownload('original'),
                  disabled: downloading !== null,
                  spinIcon: downloading === 'original',
                } as ActionCollectionItem] : []),
                {
                  type: 'button',
                  label: t('common.delete'),
                  Icon: Trash2,
                  variant: 'destructive',
                  onClick: handleDelete,
                  disabled: deleteMutation.isPending,
                  isLoading: deleteMutation.isPending,
                } as ActionCollectionItem
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {job.status === 'completed' && (
        <Collapsible open={thumbnailOpen} onOpenChange={setThumbnailOpen} className="mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                {t('jobDetail.preview')}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${thumbnailOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <Card>
              <CardContent className="p-4">
                <img
                  src={api.getJobDownloadUrl(job.id, 'thumbnail')}
                  alt={t('jobDetail.thumbnailAlt')}
                  className="max-w-full h-auto mx-auto rounded shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </PageContainer>
  )
}
