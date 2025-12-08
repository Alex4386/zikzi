import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface JobsPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function JobsPagination({ page, pageSize, total, onPageChange }: JobsPaginationProps) {
  const { t } = useTranslation()

  if (total <= pageSize) return null

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        {t('jobs.pagination.showing', {
          from: (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, total),
          total,
        })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          {t('common.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page * pageSize >= total}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}
