import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Conversation } from './components/ui/conversation';
import { Message } from './components/ui/message';
import { PromptInput } from './components/ui/prompt-input';
import { Loader } from './components/ui/loader';
import { Task } from './components/ui/task';
import { Tool } from './components/ui/tool';
import AgentSelector from './components/AgentSelector';
import { Bot, User, Settings, History } from '@/lib/icons';

interface MessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

interface TaskType {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  agent?: string;
  progress?: number;
}

function AppAIElements() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState('claude');
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>('');

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
      setAgents(data.agents || []);
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
  };

  const handleFileUpload = (file: File) => {
    console.log('File uploaded:', file.name);
    // Implement file upload logic
  };

  const suggestions = [
    "What can you help me with?",
    "Explain this code",
    "Generate a React component",
    "Debug this error"
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">AI Chat with Elements</h1>
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
                status={currentAgent === agent.id ? 'active' : 'idle'}
                icon={<Bot className="w-4 h-4" />}
                onClick={() => setCurrentAgent(agent.id)}
              />
            ))}
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
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Bot className="w-12 h-12 mb-4" />
                <p className="text-lg">Start a conversation</p>
                <p className="text-sm">Choose an agent and send a message</p>
              </div>
            ) : (
              messages.map(message => (
                <Message
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  isStreaming={message.isStreaming}
                  onCopy={() => console.log('Copied')}
                  onRegenerate={
                    message.role === 'assistant' 
                      ? () => console.log('Regenerate')
                      : undefined
                  }
                />
              ))
            )}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex items-center gap-3 px-4 py-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <Loader variant="dots" size="md" />
              </div>
            )}
          </Conversation>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-4">
            <PromptInput
              value={input}
              onChange={setInput}
              onSubmit={handleSendMessage}
              onFileUpload={handleFileUpload}
              placeholder="Send a message..."
              disabled={isLoading}
              isLoading={isLoading}
              suggestions={input === '' ? suggestions : undefined}
            />
          </div>
        </div>

        {/* Sidebar - Tasks */}
        <aside className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Tasks</h3>
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
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AppAIElements;