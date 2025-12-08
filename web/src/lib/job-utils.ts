import { Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export const statusIcons = {
  received: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
} as const

export const statusVariants = {
  received: 'warning' as const,
  processing: 'default' as const,
  completed: 'success' as const,
  failed: 'destructive' as const,
}

export type JobStatus = keyof typeof statusIcons
