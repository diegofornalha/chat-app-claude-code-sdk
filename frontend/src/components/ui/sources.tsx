import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { BookOpen, ExternalLink, Database, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  description?: string;
  url?: string;
  type: 'document' | 'database' | 'web' | 'file';
  metadata?: {
    author?: string;
    date?: string;
    relevance?: number;
    excerpt?: string;
  };
}

interface SourcesProps {
  sources: Source[];
  title?: string;
  compact?: boolean;
  className?: string;
}

export function Sources({ 
  sources, 
  title = "Sources", 
  compact = false,
  className 
}: SourcesProps) {
  const [expanded, setExpanded] = useState(!compact);

  const getSourceIcon = (type: Source['type']) => {
    switch (type) {
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'web':
        return <ExternalLink className="w-4 h-4" />;
      case 'file':
        return <BookOpen className="w-4 h-4" />;
    }
  };

  if (sources.length === 0) return null;

  return (
    <div className={cn("bg-blue-50 rounded-lg border border-blue-200", className)}>
      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 flex items-center justify-between",
          compact && "cursor-pointer hover:bg-blue-100 transition-colors"
        )}
        onClick={compact ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">{title}</span>
          <span className="text-xs text-blue-600">
            ({sources.length})
          </span>
        </div>
        {compact && (
          expanded ? (
            <ChevronUp className="w-4 h-4 text-blue-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-blue-600" />
          )
        )}
      </div>

      {/* Sources List */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {sources.map((source, index) => (
            <div
              key={source.id}
              className="bg-white rounded-md p-3 border border-blue-100"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="mt-0.5 text-blue-600">
                  {getSourceIcon(source.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      [{index + 1}] {source.title}
                    </h4>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {source.description && (
                    <p className="text-xs text-gray-600 mt-1">
                      {source.description}
                    </p>
                  )}

                  {source.metadata && (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      {source.metadata.author && (
                        <span>By: {source.metadata.author}</span>
                      )}
                      {source.metadata.date && (
                        <span>{source.metadata.date}</span>
                      )}
                      {source.metadata.relevance && (
                        <span className="text-blue-600">
                          {Math.round(source.metadata.relevance * 100)}% relevant
                        </span>
                      )}
                    </div>
                  )}

                  {source.metadata?.excerpt && (
                    <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-xs text-gray-600 italic">
                      "{source.metadata.excerpt}"
                    </blockquote>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}