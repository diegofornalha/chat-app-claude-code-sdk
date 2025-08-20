import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Copy, 
  Check, 
  Terminal,
  Code2,
  Expand,
  Minimize2
} from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  maxHeight?: string;
  collapsible?: boolean;
  runnable?: boolean;
  onRun?: () => void;
  className?: string;
}

export function CodeBlock({ 
  code,
  language = 'typescript',
  title,
  showLineNumbers = true,
  highlightLines = [],
  maxHeight = '400px',
  collapsible = false,
  runnable = false,
  onRun,
  className 
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguageIcon = () => {
    if (language === 'terminal' || language === 'bash' || language === 'shell') {
      return <Terminal className="w-4 h-4" />;
    }
    return <Code2 className="w-4 h-4" />;
  };

  const lineProps = (lineNumber: number) => {
    const style: React.CSSProperties = {};
    if (highlightLines.includes(lineNumber)) {
      style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
      style.borderLeft = '3px solid #ffd700';
      style.paddingLeft = '10px';
    }
    return { style };
  };

  return (
    <div 
      className={cn(
        "rounded-lg overflow-hidden border border-gray-700 bg-gray-900",
        fullscreen && "fixed inset-4 z-50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {getLanguageIcon()}
          <span className="text-sm text-gray-300">
            {title || language}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {runnable && onRun && (
            <button
              onClick={onRun}
              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Run
            </button>
          )}
          
          {collapsible && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              {collapsed ? (
                <Expand className="w-4 h-4 text-gray-400" />
              ) : (
                <Minimize2 className="w-4 h-4 text-gray-400" />
              )}
            </button>
          )}
          
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            {fullscreen ? (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Expand className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      {!collapsed && (
        <div 
          className="overflow-auto"
          style={{ maxHeight: fullscreen ? 'calc(100vh - 8rem)' : maxHeight }}
        >
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            showLineNumbers={showLineNumbers}
            wrapLines={highlightLines.length > 0}
            lineProps={lineProps}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
              fontSize: '0.875rem',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )}

      {/* Footer (if collapsed) */}
      {collapsed && (
        <div className="px-4 py-2 bg-gray-800 text-xs text-gray-400">
          {code.split('\n').length} lines collapsed
        </div>
      )}
    </div>
  );
}