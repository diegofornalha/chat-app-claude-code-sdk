import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { io, Socket } from 'socket.io-client';
import { ProcessingIndicator } from './components/ProcessingIndicator/ProcessingIndicator';
import { UISettings as UISettingsComponent } from './components/UISettings/UISettings';
import SystemMetrics from './components/SystemMetrics/SystemMetrics';
import { useMessageManager } from './hooks/useMessageManager';
import { Message, Session, FileUploadResult, ChatSettings, UISettings, ConnectionStats } from './types';

interface ProcessingStep {
  sessionId: string;
  step: string;
  message: string;
  data?: any;
  timestamp: number;
}

// Anthropic-inspired color system
const colors = {
  // Backgrounds
  background: '#F2EFEB',
  surface: '#FFFFFF',
  surfaceSecondary: '#FAFAFA',
  surfaceTertiary: '#F5F5F5',
  
  // Text
  textPrimary: '#000000',
  textSecondary: '#525252',
  textTertiary: '#A9A9A9',
  
  // Borders
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  borderFocus: '#A2C3D2',
  
  // Accent colors
  accent: '#A2C3D2',
  accentHover: '#8BB0C7',
  accentLight: '#D4E6ED',
  
  // Success/Green
  success: '#A0C090',
  successHover: '#8BC34A',
  successLight: '#E8F5E8',
  
  // Warning/Purple
  warning: '#C4B5D3',
  warningHover: '#B8A5CC',
  warningLight: '#F0EBFF',
  
  // Error/Red
  error: '#E98F75',
  errorHover: '#E67B5B',
  errorLight: '#FDEAE6',
  
  // Status
  statusSuccess: '#8BC34A',
  statusWarning: '#A9A9A9',
  statusError: '#E98F75',
  
  // Interactive states
  hover: '#F5F5F5',
  active: '#E8E8E8',
  disabled: '#A9A9A9',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
};

// Custom syntax highlighting theme matching Anthropic colors
const customSyntaxTheme = {
  'code[class*="language-"]': {
    color: colors.textPrimary,
    background: colors.surfaceTertiary,
    textShadow: 'none',
    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
    fontSize: '14px',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    tabSize: '4',
    hyphens: 'none',
  },
  'pre[class*="language-"]': {
    color: colors.textPrimary,
    background: colors.surfaceTertiary,
    textShadow: 'none',
    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
    fontSize: '14px',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    tabSize: '4',
    hyphens: 'none',
    padding: '16px',
    margin: '8px 0',
    overflow: 'auto',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
  },
  // Syntax highlighting colors
  'comment': { color: colors.textTertiary, fontStyle: 'italic' },
  'prolog': { color: colors.textTertiary, fontStyle: 'italic' },
  'doctype': { color: colors.textTertiary, fontStyle: 'italic' },
  'cdata': { color: colors.textTertiary, fontStyle: 'italic' },
  'punctuation': { color: colors.textPrimary },
  'property': { color: colors.accent },
  'tag': { color: colors.success },
  'boolean': { color: colors.warning },
  'number': { color: colors.warning },
  'constant': { color: colors.warning },
  'symbol': { color: colors.warning },
  'deleted': { color: colors.error },
  'selector': { color: colors.successHover },
  'attr-name': { color: colors.accent },
  'string': { color: colors.successHover },
  'char': { color: colors.successHover },
  'builtin': { color: colors.accent },
  'inserted': { color: colors.successHover },
  'operator': { color: colors.textPrimary },
  'entity': { color: colors.accent },
  'url': { color: colors.accent },
  'keyword': { color: colors.warning, fontWeight: 'bold' },
  'atrule': { color: colors.warning },
  'attr-value': { color: colors.successHover },
  'function': { color: colors.accent, fontWeight: 'bold' },
  'class-name': { color: colors.success, fontWeight: 'bold' },
  'regex': { color: colors.successHover },
  'important': { color: colors.error, fontWeight: 'bold' },
  'variable': { color: colors.textPrimary },
  'namespace': { color: colors.textTertiary },
};


const API_BASE = 'http://localhost:8080/api';

