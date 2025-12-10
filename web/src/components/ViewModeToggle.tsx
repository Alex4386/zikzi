import { useTranslation } from 'react-i18next'
import { LayoutGrid, List } from 'lucide-react'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'

interface ViewModeToggleProps {
  value: 'grid' | 'table'
  onChange: (value: 'grid' | 'table') => void
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  const { t } = useTranslation()

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as 'grid' | 'table')}
      className="shrink-0"
    >
      <ToggleGroupItem value="grid" aria-label={t('view.grid')}>
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="table" aria-label={t('view.table')}>
        <List className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
