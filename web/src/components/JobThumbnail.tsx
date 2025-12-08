import { useState, useEffect } from 'react'
import { FileText, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface JobThumbnailProps {
  jobId: string
  jobStatus: string
  documentName?: string
  size?: 'sm' | 'lg'
}

export function JobThumbnail({ jobId, jobStatus, documentName, size = 'sm' }: JobThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const { token } = useAuth()
  const sizeClasses = size === 'lg' ? 'w-full aspect-[3/4]' : 'w-12 h-16'

  useEffect(() => {
    if (jobStatus !== 'completed') {
      setLoading(false)
      return
    }

    let objectUrl: string | null = null

    const fetchThumbnail = async () => {
      try {
        const headers: Record<string, string> = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        const response = await fetch(`/api/v1/jobs/${jobId}/thumbnail`, { headers })
        if (!response.ok) {
          throw new Error('Failed to fetch thumbnail')
        }
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        setThumbnailUrl(objectUrl)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchThumbnail()

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [jobId, jobStatus, token])

  if (jobStatus !== 'completed' || error || loading) {
    return (
      <div className={`${sizeClasses} bg-muted rounded flex items-center justify-center flex-shrink-0`}>
        {jobStatus === 'processing' || loading ? (
          <Loader2 className={`${size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'} animate-spin text-muted-foreground`} />
        ) : jobStatus === 'failed' ? (
          <AlertCircle className={`${size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'} text-destructive`} />
        ) : (
          <FileText className={`${size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'} text-muted-foreground`} />
        )}
      </div>
    )
  }

  return (
    <img
      src={thumbnailUrl || ''}
      alt={documentName || 'Document thumbnail'}
      className={`${sizeClasses} object-cover rounded border bg-white flex-shrink-0`}
      onError={() => setError(true)}
    />
  )
}
