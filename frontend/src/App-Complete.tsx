import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// UI Components
import { Conversation } from './components/ui/conversation';
import { Message } from './components/ui/message';
import { PromptInput } from './components/ui/prompt-input';
import { Loader } from './components/ui/loader';
import { Task } from './components/ui/task';
import { Tool } from './components/ui/tool';
import { Branch } from './components/ui/branch';
import { Reasoning } from './components/ui/reasoning';
import { Sources } from './components/ui/sources';
import { Suggestion } from './components/ui/suggestion';
import { Actions } from './components/ui/actions';
import { CodeBlock } from './components/ui/code-block';

// Icons
import { Bot, User, Settings, History } from '@/lib/icons';

interface MessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
  code?: {
    code: string;
    language: string;
  };
  sources?: any[];
  reasoning?: any[];
  branches?: any[];
}

interface TaskType {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  agent?: string;
  progress?: number;
  startTime?: string;
  endTime?: string;
}

function AppComplete() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState('claude');
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [agents, setAgents] = useState<any[]>([
    { id: 'claude', name: 'Claude', description: 'Direct Claude Code SDK', status: 'idle' },
    { id: 'crew-ai', name: 'CrewAI', description: 'Team of specialized agents', status: 'idle' },
    { id: 'helloworld', name: 'HelloWorld', description: 'Simple test agent', status: 'idle' }
  ]);
  const [sessionId, setSessionId] = useState<string>('');
  const [showReasoning, setShowReasoning] = useState(false);

  // Socket connection
  useEffect(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8085';
    const newSocket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to backend');
    });

    newSocket.on('session_created', (data: any) => {
      setSessionId(data.sessionId);
    });

    newSocket.on('message_stream', (data: any) => {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: lastMessage.content + data.content }
          ];
        }
        return prev;
      });
    });

    newSocket.on('message_complete', (data: any) => {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, isStreaming: false }
          ];
        }
        return prev;
      });
      setIsLoading(false);
    });

    newSocket.on('a2a:agents', (data: any) => {
      if (data.agents) {
        setAgents(prev => data.agents.map((agent: any) => ({
          ...agent,
          status: 'idle'
        })));
      }
    });

    newSocket.on('task:update', (data: any) => {
      setTasks(prev => {
        const existing = prev.find(t => t.id === data.id);
        if (existing) {
          return prev.map(t => t.id === data.id ? data : t);
        }
        return [...prev, data];
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSendMessage = (message: string) => {
    if (!socket || !message.trim()) return;

    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Update agent status
    setAgents(prev => prev.map(a => 
      a.id === currentAgent ? { ...a, status: 'active' } : a
    ));

    // Create task
    const taskId = `task-${Date.now()}`;
    setTasks(prev => [...prev, {
      id: taskId,
      title: `Processing: ${message.substring(0, 50)}...`,
      status: 'in_progress',
      agent: currentAgent,
      startTime: new Date().toLocaleTimeString()
    }]);

    // Add streaming assistant message
    const assistantMessage: MessageType = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Send to backend
    if (currentAgent === 'claude') {
      socket.emit('send_message', {
        message,
        sessionId,
        context: {}
      });
    } else {
      socket.emit('a2a:send_message', {
        message,
        sessionId,
        agentName: currentAgent
      });
    }

    // Simulate task completion
    setTimeout(() => {
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'completed', endTime: new Date().toLocaleTimeString() }
          : t
      ));
      setAgents(prev => prev.map(a => 
        a.id === currentAgent ? { ...a, status: 'idle' } : a
      ));
    }, 3000);
  };

  const handleFileUpload = (file: File) => {
    console.log('File uploaded:', file.name);
    // Implement file upload logic
  };

  const suggestions = [
    "Explain how the A2A system works",
    "Show me the Neo4j memory context",
    "Generate a React component",
    "Debug the last error"
  ];

  // Demo data for advanced features
  const demoSources = [
    {
      id: '1',
      title: 'Neo4j Memory Context',
      type: 'database' as const,
      description: 'Previous conversation context from Neo4j',
      metadata: { relevance: 0.95 }
    },
    {
      id: '2',
      title: 'A2A Protocol Documentation',
      type: 'document' as const,
      url: 'https://docs.example.com/a2a',
      metadata: { author: 'System', date: '2024-01-18' }
    }
  ];

  const demoReasoning = [
    {
      id: '1',
      type: 'thinking' as const,
      content: 'Analyzing user query for intent and context',
      timestamp: '10:30:15'
    },
    {
      id: '2',
      type: 'analysis' as const,
      content: 'Checking Neo4j for relevant memory context',
      timestamp: '10:30:16'
    },
    {
      id: '3',
      type: 'decision' as const,
      content: 'Routing to specialized CrewAI agent for complex task',
      timestamp: '10:30:17'
    }
  ];

  const demoBranches = [
    {
      id: '1',
      content: 'Here\'s a simple implementation using functional components...',
      agent: 'Claude'
    },
    {
      id: '2',
      content: 'I would approach this with a class-based architecture...',
      agent: 'CrewAI'
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">AI Chat Complete</h1>
            <span className="text-sm text-gray-500">
              Session: {sessionId || 'Connecting...'}
            </span>
          </div>
          
          {/* Agent Tools */}
          <div className="flex items-center gap-2">
            {agents.map(agent => (
              <Tool
                key={agent.id}
                name={agent.name}
                description={agent.description}
                status={agent.status}
                icon={<Bot className="w-4 h-4" />}
                onClick={() => setCurrentAgent(agent.id)}
              />
            ))}
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Toggle reasoning"
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex flex-col flex-1">
          {/* Messages */}
          <Conversation className="flex-1 px-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <Bot className="w-12 h-12 mb-4 text-gray-400" />
                <p className="text-lg text-gray-600 mb-2">Start a conversation</p>
                <p className="text-sm text-gray-500 mb-6">Choose an agent and send a message</p>
                
                {/* Initial Suggestions */}
                <Suggestion
                  suggestions={suggestions}
                  onSelect={handleSendMessage}
                  variant="default"
                  className="max-w-md"
                />
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={message.id}>
                  <Message
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                    isStreaming={message.isStreaming}
                    onCopy={() => console.log('Copied')}
                    onRegenerate={
                      message.role === 'assistant' 
                        ? () => handleSendMessage(messages[index - 1]?.content || '')
                        : undefined
                    }
                  />
                  
                  {/* Additional Components for Assistant Messages */}
                  {message.role === 'assistant' && !message.isStreaming && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Code Block */}
                      {message.code && (
                        <CodeBlock
                          code={message.code.code}
                          language={message.code.language}
                          title="Generated Code"
                          runnable={message.code.language === 'javascript'}
                          onRun={() => console.log('Run code')}
                        />
                      )}
                      
                      {/* Sources */}
                      {index === messages.length - 1 && (
                        <Sources
                          sources={demoSources}
                          title="Context Used"
                          compact
                        />
                      )}
                      
                      {/* Reasoning */}
                      {showReasoning && index === messages.length - 1 && (
                        <Reasoning
                          steps={demoReasoning}
                          title="Agent Reasoning Process"
                          expanded={false}
                        />
                      )}
                      
                      {/* Branches */}
                      {index === messages.length - 1 && demoBranches.length > 1 && (
                        <Branch
                          options={demoBranches}
                          onSelect={(id) => console.log('Selected branch:', id)}
                        />
                      )}
                      
                      {/* Actions */}
                      <Actions
                        actions={[
                          {
                            id: 'copy',
                            icon: 'copy',
                            label: 'Copy',
                            onClick: () => console.log('Copy')
                          },
                          {
                            id: 'regenerate',
                            icon: 'regenerate',
                            label: 'Regenerate',
                            onClick: () => handleSendMessage(messages[index - 1]?.content || '')
                          },
                          {
                            id: 'thumbsUp',
                            icon: 'thumbsUp',
                            onClick: () => console.log('Thumbs up')
                          },
                          {
                            id: 'thumbsDown',
                            icon: 'thumbsDown',
                            onClick: () => console.log('Thumbs down')
                          }
                        ]}
                        variant="default"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {/* Loading */}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex items-center gap-3 px-4 py-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <Loader variant="dots" size="md" />
              </div>
            )}
          </Conversation>

          {/* Input with Inline Suggestions */}
          <div className="border-t border-gray-200 bg-white p-4">
            {input === '' && messages.length > 0 && (
              <Suggestion
                suggestions={[
                  "Continue this thought",
                  "Explain in more detail",
                  "Show me an example",
                  "What are the alternatives?"
                ]}
                onSelect={setInput}
                variant="inline"
                className="mb-3"
              />
            )}
            
            <PromptInput
              value={input}
              onChange={setInput}
              onSubmit={handleSendMessage}
              onFileUpload={handleFileUpload}
              placeholder="Send a message..."
              disabled={isLoading}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Sidebar - Tasks */}
        <aside className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <History className="w-4 h-4" />
            Tasks & Activity
          </h3>
          
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-500">No active tasks</p>
            ) : (
              tasks.map(task => (
                <Task
                  key={task.id}
                  title={task.title}
                  description={task.description}
                  status={task.status}
                  agent={task.agent}
                  progress={task.progress}
                  startTime={task.startTime}
                  endTime={task.endTime}
                />
              ))
            )}
          </div>
          
          {/* Session History */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Sessions</h4>
            <div className="space-y-2">
              <button className="w-full text-left p-2 hover:bg-gray-50 rounded-md text-sm">
                <div className="text-gray-800">Previous conversation</div>
                <div className="text-xs text-gray-500">2 hours ago</div>
              </button>
              <button className="w-full text-left p-2 hover:bg-gray-50 rounded-md text-sm">
                <div className="text-gray-800">Debug session</div>
                <div className="text-xs text-gray-500">Yesterday</div>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AppComplete;