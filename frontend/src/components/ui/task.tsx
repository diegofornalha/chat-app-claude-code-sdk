import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, AlertCircle, XCircle } from '@/lib/icons';

interface TaskProps {
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  agent?: string;
  startTime?: string;
  endTime?: string;
  className?: string;
}

export function Task({
  title,
  description,
  status,
  progress,
  agent,
  startTime,
  endTime,
  className
}: TaskProps) {
  const statusConfig = {
    pending: {
      icon: Circle,
      color: 'text-gray-400',
      bgColor: 'bg-gray-50',
      label: 'Pending'
    },
    in_progress: {
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      label: 'In Progress'
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      label: 'Completed'
    },
    failed: {
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      label: 'Failed'
    },
    cancelled: {
      icon: AlertCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      label: 'Cancelled'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-all",
        config.bgColor,
        status === 'in_progress' && "border-blue-300 shadow-sm",
        status === 'completed' && "border-green-300",
        status === 'failed' && "border-red-300",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", config.color)} />
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{title}</h4>
            <span className={cn("text-xs font-medium px-2 py-1 rounded-full", config.bgColor, config.color)}>
              {config.label}
            </span>
          </div>

          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}

          {/* Progress Bar */}
          {status === 'in_progress' && progress !== undefined && (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {agent && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Agent:</span> {agent}
              </span>
            )}
            {startTime && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Started:</span> {startTime}
              </span>
            )}
            {endTime && status === 'completed' && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Completed:</span> {endTime}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}