import React from 'react';
import { Brain, Database, Link, Sparkles } from 'lucide-react';

interface Memory {
  id: string;
  type: string;
  summary: string;
}

interface ContextIndicatorProps {
  hasContext: boolean;
  contextUsed: number;
  memories?: Memory[];
  agent?: string;
}

const ContextIndicator: React.FC<ContextIndicatorProps> = ({
  hasContext,
  contextUsed,
  memories = [],
  agent
}) => {
  if (!hasContext && contextUsed === 0) {
    return null;
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1">
          <Brain className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-900">
            Contexto Enriquecido
          </span>
        </div>
        {contextUsed > 0 && (
          <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full">
            {contextUsed} memórias
          </span>
        )}
      </div>

      {memories.length > 0 && (
        <div className="space-y-1 mt-2">
          <div className="text-xs text-gray-600 font-medium mb-1">
            Conhecimento utilizado:
          </div>
          {memories.map((memory, idx) => (
            <div
              key={memory.id || idx}
              className="flex items-start gap-2 text-xs p-2 bg-white bg-opacity-60 rounded"
            >
              <Database className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-medium text-gray-700">
                  [{memory.type}]
                </span>{' '}
                <span className="text-gray-600">
                  {memory.summary}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Link className="w-3 h-3" />
          <span>Neo4j Memory</span>
        </div>
        {agent && (
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>via {agent}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextIndicator;