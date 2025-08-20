// Tipos compartilhados da aplicação

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cost?: number;
  duration?: number;
  turns?: number;
  is_error?: boolean;
  agent?: string;
  sessionId?: string;
}

export interface Session {
  id: string;
  created: number;
  lastActivity: number;
  messageCount: number;
  title: string;
  messages?: Message[];
}

export interface FileUploadResult {
  success: boolean;
  filename: string;
  content: string;
  size: number;
  mimetype: string;
}

export interface ChatSettings {
  systemPrompt: string;
  maxTurns: number;
  allowedTools: string[];
  streamingEnabled: boolean;
}

export interface UISettings {
  showProcessingLogs: boolean;
  showDetailedMetrics: boolean;
  autoExpandLogs: boolean;
  animationsEnabled: boolean;
  compactMode: boolean;
  showTimestamps: boolean;
  showMessageIds: boolean;
  showNetworkLatency: boolean;
  showAgentVersions: boolean;
  showTokenUsage: boolean;
  enableConsoleLogs: boolean;
  showSessionInfo: boolean;
  showCostEstimates: boolean;
  enableAIConcierge: boolean;
  enableStepByStep: boolean;
  enableQuickActions: boolean;
  enableCostTracking: boolean;
  processingViewMode: 'minimize' | 'compact' | 'full' | 'hidden';
  messageViewMode: 'minimal' | 'standard' | 'detailed' | 'developer';
}

export interface ConnectionStats {
  active_connections: number;
  active_sessions: number;
}

export interface ProcessingStep {
  step: string;
  message: string;
  timestamp: number;
  duration?: number;
  sessionId?: string;
}

export interface ClaudeStatus {
  isLimitReached: boolean;
  resetTime: string | null;
  message: string;
}