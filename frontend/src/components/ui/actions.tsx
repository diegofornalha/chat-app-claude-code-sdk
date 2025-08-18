import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Copy, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown,
  Share2,
  Bookmark,
  Edit,
  Trash2
} from 'lucide-react';

interface ActionButton {
  id: string;
  icon: 'copy' | 'regenerate' | 'thumbsUp' | 'thumbsDown' | 'share' | 'bookmark' | 'edit' | 'delete';
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

interface ActionsProps {
  actions: ActionButton[];
  variant?: 'default' | 'compact' | 'floating';
  className?: string;
}

export function Actions({ 
  actions, 
  variant = 'default',
  className 
}: ActionsProps) {
  const getIcon = (iconType: ActionButton['icon']) => {
    const iconClass = variant === 'compact' ? "w-3.5 h-3.5" : "w-4 h-4";
    
    switch (iconType) {
      case 'copy':
        return <Copy className={iconClass} />;
      case 'regenerate':
        return <RefreshCw className={iconClass} />;
      case 'thumbsUp':
        return <ThumbsUp className={iconClass} />;
      case 'thumbsDown':
        return <ThumbsDown className={iconClass} />;
      case 'share':
        return <Share2 className={iconClass} />;
      case 'bookmark':
        return <Bookmark className={iconClass} />;
      case 'edit':
        return <Edit className={iconClass} />;
      case 'delete':
        return <Trash2 className={iconClass} />;
    }
  };

  const getButtonClass = (action: ActionButton) => {
    const baseClass = variant === 'compact' 
      ? "p-1 rounded"
      : variant === 'floating'
      ? "p-2 rounded-full shadow-md"
      : "p-1.5 rounded-md";

    return cn(
      baseClass,
      "transition-all",
      action.active 
        ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
        : "hover:bg-gray-100 text-gray-600 hover:text-gray-900",
      action.disabled && "opacity-50 cursor-not-allowed"
    );
  };

  if (variant === 'floating') {
    return (
      <div className={cn(
        "fixed bottom-4 right-4 flex flex-col gap-2",
        className
      )}>
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              getButtonClass(action),
              "bg-white hover:bg-gray-50 border border-gray-200"
            )}
            title={action.label}
          >
            {getIcon(action.icon)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-1",
      variant === 'compact' && "gap-0.5",
      className
    )}>
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          disabled={action.disabled}
          className={getButtonClass(action)}
          title={action.label}
        >
          <span className="flex items-center gap-1.5">
            {getIcon(action.icon)}
            {action.label && variant === 'default' && (
              <span className="text-xs">{action.label}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}