/**
 * AppContext - Estado centralizado inspirado no AppState do Mesop
 * Substitui hooks fragmentados por um estado tipado e centralizado
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// ========== TIPOS ==========

export interface Agent {
  name: string;
  type?: 'llm' | 'team' | 'generic';
  status: 'healthy' | 'unhealthy' | 'disconnected';
  capabilities?: string[];
  url?: string;
  metrics?: {
    requestsProcessed: number;
    averageResponseTime: number;
    successRate: number;
  };
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: string;
  timestamp: number;
  metadata?: {
    model?: string;
    processingTime?: number;
    intent?: any;
  };
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  agent?: string;
}

export interface Task {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: any;
  error?: string;
  agent?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentStep?: number;
  results?: any[];
}

export interface WorkflowStep {
  name: string;
  task: string;
  agent?: string;
  options?: any;
  stopOnFailure?: boolean;
}

export interface AppState {
  // Conexão
  connected: boolean;
  socket: Socket | null;
  
  // Agentes
  agents: Agent[];
  selectedAgent: string | null;
  agentDiscoveryEnabled: boolean;
  
  // Sessões e Mensagens
  sessions: Map<string, Session>;
  currentSessionId: string | null;
  
  // Tarefas
  tasks: Map<string, Task>;
  activeTasks: string[];
  
  // Workflows
  workflows: Map<string, Workflow>;
  activeWorkflow: string | null;
  
  // UI State
  isLoading: boolean;
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  
  // Configurações de UI
  uiSettings: {
    showProcessingLogs: boolean;
    showDetailedMetrics: boolean;
    autoExpandLogs: boolean;
    animationsEnabled: boolean;
    compactMode: boolean;
    // Novas opções de debug
    showTimestamps: boolean;
    showMessageIds: boolean;
    showNetworkLatency: boolean;
    showAgentVersions: boolean;
    showTokenUsage: boolean;
    enableConsoleLogs: boolean;
    showSessionInfo: boolean;
    showCostEstimates: boolean;
  };
  
  // Métricas
  metrics: {
    totalMessages: number;
    totalTasks: number;
    averageResponseTime: number;
    uptime: number;
  };
  
  // Erros
  lastError: string | null;
}

// ========== ACTIONS ==========

export type AppAction =
  // Conexão
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_SOCKET'; payload: Socket | null }
  
  // Agentes
  | { type: 'SET_AGENTS'; payload: Agent[] }
  | { type: 'ADD_AGENT'; payload: Agent }
  | { type: 'UPDATE_AGENT'; payload: Agent }
  | { type: 'SELECT_AGENT'; payload: string | null }
  | { type: 'TOGGLE_AGENT_DISCOVERY' }
  
  // Sessões
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'UPDATE_SESSION'; payload: Session }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'SET_CURRENT_SESSION'; payload: string }
  
  // Mensagens
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: Message } }
  | { type: 'UPDATE_MESSAGE'; payload: { sessionId: string; messageId: string; updates: Partial<Message> } }
  
  // Tarefas
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: { taskId: string; updates: Partial<Task> } }
  | { type: 'REMOVE_TASK'; payload: string }
  
  // Workflows
  | { type: 'ADD_WORKFLOW'; payload: Workflow }
  | { type: 'UPDATE_WORKFLOW'; payload: { workflowId: string; updates: Partial<Workflow> } }
  | { type: 'SET_ACTIVE_WORKFLOW'; payload: string | null }
  
  // UI
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'UPDATE_UI_SETTINGS'; payload: Partial<AppState['uiSettings']> }
  
  // Métricas
  | { type: 'UPDATE_METRICS'; payload: Partial<AppState['metrics']> }
  
  // Erros
  | { type: 'SET_ERROR'; payload: string | null };

// ========== ESTADO INICIAL ==========

const initialState: AppState = {
  connected: false,
  socket: null,
  agents: [],
  selectedAgent: null,
  agentDiscoveryEnabled: true,
  sessions: new Map(),
  currentSessionId: null,
  tasks: new Map(),
  activeTasks: [],
  workflows: new Map(),
  activeWorkflow: null,
  isLoading: false,
  isSidebarOpen: true,
  theme: 'light',
  uiSettings: {
    showProcessingLogs: true, // Habilitado por padrão
    showDetailedMetrics: true,
    autoExpandLogs: true,
    animationsEnabled: true,
    compactMode: true,
    // Novas opções de debug - todas habilitadas por padrão
    showTimestamps: true,
    showMessageIds: true,
    showNetworkLatency: true,
    showAgentVersions: true,
    showTokenUsage: true,
    enableConsoleLogs: true,
    showSessionInfo: true,
    showCostEstimates: true
  },
  metrics: {
    totalMessages: 0,
    totalTasks: 0,
    averageResponseTime: 0,
    uptime: 0
  },
  lastError: null
};

// ========== REDUCER ==========

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Conexão
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    
    // Agentes
    case 'SET_AGENTS':
      return { ...state, agents: action.payload };
    
    case 'ADD_AGENT':
      return { 
        ...state, 
        agents: [...state.agents.filter(a => a.name !== action.payload.name), action.payload]
      };
    
    case 'UPDATE_AGENT':
      return {
        ...state,
        agents: state.agents.map(a => 
          a.name === action.payload.name ? { ...a, ...action.payload } : a
        )
      };
    
    case 'SELECT_AGENT':
      return { ...state, selectedAgent: action.payload };
    
    case 'TOGGLE_AGENT_DISCOVERY':
      return { ...state, agentDiscoveryEnabled: !state.agentDiscoveryEnabled };
    
    // Sessões
    case 'ADD_SESSION':
      const newSessions = new Map(state.sessions);
      newSessions.set(action.payload.id, action.payload);
      return { ...state, sessions: newSessions };
    
    case 'UPDATE_SESSION':
      const updatedSessions = new Map(state.sessions);
      const existingSession = updatedSessions.get(action.payload.id);
      if (existingSession) {
        updatedSessions.set(action.payload.id, { ...existingSession, ...action.payload });
      }
      return { ...state, sessions: updatedSessions };
    
    case 'DELETE_SESSION':
      const sessionsAfterDelete = new Map(state.sessions);
      sessionsAfterDelete.delete(action.payload);
      return { ...state, sessions: sessionsAfterDelete };
    
    case 'SET_CURRENT_SESSION':
      return { ...state, currentSessionId: action.payload };
    
    // Mensagens
    case 'ADD_MESSAGE':
      const sessionsWithNewMessage = new Map(state.sessions);
      const session = sessionsWithNewMessage.get(action.payload.sessionId);
      if (session) {
        session.messages.push(action.payload.message);
        session.updatedAt = Date.now();
        sessionsWithNewMessage.set(action.payload.sessionId, session);
      }
      return { 
        ...state, 
        sessions: sessionsWithNewMessage,
        metrics: {
          ...state.metrics,
          totalMessages: state.metrics.totalMessages + 1
        }
      };
    
    case 'UPDATE_MESSAGE':
      const sessionsWithUpdatedMessage = new Map(state.sessions);
      const sessionForUpdate = sessionsWithUpdatedMessage.get(action.payload.sessionId);
      if (sessionForUpdate) {
        sessionForUpdate.messages = sessionForUpdate.messages.map(m =>
          m.id === action.payload.messageId 
            ? { ...m, ...action.payload.updates }
            : m
        );
        sessionsWithUpdatedMessage.set(action.payload.sessionId, sessionForUpdate);
      }
      return { ...state, sessions: sessionsWithUpdatedMessage };
    
    // Tarefas
    case 'ADD_TASK':
      const newTasks = new Map(state.tasks);
      newTasks.set(action.payload.id, action.payload);
      return { 
        ...state, 
        tasks: newTasks,
        activeTasks: [...state.activeTasks, action.payload.id],
        metrics: {
          ...state.metrics,
          totalTasks: state.metrics.totalTasks + 1
        }
      };
    
    case 'UPDATE_TASK':
      const updatedTasks = new Map(state.tasks);
      const existingTask = updatedTasks.get(action.payload.taskId);
      if (existingTask) {
        updatedTasks.set(action.payload.taskId, { ...existingTask, ...action.payload.updates });
      }
      
      // Remover de ativas se completou ou falhou
      const updatedTask = updatedTasks.get(action.payload.taskId);
      let newActiveTasks = state.activeTasks;
      if (updatedTask && (updatedTask.status === 'completed' || updatedTask.status === 'failed')) {
        newActiveTasks = state.activeTasks.filter(id => id !== action.payload.taskId);
      }
      
      return { 
        ...state, 
        tasks: updatedTasks,
        activeTasks: newActiveTasks
      };
    
    case 'REMOVE_TASK':
      const tasksAfterRemove = new Map(state.tasks);
      tasksAfterRemove.delete(action.payload);
      return { 
        ...state, 
        tasks: tasksAfterRemove,
        activeTasks: state.activeTasks.filter(id => id !== action.payload)
      };
    
    // Workflows
    case 'ADD_WORKFLOW':
      const newWorkflows = new Map(state.workflows);
      newWorkflows.set(action.payload.id, action.payload);
      return { ...state, workflows: newWorkflows };
    
    case 'UPDATE_WORKFLOW':
      const updatedWorkflows = new Map(state.workflows);
      const existingWorkflow = updatedWorkflows.get(action.payload.workflowId);
      if (existingWorkflow) {
        updatedWorkflows.set(action.payload.workflowId, { ...existingWorkflow, ...action.payload.updates });
      }
      return { ...state, workflows: updatedWorkflows };
    
    case 'SET_ACTIVE_WORKFLOW':
      return { ...state, activeWorkflow: action.payload };
    
    // UI
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'TOGGLE_SIDEBAR':
      return { ...state, isSidebarOpen: !state.isSidebarOpen };
    
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    
    case 'UPDATE_UI_SETTINGS':
      return { 
        ...state, 
        uiSettings: { ...state.uiSettings, ...action.payload }
      };
    
    // Métricas
    case 'UPDATE_METRICS':
      return { 
        ...state, 
        metrics: { ...state.metrics, ...action.payload }
      };
    
    // Erros
    case 'SET_ERROR':
      return { ...state, lastError: action.payload };
    
    default:
      return state;
  }
}

// ========== CONTEXT ==========

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Ações convenientes
  sendMessage: (message: string, agent?: string) => void;
  selectAgent: (agentName: string) => void;
  createSession: (title?: string) => string;
  executeWorkflow: (workflow: Workflow) => void;
  discoverAgents: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ========== PROVIDER ==========

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Conectar ao servidor
  useEffect(() => {
    const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:8090');
    
    dispatch({ type: 'SET_SOCKET', payload: socket });
    
    // Configurar listeners
    socket.on('connect', () => {
      console.log('✅ Conectado ao servidor');
      dispatch({ type: 'SET_CONNECTED', payload: true });
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Desconectado do servidor');
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });
    
    socket.on('system:status', (data) => {
      dispatch({ type: 'SET_AGENTS', payload: data.agents });
      dispatch({ type: 'UPDATE_METRICS', payload: data.metrics });
    });
    
    socket.on('agents:list', (agents) => {
      dispatch({ type: 'SET_AGENTS', payload: agents });
    });
    
    socket.on('agent:registered', (data) => {
      console.log('🆕 Novo agente registrado:', data.agent);
      // Requisitar lista atualizada
      socket.emit('agents:list');
    });
    
    socket.on('agent:healthy', (data) => {
      dispatch({ 
        type: 'UPDATE_AGENT', 
        payload: { name: data.agent, status: 'healthy' } as Agent 
      });
    });
    
    socket.on('agent:unhealthy', (data) => {
      dispatch({ 
        type: 'UPDATE_AGENT', 
        payload: { name: data.agent, status: 'unhealthy' } as Agent 
      });
    });
    
    socket.on('task:progress', (data) => {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          taskId: data.taskId,
          updates: { progress: data.progress, status: 'processing' }
        }
      });
    });
    
    socket.on('task:completed', (data) => {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          taskId: data.taskId,
          updates: { status: 'completed', result: data.result }
        }
      });
    });
    
    socket.on('task:failed', (data) => {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          taskId: data.taskId,
          updates: { status: 'failed', error: data.error }
        }
      });
    });
    
    socket.on('message:response', (data) => {
      const message: Message = {
        id: `msg-${Date.now()}`,
        sessionId: data.sessionId || state.currentSessionId!,
        role: 'assistant',
        content: data.result?.result || data.result || '',
        agent: data.agent,
        timestamp: Date.now(),
        metadata: {
          processingTime: data.processingTime
        }
      };
      
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { sessionId: message.sessionId, message }
      });
    });
    
    socket.on('message:error', (data) => {
      dispatch({ type: 'SET_ERROR', payload: data.error });
      dispatch({ type: 'SET_LOADING', payload: false });
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);
  
  // Auto-discovery de agentes
  useEffect(() => {
    if (state.connected && state.agentDiscoveryEnabled && state.socket) {
      const interval = setInterval(() => {
        state.socket!.emit('agents:discover');
      }, 30000);
      
      // Descoberta inicial
      state.socket!.emit('agents:discover');
      
      return () => clearInterval(interval);
    }
  }, [state.connected, state.agentDiscoveryEnabled, state.socket]);
  
  // Ações convenientes
  const sendMessage = useCallback((message: string, agent?: string) => {
    if (!state.socket || !state.connected) {
      dispatch({ type: 'SET_ERROR', payload: 'Not connected to server' });
      return;
    }
    
    // Criar sessão se não existir
    let sessionId = state.currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }
    
    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sessionId,
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { sessionId, message: userMessage }
    });
    
    // Enviar para servidor
    dispatch({ type: 'SET_LOADING', payload: true });
    
    if (agent || state.selectedAgent) {
      state.socket.emit('message:agent', {
        message,
        agent: agent || state.selectedAgent,
        sessionId
      });
    } else {
      state.socket.emit('message', {
        message,
        sessionId
      });
    }
    
    dispatch({ type: 'SET_LOADING', payload: false });
  }, [state.socket, state.connected, state.currentSessionId, state.selectedAgent]);
  
  const selectAgent = useCallback((agentName: string) => {
    dispatch({ type: 'SELECT_AGENT', payload: agentName });
    
    if (state.socket) {
      state.socket.emit('agent:select', { agent: agentName });
    }
  }, [state.socket]);
  
  const createSession = useCallback((title?: string) => {
    const sessionId = `session-${Date.now()}`;
    const session: Session = {
      id: sessionId,
      title: title || `Nova Conversa ${state.sessions.size + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agent: state.selectedAgent || undefined
    };
    
    dispatch({ type: 'ADD_SESSION', payload: session });
    dispatch({ type: 'SET_CURRENT_SESSION', payload: sessionId });
    
    return sessionId;
  }, [state.sessions.size, state.selectedAgent]);
  
  const executeWorkflow = useCallback((workflow: Workflow) => {
    if (!state.socket || !state.connected) {
      dispatch({ type: 'SET_ERROR', payload: 'Not connected to server' });
      return;
    }
    
    dispatch({ type: 'ADD_WORKFLOW', payload: workflow });
    dispatch({ type: 'SET_ACTIVE_WORKFLOW', payload: workflow.id });
    
    state.socket.emit('workflow:execute', workflow);
  }, [state.socket, state.connected]);
  
  const discoverAgents = useCallback(() => {
    if (state.socket && state.connected) {
      state.socket.emit('agents:discover');
    }
  }, [state.socket, state.connected]);
  
  const value: AppContextValue = {
    state,
    dispatch,
    sendMessage,
    selectAgent,
    createSession,
    executeWorkflow,
    discoverAgents
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// ========== HOOK ==========

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};