import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Mic, StopCircle } from '@/lib/icons';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onFileUpload?: (file: File) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  suggestions?: string[];
  className?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onFileUpload,
  placeholder = "Send a message...",
  disabled,
  isLoading,
  suggestions,
  className
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled && !isLoading) {
      onSubmit(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onChange(suggestion)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input Container */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-end bg-white border border-gray-300 rounded-2xl shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
          {/* File Upload Button */}
          {onFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.txt,.md,.csv,.json"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading}
                className="p-3 hover:bg-gray-100 rounded-l-2xl transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-5 h-5 text-gray-600" />
              </button>
            </>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={cn(
              "flex-1 py-3 px-3 bg-transparent resize-none outline-none",
              "min-h-[48px] max-h-[200px]",
              "placeholder:text-gray-400",
              "disabled:opacity-50"
            )}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!value.trim() || disabled || isLoading}
            className={cn(
              "p-3 rounded-r-2xl transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              value.trim() && !disabled && !isLoading
                ? "text-blue-600 hover:bg-blue-50"
                : "text-gray-400"
            )}
          >
            {isLoading ? (
              <StopCircle className="w-5 h-5 animate-pulse" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Character Counter */}
        <div className="mt-2 text-xs text-gray-500 text-right">
          {value.length > 0 && `${value.length} characters`}
        </div>
      </form>
    </div>
  );
}