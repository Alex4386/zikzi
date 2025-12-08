import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('p-6 max-w-screen-2xl mx-auto', className)}>
      {children}
    </div>
  )
}
