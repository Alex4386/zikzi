import { cn } from '@/lib/utils';
import { TabsTrigger } from './ui/tabs';

interface IconTabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsTrigger> {
  icon: React.ElementType;
}

export default function IconTabsTrigger({
  children,
  className,
  icon: Icon,
  ...props
}: IconTabsTriggerProps) {
  return (
    <TabsTrigger
      className={cn('flex items-center gap-2', className)}
      {...props}
    >
      <Icon className="h-4 w-4" />
      {children}
    </TabsTrigger>
  );
}
