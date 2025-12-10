import { cn } from '@/lib/utils';
import React, { useRef, useEffect, useState } from 'react';
import { Loader2, MoreVertical } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ActionCollectionItem =
  | ActionCollectionSeparator
  | ActionCollectionLink
  | ActionCollectionButton
  | ActionCollectionMenu;

interface ActionCollectionSeparator {
  type: 'separator';
}

interface ActionCollectionMenu extends ActionCommon {
  type: 'menu';
  submenu: ActionCollectionItem[];
}

interface ActionCommon {
  Icon?: React.ElementType;
  disabled?: boolean;
  label: string;
  className?: string;
  variant?: Parameters<typeof Button>['0']['variant'];
  size?: Parameters<typeof Button>['0']['size'];
  spinIcon?: boolean;
  isLoading?: boolean;
  hideLabel?: boolean;
}

interface ActionCollectionLink extends ActionCommon {
  type: 'link';
  href: string;
  disabled?: boolean;
}

interface ActionCollectionButton extends ActionCommon {
  type: 'button';
  onClick: () => void;
}

export interface ActionCollectionsProps {
  actions: ActionCollectionItem[];
  className?: string;
  forceDropdown?: boolean;
  dropdownIcon?: React.ElementType;
  dropdownButtonProps?: Parameters<typeof Button>[0];
}

export function ActionCollections({
  actions,
  className,
  forceDropdown,
  dropdownIcon: DropdownIcon = MoreVertical,
  dropdownButtonProps,
}: ActionCollectionsProps) {
  const [overflowDetected, setOverflowDetected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxChildrenWidth = useRef(0);

  const overflowDetector = () => {
    if (containerRef.current) {
      const container = containerRef.current;
      const containerWidth = container.getBoundingClientRect().width;

      if (
        container.clientWidth > maxChildrenWidth.current ||
        maxChildrenWidth.current === 0
      ) {
        const children = Array.from(container.children) as HTMLElement[];
        const gap = 4;

        const totalChildrenWidth = children.reduce((acc, child) => {
          const rect = child.getBoundingClientRect();
          return acc + rect.width + gap;
        }, 0);

        if (totalChildrenWidth > maxChildrenWidth.current) {
          maxChildrenWidth.current = totalChildrenWidth;
        }
      }

      const hasOverflowed = containerWidth < maxChildrenWidth.current;
      setOverflowDetected(() => hasOverflowed);
    }
  };

  useEffect(() => {
    window.addEventListener('resize', overflowDetector);

    if (containerRef.current) {
      overflowDetector();
    }
    return () => {
      window.removeEventListener('resize', overflowDetector);
    };
  }, [actions]);

  const getIconClassName = (action: ActionCollectionItem) => {
    if (action.type === 'separator') {
      return '';
    }

    const iconClassName = cn(
      'h-4 w-4',
      action.spinIcon || action.isLoading ? 'animate-spin' : ''
    );
    return iconClassName;
  };

  const renderActionItem = (
    action: ActionCollectionItem,
    inDropdown = false
  ) => {
    if (action.type === 'separator') {
      return inDropdown ? (
        <DropdownMenuSeparator />
      ) : (
        <Separator orientation="vertical" />
      );
    }

    if (inDropdown) {
      const iconClassName = getIconClassName(action);
      if (action.Icon) {
        if (action.isLoading) {
          action.Icon = Loader2;
          action.spinIcon = true;
          action.disabled = true;
        }
      }

      const itemContent = (
        <>
          {action.Icon && <action.Icon className={iconClassName} />}
          {action.label}
        </>
      );

      if (action.type === 'link') {
        return (
          <Link to={action.href} className="w-full">
            <DropdownMenuItem disabled={action.disabled}>
              {itemContent}
            </DropdownMenuItem>
          </Link>
        );
      } else if (action.type === 'menu') {
        // This is now a dropdownMenuSub
        return (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              data-variant={
                action.variant === 'destructive' ? 'destructive' : 'outline'
              }
              className="flex gap-2 items-center data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10"
            >
              {itemContent}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {action.submenu.map((subAction) =>
                  renderActionItem(subAction, true)
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        );
      }

      <DropdownMenuItem
        onClick={action.type === 'button' ? action.onClick : undefined}
        disabled={action.disabled}
        className={cn(
          "flex gap-2 items-center",
          action.variant === 'destructive' && "text-destructive focus:text-destructive focus:bg-destructive/10"
        )}
      >
        {itemContent}
      </DropdownMenuItem>
    }

    const renderButton = (showLabel = true) => {
      const iconClassName = getIconClassName(action);

      const buttonContent = (
        <>
          {action.Icon && <action.Icon className={iconClassName} />}
          {showLabel && action.label}
        </>
      );
      const commonClassName = cn(action.className, 'flex gap-4 items-center');

      const button =
        action.type === 'link' ? (
          action.href.startsWith('http') ? (
            <a href={action.href}>
              <Button
                className={commonClassName}
                disabled={action.disabled}
                variant={action.variant ?? 'outline'}
                size={showLabel ? 'default' : 'icon'}
              >
                {buttonContent}
              </Button>
            </a>
          ) : (
            <Link to={action.href}>
              <Button
                className={commonClassName}
                disabled={action.disabled}
                variant={action.variant ?? 'outline'}
                size={showLabel ? 'default' : 'icon'}
              >
                {buttonContent}
              </Button>
            </Link>
          )
        ) : action.type === 'button' ? (
          <Button
            className={commonClassName}
            onClick={action.onClick}
            disabled={action.disabled}
            variant={action.variant ?? 'outline'}
            size={showLabel ? 'default' : 'icon'}
          >
            {buttonContent}
          </Button>
        ) : action.type === 'menu' ? (
          <ActionCollections
            actions={action.submenu}
            className={action.className}
            forceDropdown
            dropdownIcon={action.Icon ?? MoreVertical}
            dropdownButtonProps={{
              variant: action.variant ?? 'outline',
              size: showLabel ? 'default' : 'icon',
            }}
          />
        ) : null;

      if (!showLabel && action.Icon) {
        return (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>{action.label}</TooltipContent>
          </Tooltip>
        );
      }

      return button;
    };

    if (overflowDetected || action.hideLabel) {
      return renderButton(false);
    }

    return renderButton(true);
  };

  const isFirstSeparator = (action: ActionCollectionItem, i: number) =>
    i === 0 && action.type === 'separator';

  if (overflowDetected || forceDropdown) {
    return (
      <div
        className={cn('flex gap-2 overflow-hidden justify-end', className)}
        ref={containerRef}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" {...dropdownButtonProps}>
              <DropdownIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((action, index) =>
              isFirstSeparator(action, index) ? null : (
                <React.Fragment key={index}>
                  {renderActionItem(action, true)}
                </React.Fragment>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div
      className={cn('flex gap-2 overflow-hidden justify-end', className)}
      ref={containerRef}
    >
      {actions.map((action, index) => (
        <React.Fragment key={index}>{renderActionItem(action)}</React.Fragment>
      ))}
    </div>
  );
}
