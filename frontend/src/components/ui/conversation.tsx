import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ConversationProps {
  children: React.ReactNode;
  className?: string;
  autoScroll?: boolean;
}

export function Conversation({ 
  children, 
  className,
  autoScroll = true 
}: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [children, autoScroll]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex flex-col flex-1 overflow-y-auto",
        "divide-y divide-gray-200/50",
        className
      )}
    >
      {children}
    </div>
  );
}