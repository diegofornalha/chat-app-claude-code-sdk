import React from 'react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  variant?: 'dots' | 'spinner' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Loader({ 
  variant = 'dots', 
  size = 'md',
  className 
}: LoaderProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  if (variant === 'spinner') {
    return (
      <div className={cn("relative", sizeClasses[size], className)}>
        <div className="absolute inset-0 border-2 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-2 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn("flex space-x-1", className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "bg-blue-600 rounded-full animate-pulse",
              size === 'sm' && "w-1.5 h-1.5",
              size === 'md' && "w-2 h-2",
              size === 'lg' && "w-3 h-3"
            )}
            style={{
              animationDelay: `${i * 150}ms`
            }}
          />
        ))}
      </div>
    );
  }

  // Default: dots
  return (
    <div className={cn("flex space-x-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-gray-600 rounded-full animate-bounce",
            size === 'sm' && "w-1.5 h-1.5",
            size === 'md' && "w-2 h-2",
            size === 'lg' && "w-3 h-3"
          )}
          style={{
            animationDelay: `${i * 100}ms`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  );
}