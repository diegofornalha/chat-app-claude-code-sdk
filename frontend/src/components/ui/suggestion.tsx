import React from 'react';
import { cn } from '@/lib/utils';
import { Lightbulb, Sparkles, ArrowRight } from 'lucide-react';

interface SuggestionItem {
  id: string;
  text: string;
  icon?: 'lightbulb' | 'sparkles' | 'arrow';
  category?: string;
}

interface SuggestionProps {
  suggestions: SuggestionItem[] | string[];
  onSelect: (suggestion: string) => void;
  title?: string;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

export function Suggestion({ 
  suggestions, 
  onSelect,
  title = "Suggested prompts",
  variant = 'default',
  className 
}: SuggestionProps) {
  // Normalize suggestions to SuggestionItem format
  const normalizedSuggestions: SuggestionItem[] = suggestions.map((s, index) => 
    typeof s === 'string' 
      ? { id: `suggestion-${index}`, text: s, icon: 'sparkles' }
      : s
  );

  const getIcon = (iconType?: SuggestionItem['icon']) => {
    switch (iconType) {
      case 'lightbulb':
        return <Lightbulb className="w-4 h-4" />;
      case 'arrow':
        return <ArrowRight className="w-4 h-4" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  if (normalizedSuggestions.length === 0) return null;

  // Inline variant - horizontal pills
  if (variant === 'inline') {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {normalizedSuggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.text)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            {getIcon(suggestion.icon)}
            <span>{suggestion.text}</span>
          </button>
        ))}
      </div>
    );
  }

  // Compact variant - simple list
  if (variant === 'compact') {
    return (
      <div className={cn("space-y-1", className)}>
        {normalizedSuggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.text)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
          >
            <span className="text-gray-400">{getIcon(suggestion.icon)}</span>
            <span className="flex-1">{suggestion.text}</span>
          </button>
        ))}
      </div>
    );
  }

  // Default variant - cards
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Sparkles className="w-4 h-4" />
          <span>{title}</span>
        </div>
      )}
      
      <div className="grid gap-2">
        {normalizedSuggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.text)}
            className="group relative p-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100 rounded-lg border border-gray-200 hover:border-blue-300 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="text-gray-500 group-hover:text-blue-600 transition-colors">
                {getIcon(suggestion.icon)}
              </div>
              <div className="flex-1">
                {suggestion.category && (
                  <div className="text-xs text-gray-500 mb-1">
                    {suggestion.category}
                  </div>
                )}
                <p className="text-sm text-gray-800 group-hover:text-gray-900">
                  {suggestion.text}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}