// Reusable button component with consistent styling - memoized
const HeaderButton = React.memo(({ 
  children, 
  onClick, 
  active = false, 
  variant = 'default',
  ...props 
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'success' | 'danger';
  [key: string]: any;
}) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: active ? colors.success : 'transparent',
          hoverBg: active ? colors.successHover : colors.hover,
          border: active ? colors.success : colors.border,
          text: active ? colors.surface : colors.textPrimary,
          focus: colors.successLight
        };
      case 'danger':
        return {
          bg: active ? colors.error : 'transparent',
          hoverBg: active ? colors.errorHover : colors.hover,
          border: active ? colors.error : colors.border,
          text: active ? colors.surface : colors.textPrimary,
          focus: colors.errorLight
        };
      default:
        return {
          bg: active ? colors.accent : 'transparent',
          hoverBg: active ? colors.accentHover : colors.hover,
          border: active ? colors.accent : colors.border,
          text: active ? colors.surface : colors.textPrimary,
          focus: colors.accentLight
        };
    }
  };

  const variantColors = getVariantColors();

  return (
    <button
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded-md transition-all duration-200 font-medium focus:outline-none"
      style={{ 
        color: variantColors.text,
        border: `1px solid ${variantColors.border}`,
        backgroundColor: variantColors.bg,
        boxShadow: active ? `0 2px 4px ${colors.overlayLight}` : 'none'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = variantColors.hoverBg;
        if (!active) e.currentTarget.style.borderColor = variantColors.border === colors.border ? colors.accent : variantColors.border;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = variantColors.bg;
        e.currentTarget.style.borderColor = variantColors.border;
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = 'none';
        e.currentTarget.style.boxShadow = `0 0 0 2px ${variantColors.focus}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = active ? `0 2px 4px ${colors.overlayLight}` : 'none';
      }}
      {...props}
    >
      {children}
    </button>
  );
});

// Custom code block component with copy functionality - memoized
const CodeBlock = React.memo(({ children, className, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (language) {
    return (
      <div className="relative group">
        <button
          onClick={copyToClipboard}
          className="absolute top-2 right-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-all duration-200"
          style={{ 
            backgroundColor: copied ? colors.statusSuccess : colors.textTertiary,
            color: colors.surface,
            boxShadow: copied ? `0 2px 4px ${colors.overlayLight}` : 'none'
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <SyntaxHighlighter
          language={language}
          style={customSyntaxTheme}
          {...props}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code
      className="px-1 py-0.5 rounded text-sm"
      style={{ 
        backgroundColor: colors.warningLight,
        color: colors.textPrimary,
        border: `1px solid ${colors.borderLight}`
      }}
      {...props}
    >
      {children}
    </code>
  );
});

const ClaudeChat = () => {
  // Custom markdown components with Anthropic styling - memoized
  const MarkdownComponents = useMemo(() => ({
  code: CodeBlock,
  pre: ({ children }: any) => <div>{children}</div>,
  h1: ({ children }: any) => (
    <h1 className="text-2xl font-bold mb-4 mt-6" style={{ color: colors.textPrimary }}>
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-xl font-bold mb-3 mt-5" style={{ color: colors.textPrimary }}>
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-lg font-bold mb-2 mt-4" style={{ color: colors.textPrimary }}>
      {children}
    </h3>
  ),
  p: ({ children }: any) => (
    <p className="mb-3 leading-relaxed" style={{ color: colors.textPrimary }}>
      {children}
    </p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside mb-3 ml-4" style={{ color: colors.textPrimary }}>
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside mb-3 ml-4" style={{ color: colors.textPrimary }}>
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="mb-1" style={{ color: colors.textPrimary }}>
      {children}
    </li>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:no-underline transition-colors"
      style={{ color: colors.accent }}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: any) => (
    <blockquote
      className="border-l-4 pl-4 py-2 mb-3 italic"
      style={{ 
        borderLeftColor: colors.success,
        backgroundColor: colors.successLight,
        color: colors.textSecondary
      }}
    >
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-3">
      <table className="min-w-full border-collapse" style={{ border: `1px solid ${colors.border}` }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }: any) => (
    <th
      className="border px-3 py-2 text-left font-semibold"
      style={{ 
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        color: colors.textPrimary
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td
      className="border px-3 py-2"
      style={{ 
        borderColor: colors.border,
        color: colors.textPrimary
      }}
    >
      {children}
    </td>
  ),
  strong: ({ children }: any) => (
    <strong className="font-bold" style={{ color: colors.textPrimary }}>
      {children}
    </strong>
  ),
  em: ({ children }: any) => (
    <em className="italic" style={{ color: colors.textPrimary }}>
      {children}
    </em>
  )
}), []);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [claudeStatus, setClaudeStatus] = useState<{
    isLimitReached: boolean;
    resetTime: string | null;
    message: string | null;
  }>({
    isLimitReached: false,
    resetTime: null,
    message: null
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentStreamingContent, setCurrentStreamingContent] = useState('');
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  
  // Detectar limite do Claude - memoized
  const claudeLimitCheck = useMemo(() => {
    if (!currentStreamingContent) return null;
    
    const contentStr = typeof currentStreamingContent === 'string' 
      ? currentStreamingContent 
      : String(currentStreamingContent);
    
    const limitPatterns = [
      'Claude Usage Limit Reached',
      'Claude usage limit reached', 
      'Claude AI usage limit reached',
      'Seu limite será resetado: '
    ];
    
    const isLimit = limitPatterns.some(pattern => contentStr.includes(pattern));
    if (!isLimit) return null;
    
    const resetTimeMatch = contentStr.match(/resetado em:\s*([^\\n]+)/) || 
                          contentStr.match(/reset at ([^.]+)/);
    
    return {
      isLimitReached: true,
      resetTime: resetTimeMatch ? resetTimeMatch[1].trim() : null,
      message: contentStr
    };
  }, [currentStreamingContent]);
  
  useEffect(() => {
    if (claudeLimitCheck && !claudeStatus.isLimitReached) {
      setClaudeStatus(claudeLimitCheck);
    }
  }, [claudeLimitCheck, claudeStatus.isLimitReached]);
  
  const socketRef = useRef<Socket | null>(null);
  
  // Função utilitária para verificar limite do Claude
  const checkClaudeLimit = useCallback((content: string) => {
    const limitPatterns = [
      'Claude usage limit reached',
      'Claude AI usage limit reached', 
      'Claude Usage Limit Reached',
      'Seu limite será resetado: '
    ];
    
    const isLimit = limitPatterns.some(pattern => content.includes(pattern));
    if (!isLimit) return null;
    
    const resetTimeMatch = content.match(/resetado em:\s*([^\\n]+)/) || 
                          content.match(/reset at ([^.]+)/);
    
    return {
      isLimitReached: true,
      resetTime: resetTimeMatch ? resetTimeMatch[1].trim() : null,
      message: content
    };
  }, []);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUISettings, setShowUISettings] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showSystemMetrics, setShowSystemMetrics] = useState(false);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({ active_connections: 0, active_sessions: 0 });
  const [settings, setSettings] = useState<ChatSettings>({
    systemPrompt: '',
    maxTurns: 5,
    allowedTools: [],
    streamingEnabled: true
  });
  // Carregar configurações do localStorage ou usar padrões
  const loadUiSettings = (): UISettings => {
    const savedSettings = localStorage.getItem('chatUiSettings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error('Erro ao carregar configurações:', e);
      }
    }
    return {
      showProcessingLogs: true,
      showDetailedMetrics: true,
      autoExpandLogs: false,
      animationsEnabled: true,
      compactMode: true,
      showTimestamps: true,
      showMessageIds: true,
      showNetworkLatency: true,
      showAgentVersions: true,
      showTokenUsage: true,
      enableConsoleLogs: true,
      showSessionInfo: true,
      showCostEstimates: true,
      enableAIConcierge: false,
      enableStepByStep: false,
      enableQuickActions: false,
      enableCostTracking: false,
      processingViewMode: 'compact' as 'minimize' | 'compact' | 'full' | 'hidden',
      messageViewMode: 'standard' as 'minimal' | 'standard' | 'detailed' | 'developer'
    };
  };

  const [uiSettings, setUiSettings] = useState<UISettings>(loadUiSettings());
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Inicializar hook de gerenciamento de mensagens com deduplicação integrada
  const messageManager = useMessageManager({
    onMessageAdded: (message) => {
      if (uiSettings.enableConsoleLogs) {
        console.log('✅ [MESSAGE_MANAGER] Nova mensagem adicionada:', message.id);
      }
    },
    onMessagesCleared: () => {
      if (uiSettings.enableConsoleLogs) {
        console.log('🧹 [MESSAGE_MANAGER] Mensagens limpas');
      }
    }
  });

  // Extrair mensagens e funções do manager
  const { messages, addMessage, clearMessages } = messageManager;

  // Salvar configurações quando mudarem
  useEffect(() => {
    localStorage.setItem('chatUiSettings', JSON.stringify(uiSettings));
  }, [uiSettings]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingContent]);

  useEffect(() => {
    initializeSocket();
    return () => {
      if (socketRef.current) {
        // Remove todos os listeners antes de desconectar
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      // Limpar cache de mensagens via messageManager quando desmontar
      clearMessages();
    };
  }, []);

  // Consolidated debug logging - only when enabled
  useEffect(() => {
    if (!uiSettings.enableConsoleLogs) return;
    
    const debugData = {
      messages: messages.length,
      streamingContent: currentStreamingContent?.length || 0,
      loading,
      processingSteps: processingSteps.length
    };
    
    console.log('🔄 [APP_STATE]', debugData);
  }, [messages.length, currentStreamingContent?.length, loading, processingSteps.length, uiSettings.enableConsoleLogs]);


  const initializeSocket = useCallback(() => {
    // Se já existe uma conexão, limpar antes de criar nova
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    
    const newSocket = io('http://localhost:8080');
    
    newSocket.on('connect', () => {
      if (uiSettings.enableConsoleLogs) console.log('🔗 Connected to server');
      setConnected(true);
      checkHealth();
    });
    
    newSocket.on('disconnect', () => {
      if (uiSettings.enableConsoleLogs) console.log('Disconnected from server');
      setConnected(false);
    });
    
    newSocket.on('connection_stats', (stats: ConnectionStats) => {
      setConnectionStats(stats);
    });
    
    newSocket.on('message', (message: Message & { sessionId: string }) => {
      if (uiSettings.enableConsoleLogs) {
        console.log('📥 Message received:', message.id);
      }
      
      addMessage(message);
      
      if (message.sessionId) {
        setSessionId(message.sessionId);
      }
    });
    
    newSocket.on('message_stream', (data: { sessionId: string; content: string; fullContent: string }) => {
      if (uiSettings.enableConsoleLogs) {
        console.log('🌊 Stream received:', data.fullContent.length);
      }
      
      setCurrentStreamingContent(data.fullContent);
    });
    
    newSocket.on('message_complete', (message: Message & { sessionId: string }) => {
      if (uiSettings.enableConsoleLogs) {
        console.log('✅ Message complete:', message.id);
      }
      
      setCurrentStreamingContent('');
      setLoading(false);
      addMessage(message);
      
      if (message.sessionId) {
        setSessionId(message.sessionId);
      }
    });
    
    
    newSocket.on('error', (error: any) => {
      if (uiSettings.enableConsoleLogs) {
        console.error('❌ Socket error:', error.error || error.message || 'Unknown error');
      }
      
      setLoading(false);
      setCurrentStreamingContent('');
      
      // Extrair mensagem de erro de forma mais limpa
      const errorContent = error.content || error.error || error.details || 
                          error.message || (typeof error === 'string' ? error : 
                          'Desculpe, não consegui processar sua solicitação corretamente. Por favor, tente novamente.');
      
      // Verificar limite do Claude de forma consolidada
      const claudeLimit = checkClaudeLimit(errorContent);
      if (claudeLimit) {
        setClaudeStatus(claudeLimit);
      }
      
      // Criar mensagem de erro
      const errorMessage: Message = {
        id: error.id || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: errorContent,
        timestamp: error.timestamp || Date.now(),
        is_error: true
      };
      
      addMessage(errorMessage);
    });
    
    newSocket.on('session_created', (session: Session) => {
      if (uiSettings.enableConsoleLogs) console.log('🆕 Session created:', session.id);
      
      setSessionId(session.id);
      setSessions(prev => [session, ...prev]);
    });
    
    newSocket.on('session_loaded', (session: Session) => {
      if (session.messages) {
        messageManager.setAllMessages(session.messages);
        setSessionId(session.id);
      }
    });
    
    // Listener para sessões deletadas
    newSocket.on('session_deleted', (data: { success: boolean; sessionId: string; remainingSessions?: number; timestamp?: number }) => {
      if (uiSettings.enableConsoleLogs) console.log('🗑️ Session deleted:', data.sessionId?.slice(0, 8));
      
      if (data.success) {
        setSessions(prevSessions => prevSessions.filter(s => s.id !== data.sessionId));
        
        if (sessionId === data.sessionId) {
          setSessionId('');
          clearMessages();
        }
      }
    });
    
    // Listener para atualizações da lista de sessões
    newSocket.on('session_list_updated', (data: { action: string; sessionId: string; remainingSessions: number; timestamp: number }) => {
      if (uiSettings.enableConsoleLogs) console.log('📋 Session list updated:', data.action);
      
      if (data.action === 'session_deleted') {
        setTimeout(loadSessions, 100);
        
        if (sessionId === data.sessionId) {
          setSessionId('');
          clearMessages();
        }
      }
    });

    newSocket.on('processing_step', (step: ProcessingStep) => {
      if (uiSettings.enableConsoleLogs) console.log('🔄 Processing step:', step.step);
      setProcessingSteps(prev => [...prev, step]);
    });

    newSocket.on('typing_start', () => {
      setProcessingSteps([]);
    });

    newSocket.on('typing_end', () => {
      setTimeout(() => {
        setProcessingSteps([]);
      }, 2000); // Clear steps after 2 seconds
    });

    // A2A Event Listeners
    newSocket.on('a2a:message_response', (data: any) => {
      if (uiSettings.enableConsoleLogs) console.log('🤖 A2A response received');
      
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: data.response,
        timestamp: Date.now(),
        agent: data.agent
      };
      
      addMessage(assistantMessage);
    });

    newSocket.on('a2a:stream', (data: any) => {
      if (uiSettings.enableConsoleLogs) console.log('🌊 A2A stream data');
      setCurrentStreamingContent(prev => prev + data.content);
    });

    newSocket.on('a2a:task_complete', (data: any) => {
      if (uiSettings.enableConsoleLogs) console.log('✅ A2A task complete');
    });

    newSocket.on('a2a:error', (data: any) => {
      if (uiSettings.enableConsoleLogs) console.error('❌ A2A Error:', data);
      
      const errorMessage: Message = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: `A2A Error: ${data.error}`,
        timestamp: Date.now(),
        is_error: true
      };
      
      addMessage(errorMessage);
    });
    
    setSocket(newSocket);
    socketRef.current = newSocket;
  }, [addMessage, clearMessages, sessionId, uiSettings.enableConsoleLogs, checkClaudeLimit]);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      setConnected(data.claude_available);
      if (data.active_connections !== undefined) {
        setConnectionStats({
          active_connections: data.active_connections,
          active_sessions: data.active_sessions
        });
      }
    } catch (error) {
      if (uiSettings.enableConsoleLogs) console.error('Health check failed:', error);
      setConnected(false);
    }
  }, [uiSettings.enableConsoleLogs]);



  const handleAgentSelect = useCallback((agent: string | null) => {
    setSelectedAgent(agent);
    if (uiSettings.enableConsoleLogs) console.log('🤖 Agent selected:', agent || 'Claude Direct');
  }, [uiSettings.enableConsoleLogs]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !socket || !sessionId) {
      if (uiSettings.enableConsoleLogs && !sessionId) {
        console.error('SessionId not defined');
      }
      if (!sessionId) alert('Sessão não inicializada. Por favor, recarregue a página.');
      return;
    }

    const messageId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageContent = input.trim();
    
    if (uiSettings.enableConsoleLogs) {
      console.log('📤 Sending message:', messageId);
    }

    try {
      const messageData = {
        message: messageContent,
        content: messageContent,
        sessionId,
        messageId,
        agent: selectedAgent,
        useAgent: !!selectedAgent
      };

      if (selectedAgent) {
        socket.emit('a2a:send_message', messageData);
      } else {
        socket.emit('send_message', messageData);
      }
      
      setInput('');
      setLoading(true);
      setCurrentStreamingContent('');
      
    } catch (error) {
      if (uiSettings.enableConsoleLogs) console.error('Send error:', error);
      setLoading(false);
    }
  }, [input, socket, sessionId, selectedAgent, uiSettings.enableConsoleLogs]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    clearMessages();
    setSessionId('');
    setCurrentStreamingContent('');
    setLoading(false);
    setProcessingSteps([]);
    if (socket) {
      socket.emit('create_session');
    }
  }, [clearMessages, socket]);

  const loadSession = useCallback((session: Session) => {
    if (socket) {
      socket.emit('load_session', session.id);
      setShowSidebar(false);
    }
  }, [socket]);

  const loadSessions = useCallback(async () => {
    try {
      console.log('📋 [SESSIONS] Loading sessions from server...');
      
      // Adicionar cache-busting com timestamp
      const cacheBust = `?t=${Date.now()}&r=${Math.random().toString(36).substr(2, 9)}`;
      const response = await fetch(`${API_BASE}/sessions${cacheBust}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const sessions = data.sessions || [];
      
      console.log('📋 [SESSIONS] Loaded sessions:', {
        count: sessions.length,
        sessionIds: sessions.map((s: any) => s.id.slice(0, 8)),
        timestamp: data.timestamp
      });
      
      setSessions(sessions);
    } catch (error) {
      console.error('📋 [SESSIONS] Failed to load sessions:', error);
    }
  }, []);

  const exportConversation = async (format: 'markdown' | 'json' = 'markdown') => {
    try {
      const response = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, format })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `claude-chat-${Date.now()}.${format === 'json' ? 'json' : 'md'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !socket) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Não setamos loading=true pois agora usamos a fila
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });

      const result: FileUploadResult = await response.json();
      
      if (result.success) {
        // Enviar análise de arquivo diretamente
        const analysisPrompt = `Please analyze this file (${result.filename}) and provide insights about its structure, purpose, and any potential improvements.\n\nFile content:\n${result.content}`;
        
        // Simular envio de mensagem como se fosse digitada pelo usuário
        setInput(analysisPrompt);
        setTimeout(() => {
          sendMessage();
        }, 100);
        
        setShowFileUpload(false);
      } else {
        console.error('File upload failed:', result);
      }
    } catch (error) {
      console.error('File upload error:', error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatMetadata = useCallback((message: Message) => {
    const parts = [];
    
    if (message.cost !== undefined) {
      parts.push(`$${message.cost.toFixed(4)}`);
    }
    
    if (message.duration !== undefined) {
      parts.push(`${message.duration.toFixed(0)}ms`);
    }
    
    if (message.turns !== undefined) {
      parts.push(`${message.turns} turns`);
    }
    
    if (sessionId) {
      parts.push(`Session: ${sessionId.substring(0, 8)}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : '';
  }, [sessionId]);

  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  }, []);

  // Helper function to safely convert message content to string - optimized
  const getMessageContent = useCallback((content: any): string => {
    if (typeof content === 'string') return content;
    if (content === null || content === undefined) return '';
    
    if (typeof content === 'object') {
      // Priority order for common fields
      const fields = ['error', 'message', 'content', 'text', 'response', 'details', 'result'];
      
      for (const field of fields) {
        if (content[field]) {
          const value = content[field];
          if (typeof value === 'object' && value.message) {
            return String(value.message);
          }
          if (field === 'content') {
            return getMessageContent(value); // Recursive for nested content
          }
          return String(value);
        }
      }
      
      // Handle arrays
      if (Array.isArray(content)) {
        return content.map(item => getMessageContent(item)).filter(Boolean).join('\n');
      }
      
      // Last resort - JSON for small objects
      try {
        const jsonStr = JSON.stringify(content, null, 2);
        if (jsonStr.length < 500) return jsonStr;
      } catch {}
      
      if (uiSettings.enableConsoleLogs) {
        console.warn('Complex message content:', typeof content);
      }
      return '';
    }
    
    return String(content);
  }, [uiSettings.enableConsoleLogs]);

  useEffect(() => {
    if (showSidebar) {
      console.log('📋 [SESSIONS] Sidebar opened, loading sessions...');
      loadSessions();
    }
  }, [showSidebar]);
  
  // Recarregar sessões quando o socket se conecta
  useEffect(() => {
    if (connected && socket) {
      console.log('📋 [SESSIONS] Socket connected, loading initial sessions...');
      loadSessions();
    }
  }, [connected, socket]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <div className="p-4 shadow-sm" style={{ backgroundColor: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>Claude Code Chat</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2" 
                 title={claudeStatus.isLimitReached && claudeStatus.message ? claudeStatus.message : undefined}>
              <div className={`w-2 h-2 rounded-full shadow-sm`} style={{
                backgroundColor: connected === null ? colors.statusWarning : 
                                connected ? colors.statusSuccess : 
                                claudeStatus.isLimitReached ? '#FFA500' : colors.statusError
              }}></div>
              <span className="text-sm font-medium" style={{ 
                color: claudeStatus.isLimitReached ? '#D97706' : colors.textSecondary,
                fontWeight: claudeStatus.isLimitReached ? '600' : 'normal'
              }}>
                {connected === null ? 'Checking...' : 
                 connected ? 'Connected' : 
                 claudeStatus.isLimitReached && claudeStatus.resetTime ? 
                   `⏰ Claude Limit - Reset às ${claudeStatus.resetTime}` : 
                 claudeStatus.isLimitReached ? 
                   '⏰ Claude Usage Limit Reached' : 
                   'Disconnected'}
              </span>
            </div>
            {/* AgentSelector temporariamente removido */}
            <HeaderButton
              onClick={() => setShowSidebar(!showSidebar)}
              active={showSidebar}
            >
              Sessions
            </HeaderButton>
            <HeaderButton
              onClick={() => setShowSettings(!showSettings)}
              active={showSettings}
            >
              Settings
            </HeaderButton>
            <HeaderButton
              onClick={() => setShowUISettings(!showUISettings)}
              active={showUISettings}
            >
              UI Config
            </HeaderButton>
            <HeaderButton
              onClick={() => setShowSystemMetrics(!showSystemMetrics)}
              active={showSystemMetrics}
              variant="success"
            >
              📊 Metrics
            </HeaderButton>
            <HeaderButton
              onClick={() => setShowFileUpload(!showFileUpload)}
              active={showFileUpload}
              variant="success"
            >
              Upload
            </HeaderButton>
            <HeaderButton
              onClick={() => exportConversation('markdown')}
            >
              Export
            </HeaderButton>
            <HeaderButton
              onClick={clearChat}
              variant="danger"
            >
              Clear Chat
            </HeaderButton>
          </div>
        </div>
      </div>

      {/* Sidebar for Sessions */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 transition-opacity duration-200"
            style={{ backgroundColor: colors.overlay }}
            onClick={() => setShowSidebar(false)}
          ></div>
          <div 
            className="relative w-80 h-full overflow-y-auto shadow-xl"
            style={{ backgroundColor: colors.surface, borderRight: `1px solid ${colors.border}` }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Sessions</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-lg font-bold w-8 h-8 rounded-full transition-colors hover:bg-opacity-10"
                  style={{ 
                    color: colors.textTertiary,
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.hover;
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colors.textTertiary;
                  }}
                >
                  ×
                </button>
              </div>
              <HeaderButton
                onClick={() => {
                  if (socket) {
                    socket.emit('create_session');
                  }
                }}
                variant="success"
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                New Session
              </HeaderButton>
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg cursor-pointer transition-all duration-200 border"
                    style={{ 
                      backgroundColor: sessionId === session.id ? colors.accentLight : colors.surfaceSecondary,
                      color: colors.textPrimary,
                      borderColor: sessionId === session.id ? colors.accent : colors.borderLight,
                      boxShadow: sessionId === session.id ? `0 2px 4px ${colors.overlayLight}` : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (sessionId !== session.id) {
                        e.currentTarget.style.backgroundColor = colors.hover;
                        e.currentTarget.style.borderColor = colors.border;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (sessionId !== session.id) {
                        e.currentTarget.style.backgroundColor = colors.surfaceSecondary;
                        e.currentTarget.style.borderColor = colors.borderLight;
                      }
                    }}
                    onClick={() => loadSession(session)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {session.title}
                        </div>
                        <div className="text-xs mt-1" style={{ color: colors.textTertiary }}>
                          {session.messageCount} messages • {formatTimestamp(session.lastActivity)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Previne que o clique selecione a sessão
                          
                          console.log('🗑️ [SESSIONS] Delete button clicked for session:', session.id.slice(0, 8));
                          
                          if (socket) {
                            // Emitir evento de deleção para o servidor
                            socket.emit('delete_session', session.id);
                            
                            // Remover da lista local imediatamente para UI responsíva
                            setSessions(prev => {
                              const filtered = prev.filter(s => s.id !== session.id);
                              console.log('🗑️ [SESSIONS] Local sessions updated:', {
                                before: prev.length,
                                after: filtered.length,
                                removedId: session.id.slice(0, 8)
                              });
                              return filtered;
                            });
                            
                            // Se era a sessão ativa, limpar a interface
                            if (sessionId === session.id) {
                              console.log('🗑️ [SESSIONS] Clearing active session interface');
                              setSessionId('');
                              clearMessages();
                            }
                          } else {
                            console.error('🗑️ [SESSIONS] No socket connection available for deletion');
                          }
                        }}
                        className="ml-2 p-1 rounded hover:bg-red-100 transition-colors"
                        style={{
                          color: colors.textTertiary,
                          backgroundColor: 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colors.errorLight;
                          e.currentTarget.style.color = colors.error;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = colors.textTertiary;
                        }}
                        title="Apagar conversa"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="text-center py-8" style={{ color: colors.textTertiary }}>
                    <div className="text-sm">No sessions yet</div>
                    <div className="text-xs mt-1">Create a new session to get started</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 transition-opacity duration-200"
            style={{ backgroundColor: colors.overlay }}
            onClick={() => setShowSettings(false)}
          ></div>
          <div 
            className="relative w-full max-w-md p-6 rounded-xl shadow-2xl"
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-lg font-bold w-8 h-8 rounded-full transition-colors"
                style={{ 
                  color: colors.textTertiary,
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.hover;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.textTertiary;
                }}
              >
                ×
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                  System Prompt
                </label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="Optional system prompt to customize Claude's behavior..."
                  className="w-full p-3 rounded-lg border resize-none transition-all duration-200 focus:outline-none"
                  style={{ 
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    color: colors.textPrimary
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = colors.borderFocus;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accentLight}`;
                    e.currentTarget.style.backgroundColor = colors.surface;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backgroundColor = colors.surfaceSecondary;
                  }}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: colors.textPrimary }}>
                  Max Turns: <span style={{ color: colors.accent }}>{settings.maxTurns}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={settings.maxTurns}
                  onChange={(e) => setSettings(prev => ({ ...prev, maxTurns: parseInt(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${colors.accent} 0%, ${colors.accent} ${(settings.maxTurns - 1) * 11.11}%, ${colors.borderLight} ${(settings.maxTurns - 1) * 11.11}%, ${colors.borderLight} 100%)`
                  }}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: colors.surfaceSecondary }}>
                <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>Streaming Enabled</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.streamingEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, streamingEnabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div 
                    className="w-11 h-6 rounded-full transition-colors duration-200"
                    style={{ 
                      backgroundColor: settings.streamingEnabled ? colors.accent : colors.border 
                    }}
                  >
                    <div 
                      className="w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 mt-0.5"
                      style={{ 
                        marginLeft: settings.streamingEnabled ? '1.25rem' : '0.125rem'
                      }}
                    ></div>
                  </div>
                </label>
              </div>
              <div className="text-xs p-3 rounded-lg" style={{ 
                color: colors.textTertiary,
                backgroundColor: colors.surfaceTertiary 
              }}>
                Active Connections: {connectionStats.active_connections} | Active Sessions: {connectionStats.active_sessions}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 transition-opacity duration-200"
            style={{ backgroundColor: colors.overlay }}
            onClick={() => setShowFileUpload(false)}
          ></div>
          <div 
            className="relative w-full max-w-md p-6 rounded-xl shadow-2xl"
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Upload File</h2>
              <button
                onClick={() => setShowFileUpload(false)}
                className="text-lg font-bold w-8 h-8 rounded-full transition-colors"
                style={{ 
                  color: colors.textTertiary,
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.hover;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.textTertiary;
                }}
              >
                ×
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept=".js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.h,.css,.html,.json,.xml,.yaml,.yml,.md,.txt,.php,.rb,.go,.rs,.swift,.kt,.scala,.sql"
                  className="w-full p-4 rounded-lg border-2 border-dashed transition-all duration-200"
                  style={{ 
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    color: colors.textPrimary
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.backgroundColor = colors.accentLight;
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.backgroundColor = colors.surfaceSecondary;
                  }}
                  onDrop={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.backgroundColor = colors.surfaceSecondary;
                  }}
                />
              </div>
              <div className="text-xs p-3 rounded-lg" style={{ 
                color: colors.textTertiary,
                backgroundColor: colors.surfaceTertiary 
              }}>
                <strong>Supported:</strong> Text files, code files (JS, TS, Python, etc.), max 10MB
              </div>
              {loading && (
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: colors.accentLight }}>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 rounded-full animate-spin border-2 border-transparent" style={{ 
                      borderTopColor: colors.accent,
                      borderRightColor: colors.accent
                    }}></div>
                    <span className="text-sm font-medium" style={{ color: colors.accent }}>
                      Processing file...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Metrics Panel */}
      {showSystemMetrics && (
        <div className="border-b" style={{ borderColor: colors.border }}>
          <SystemMetrics
            serverUrl="http://localhost:8080"
            showDetailedMetrics={uiSettings.showDetailedMetrics}
          />
        </div>
      )}


      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: colors.accentLight }}>
                  <span className="text-2xl">💬</span>
                </div>
              </div>
              <p className="text-lg mb-2 font-medium" style={{ color: colors.textPrimary }}>Welcome to Claude Code Chat</p>
              <p className="text-sm" style={{ color: colors.textTertiary }}>Start a conversation by typing a message below.</p>
            </div>
          )}
          
          {messages.map((message) => {
            console.log('🎨 [TRACE] Rendering message in UI:', {
              messageId: message.id,
              type: message.type,
              contentLength: typeof message.content === 'string' ? message.content.length : 0,
              isError: message.is_error
            });
            
            return (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-xl px-5 py-3 shadow-sm ${message.is_error ? 'border-l-4' : ''}`}
                style={{
                  backgroundColor: message.type === 'user' 
                    ? colors.accent 
                    : message.is_error 
                      ? colors.errorLight 
                      : colors.surface,
                  color: message.type === 'user' ? colors.surface : colors.textPrimary,
                  border: message.type === 'assistant' ? `1px solid ${colors.border}` : 'none',
                  borderLeftColor: message.is_error ? colors.error : undefined,
                  boxShadow: message.type === 'user' 
                    ? `0 2px 8px ${colors.overlayLight}` 
                    : `0 1px 3px ${colors.overlayLight}`
                }}
              >
                {/* Header com informações básicas */}
                {message.timestamp && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ 
                        color: message.type === 'user' ? colors.surface : colors.textSecondary 
                      }}>
                        {message.type === 'user' ? 'Você' : `Claude ${message.agent ? `(${message.agent})` : ''}`}
                      </span>
                      <span className="text-xs opacity-50" style={{ 
                        color: message.type === 'user' ? colors.surface : colors.textTertiary,
                        fontFamily: 'monospace'
                      }}>
                        #{message.id.substring(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {message.duration && (
                        <span className="text-xs opacity-50" style={{ 
                          color: message.type === 'user' ? colors.surface : colors.textTertiary
                        }}>
                          ⚡ {message.duration}ms
                        </span>
                      )}
                      {message.cost && (
                        <span className="text-xs opacity-50" style={{ 
                          color: message.type === 'user' ? colors.surface : colors.textTertiary
                        }}>
                          💰 ${message.cost.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Message content direto sem animação de collapse */}
                <div>
                  {/* Botão para mensagens longas */}
                  {getMessageContent(message.content).length > 500 && (
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedMessages);
                        if (newExpanded.has(message.id)) {
                          newExpanded.delete(message.id);
                        } else {
                          newExpanded.add(message.id);
                        }
                        setExpandedMessages(newExpanded);
                      }}
                      className="flex items-center space-x-1 mb-2 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: message.type === 'user' ? colors.surface : colors.textTertiary }}
                    >
                      <span>{expandedMessages.has(message.id) ? '📖' : '📄'}</span>
                      <span>{expandedMessages.has(message.id) ? 'Mostrar menos' : 'Mostrar tudo'}</span>
                    </button>
                  )}
                  
                  <div style={{
                                      maxHeight: getMessageContent(message.content).length > 500 && !expandedMessages.has(message.id) ? '150px' : 'none',
                  overflow: getMessageContent(message.content).length > 500 && !expandedMessages.has(message.id) ? 'hidden' : 'visible',
                    position: 'relative'
                  }}>
                    {message.type === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={MarkdownComponents}
                      >
                        {getMessageContent(message.content)}
                      </ReactMarkdown>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {getMessageContent(message.content)}
                      </div>
                    )}
                    
                    {/* Gradient overlay quando colapsado (mensagens longas) */}
                    {getMessageContent(message.content).length > 500 && !expandedMessages.has(message.id) && (
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '50px',
                          background: message.type === 'user' 
                            ? `linear-gradient(transparent, ${colors.accent})`
                            : `linear-gradient(transparent, ${message.is_error ? colors.errorLight : colors.surface})`,
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </div>
                </div>
                
                {message.type === 'assistant' && formatMetadata(message) && (
                  <div className="text-xs mt-3 pt-2 border-t" style={{ 
                    color: colors.textTertiary,
                    borderTopColor: colors.borderLight
                  }}>
                    {formatMetadata(message)}
                  </div>
                )}
              </div>
            </div>
            );
          })}
          
          {/* Processing Steps Display - Controlado por configurações do usuário */}
          {processingSteps.length > 0 && uiSettings.processingViewMode !== 'hidden' && (
            <div className="flex justify-start">
              <ProcessingIndicator
                steps={processingSteps}
                showDetails={uiSettings.showProcessingLogs}
                autoExpand={uiSettings.autoExpandLogs}
                animationsEnabled={uiSettings.animationsEnabled}
                viewMode={uiSettings.processingViewMode}
              />
            </div>
          )}
          
          {currentStreamingContent && (() => {
            const contentStr = typeof currentStreamingContent === 'string' ? currentStreamingContent : String(currentStreamingContent);
            console.log('🌊 [TRACE] Rendering streaming content in UI:', {
              contentLength: contentStr.length,
              preview: contentStr.substring(0, 50) + '...'
            });
            
            return (
            <div className="flex justify-start">
              <div
                className="max-w-3xl rounded-xl px-5 py-3 shadow-sm border relative"
                style={{
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderColor: colors.accent,
                  boxShadow: `0 1px 3px ${colors.overlayLight}, 0 0 0 1px ${colors.accentLight}`
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={MarkdownComponents}
                >
                  {typeof currentStreamingContent === 'string' ? currentStreamingContent : String(currentStreamingContent || '')}
                </ReactMarkdown>
                {/* Não mostrar typing indicator se há limite do Claude */}
                {!claudeStatus.isLimitReached && (
                  <div className="flex items-center mt-3 pt-2 border-t" style={{ borderTopColor: colors.borderLight }}>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.accent }}></div>
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.accent, animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.accent, animationDelay: '0.4s' }}></div>
                    </div>
                    <span className="text-xs ml-3 font-medium" style={{ color: colors.accent }}>
                      Claude is typing...
                    </span>
                  </div>
                )}
                
                {/* Não mostrar informação de reset no rodapé se já tem no conteúdo principal */}
                {claudeStatus.isLimitReached && claudeStatus.resetTime && !currentStreamingContent.includes('Seu limite será resetado: ') && (
                  <div className="flex items-center mt-3 pt-2 border-t" style={{ borderTopColor: colors.borderLight }}>
                    <span className="text-xs font-medium" style={{ color: '#D97706' }}>
                      🕐 Seu limite será resetado:  {claudeStatus.resetTime}
                    </span>
                  </div>
                )}
              </div>
            </div>
            );
          })()}
          
          {loading && !currentStreamingContent && processingSteps.length === 0 && (
            <div className="flex justify-start">
              <div className="rounded-xl px-5 py-3 shadow-sm border" style={{ 
                backgroundColor: colors.surface, 
                borderColor: colors.border,
                boxShadow: `0 1px 3px ${colors.overlayLight}`
              }}>
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.warning }}></div>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.warning, animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.warning, animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Claude is processing...
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 shadow-sm" style={{ backgroundColor: colors.surface, borderTop: `1px solid ${colors.border}` }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              className="flex-1 resize-none rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
              style={{ 
                border: `2px solid ${colors.border}`,
                backgroundColor: colors.surfaceSecondary,
                color: colors.textPrimary,
                minHeight: '52px'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.borderFocus;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accentLight}`;
                e.currentTarget.style.backgroundColor = colors.surface;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.backgroundColor = colors.surfaceSecondary;
              }}
              rows={1}
              disabled={connected === false} // Removido loading para permitir múltiplas mensagens
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || connected === false || loading}
              className="px-6 py-3 rounded-xl transition-all duration-200 font-semibold focus:outline-none min-w-[80px]"
              style={{ 
                backgroundColor: !input.trim() || connected === false 
                  ? colors.disabled 
                  : colors.success,
                color: colors.surface,
                cursor: !input.trim() || connected === false ? 'not-allowed' : 'pointer',
                boxShadow: !input.trim() || connected === false 
                  ? 'none' 
                  : `0 2px 4px ${colors.overlayLight}`
              }}
              onMouseEnter={(e) => {
                if (input.trim() && connected !== false) {
                  e.currentTarget.style.backgroundColor = colors.successHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 4px 8px ${colors.overlayLight}`;
                }
              }}
              onMouseLeave={(e) => {
                if (input.trim() && connected !== false) {
                  e.currentTarget.style.backgroundColor = colors.success;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 2px 4px ${colors.overlayLight}`;
                }
              }}
              onFocus={(e) => {
                if (input.trim() && connected !== false) {
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.successLight}`;
                }
              }}
              onBlur={(e) => {
                if (input.trim() && connected !== false) {
                  e.currentTarget.style.boxShadow = `0 2px 4px ${colors.overlayLight}`;
                }
              }}
            >
              {loading ? '...' : 'Send'}
            </button>
          </div>
          {sessionId && (
            <div className="text-xs mt-3 flex items-center space-x-2" style={{ color: colors.textTertiary }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.statusSuccess }}></span>
              <span>Session: <span className="font-mono">{sessionId.slice(0, 8)}...</span></span>
            </div>
          )}
        </div>
      </div>

      {/* UI Settings Modal */}
      {showUISettings && (
        <UISettingsComponent
          settings={uiSettings}
          onSettingsChange={(newSettings) => {
            setUiSettings((prev: UISettings) => {
              const updated = { ...prev, ...newSettings };
              // Salvar imediatamente no localStorage
              localStorage.setItem('chatUiSettings', JSON.stringify(updated));
              return updated;
            });
          }}
          onClose={() => setShowUISettings(false)}
        />
      )}

    </div>
  );
};

export default React.memo(ClaudeChat);
