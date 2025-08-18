import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { GitBranch, ChevronLeft, ChevronRight } from 'lucide-react';

interface BranchOption {
  id: string;
  content: string;
  agent?: string;
  timestamp?: string;
  selected?: boolean;
}

interface BranchProps {
  options: BranchOption[];
  onSelect?: (id: string) => void;
  className?: string;
}

export function Branch({ options, onSelect, className }: BranchProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
  };

  const handleSelect = (index: number) => {
    setCurrentIndex(index);
    if (onSelect && options[index]) {
      onSelect(options[index].id);
    }
  };

  if (options.length === 0) return null;

  const currentOption = options[currentIndex];

  return (
    <div className={cn("bg-gray-50 rounded-lg p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            Multiple Responses ({currentIndex + 1} of {options.length})
          </span>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevious}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            disabled={options.length <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {/* Dots indicator */}
          <div className="flex gap-1 mx-2">
            {options.map((_, index) => (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentIndex
                    ? "bg-blue-600 w-4"
                    : "bg-gray-300 hover:bg-gray-400"
                )}
              />
            ))}
          </div>
          
          <button
            onClick={handleNext}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            disabled={options.length <= 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-md p-3 border border-gray-200">
        {currentOption.agent && (
          <div className="text-xs text-gray-500 mb-2">
            Agent: {currentOption.agent}
          </div>
        )}
        <div className="text-sm text-gray-800 whitespace-pre-wrap">
          {currentOption.content}
        </div>
        {currentOption.timestamp && (
          <div className="text-xs text-gray-400 mt-2">
            {currentOption.timestamp}
          </div>
        )}
      </div>
    </div>
  );
}