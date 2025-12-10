import { Tabs } from '@radix-ui/react-tabs';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function SmartTabs({
  children,
  defaultValue,
  ...props
}: Parameters<typeof Tabs>[0]) {
  const [activeTab, setActiveTab] = useState(defaultValue || 'overview');
  return (
    <Tabs
      {...props}
      defaultValue={activeTab}
      onValueChange={setActiveTab}
      className={cn('space-y-2', props.className)}
    >
      {children}
    </Tabs>
  );
}
