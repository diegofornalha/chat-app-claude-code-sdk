import React from 'react';
import { cn } from '@/lib/utils';
import { Zap, CheckCircle, AlertCircle, Clock } from '@/lib/icons';

interface ToolProps {
  name: string;
  description?: string;
  status?: 'idle' | 'active' | 'success' | 'error' | 'loading';
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Tool({
  name,
  description,
  status = 'idle',
  icon,
  onClick,
  disabled,
  className
}: ToolProps) {
  const statusConfig = {
    idle: {
      borderColor: 'border-gray-300',
      bgColor: 'bg-white hover:bg-gray-50',
      statusIcon: null,
      statusColor: ''
    },
    active: {
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-50',
      statusIcon: <Zap className="w-3 h-3" />,
      statusColor: 'text-blue-600'
    },
    success: {
      borderColor: 'border-green-500',
      bgColor: 'bg-green-50',
      statusIcon: <CheckCircle className="w-3 h-3" />,
      statusColor: 'text-green-600'
    },
    error: {
      borderColor: 'border-red-500',
      bgColor: 'bg-red-50',
      statusIcon: <AlertCircle className="w-3 h-3" />,
      statusColor: 'text-red-600'
    },
    loading: {
      borderColor: 'border-gray-400',
      bgColor: 'bg-gray-50',
      statusIcon: <Clock className="w-3 h-3 animate-spin" />,
      statusColor: 'text-gray-600'
    }
  };

  const config = statusConfig[status];

  return (
    <button
      onClick={onClick}
      disabled={disabled || status === 'loading'}
      className={cn(
        "p-3 rounded-lg border-2 transition-all",
        "flex items-center gap-3",
        config.borderColor,
        config.bgColor,
        !disabled && onClick && "cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <div className="flex-shrink-0">
          {icon}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{name}</span>
          {config.statusIcon && (
            <span className={config.statusColor}>
              {config.statusIcon}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        )}
      </div>
    </button>
  );
}