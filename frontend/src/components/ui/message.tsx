import React from 'react';
import { cn } from '@/lib/utils';
import { User2, Bot, Copy, RotateCw, Check } from '@/lib/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  className?: string;
}

export function Message({
  role,
  content,
  timestamp,
  isStreaming,
  onCopy,
  onRegenerate,
  className
}: MessageProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-6 hover:bg-gray-50/50 transition-colors",
        role === 'user' && "bg-white",
        role === 'assistant' && "bg-gray-50/30",
        className
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            role === 'user' && "bg-gray-900 text-white",
            role === 'assistant' && "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
          )}
        >
          {role === 'user' ? (
            <User2 className="w-5 h-5" />
          ) : (
            <Bot className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {role === 'user' ? 'You' : 'Assistant'}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-500">{timestamp}</span>
          )}
          {isStreaming && (
            <span className="text-xs text-blue-600">● Typing...</span>
          )}
        </div>

        <div className="prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Actions */}
        {role === 'assistant' && !isStreaming && (
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-600" />
              )}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Regenerate response"
              >
                <RotateCw className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}