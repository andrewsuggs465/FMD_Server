import { useState } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { ActionItem } from '@/components/ActionItem';

interface GroupActionItem {
  icon: LucideIcon;
  title: string;
  description: string | null;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

interface ActionGroupProps {
  title: string;
  description?: string | null;
  icon: LucideIcon;
  actions: GroupActionItem[];
  disabled?: boolean;
}

export const ActionGroup = ({
  title,
  description,
  icon: Icon,
  actions,
  disabled,
}: ActionGroupProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-gray-200 dark:border-gray-700">
      <Button
        variant="ghost"
        onClick={() => setOpen((prev) => !prev)}
        className="h-auto w-full justify-start gap-3 rounded-none border-gray-200 p-4 last:border-b-0 bg-gray-200 dark:bg-white/4 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/8"
      >
        <div className={cn('rounded-lg p-2', 'bg-gray-100 dark:bg-gray-800')}>
          <Icon className={cn('h-5 w-5', 'text-gray-700 dark:text-gray-300')} />
        </div>

        <div className="flex-1 text-left">
          <div className={cn('font-medium', 'text-gray-900 dark:text-white')}>{title}</div>
          {description && (
            <div className="pt-1 text-sm whitespace-normal text-gray-600 dark:text-gray-400">
              {description}
            </div>
          )}
        </div>

        {open ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </Button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          open ? 'max-h-[1000px]' : 'max-h-0'
        )}
      >
        <div className="border-t border-gray-200 dark:border-gray-700">
          {actions.map((action) => (
            <ActionItem
              icon={action.icon}
              title={action.title}
              description={action.description}
              onClick={action.onClick}
              disabled={disabled}
              variant={action.variant}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
