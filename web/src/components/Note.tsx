import * as React from 'react'
import { AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type NoteVariant = 'warning' | 'info' | 'error' | 'success'

interface NoteProps {
  variant?: NoteVariant
  title?: string
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<NoteVariant, { container: string; icon: string; title: string; body: string }> = {
  warning: {
    container: 'bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-200',
    body: 'text-amber-700 dark:text-amber-300',
  },
  info: {
    container: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-200',
    body: 'text-blue-700 dark:text-blue-300',
  },
  error: {
    container: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-800 dark:text-red-200',
    body: 'text-red-700 dark:text-red-300',
  },
  success: {
    container: 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    title: 'text-green-800 dark:text-green-200',
    body: 'text-green-700 dark:text-green-300',
  },
}

const variantIcons: Record<NoteVariant, React.ElementType> = {
  warning: AlertTriangle,
  info: Info,
  error: AlertCircle,
  success: CheckCircle,
}

export function Note({ variant = 'info', title, children, className }: NoteProps) {
  const styles = variantStyles[variant]
  const Icon = variantIcons[variant]

  return (
    <div className={cn('p-4 border rounded-lg flex items-start gap-3', styles.container, className)}>
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', styles.icon)} />
      <div className="flex-1 min-w-0">
        {title && <p className={cn('font-medium', styles.title)}>{title}</p>}
        <div className={cn('text-sm', title && 'mt-1', styles.body)}>{children}</div>
      </div>
    </div>
  )
}
