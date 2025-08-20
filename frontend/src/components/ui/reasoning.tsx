import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Brain, ChevronDown, ChevronUp, Activity } from 'lucide-react';

interface ReasoningStep {
  id: string;
  type: 'thinking' | 'analysis' | 'decision' | 'action';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

interface ReasoningProps {
  steps: ReasoningStep[];
  title?: string;
  expanded?: boolean;
  className?: string;
}

export function Reasoning({ 
  steps, 
  title = "Agent Reasoning", 
  expanded: initialExpanded = false,
  className 
}: ReasoningProps) {
  const [expanded, setExpanded] = useState(initialExpanded);

  const getStepIcon = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'thinking':
        return <Brain className="w-4 h-4 text-blue-600" />;
      case 'analysis':
        return <Activity className="w-4 h-4 text-purple-600" />;
      case 'decision':
        return <div className="w-4 h-4 rounded-full bg-green-600" />;
      case 'action':
        return <div className="w-4 h-4 rounded-full bg-orange-600" />;
    }
  };

  const getStepLabel = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'thinking':
        return 'Thinking';
      case 'analysis':
        return 'Analyzing';
      case 'decision':
        return 'Decision';
      case 'action':
        return 'Action';
    }
  };

  return (
    <div className={cn("bg-gray-50 rounded-lg border border-gray-200", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-gray-500">
            ({steps.length} steps)
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-300" />
            
            {/* Steps */}
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex gap-3 relative">
                  {/* Step indicator */}
                  <div className="relative z-10 bg-white p-1 rounded-full">
                    {getStepIcon(step.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">
                        {getStepLabel(step.type)}
                      </span>
                      {step.timestamp && (
                        <span className="text-xs text-gray-400">
                          {step.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800">
                      {step.content}
                    </p>
                    {step.metadata && (
                      <div className="mt-2 text-xs text-gray-500">
                        {Object.entries(step.metadata).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}