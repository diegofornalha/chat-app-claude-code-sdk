/**
 * ChatInterface - Interface de chat modular
 * Substitui o App.tsx monolítico de 1900+ linhas
 */

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AgentCard } from '../AgentCard/AgentCard';
import { TaskList } from '../TaskProgress/TaskProgress';
import './ChatInterface.css';

export const ChatInterface: React.FC = () => {
  const { state, dispatch, sendMessage, selectAgent, createSession } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [showAgents, setShowAgents] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll para mensagens novas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.sessions, state.currentSessionId]);

  // Obter sessão atual
  const currentSession = state.currentSessionId 
    ? state.sessions.get(state.currentSessionId)
    : null;

  // Obter tarefas ativas
  const activeTasks = Array.from(state.tasks.values())
    .filter(t => state.activeTasks.includes(t.id));

  // Enviar mensagem
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    if (!state.currentSessionId) {
      createSession();
    }
    
    sendMessage(inputMessage);
    setInputMessage('');
    inputRef.current?.focus();
  };

  // Atalho de teclado (Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Selecionar agente
  const handleSelectAgent = (agent: any) => {
    selectAgent(agent.name);
    setShowAgents(false);
  };

  // Criar nova sessão
  const handleNewSession = () => {
    const title = prompt('Título da nova conversa:');
    createSession(title || undefined);
  };

  return (
    <div className="chat-interface">
      {/* Sidebar */}
      <aside className={`chat-sidebar ${state.isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>Conversas</h2>
          <button onClick={handleNewSession} className="new-session-btn">
            + Nova
          </button>
        </div>
        
        <div className="sessions-list">
          {Array.from(state.sessions.values()).map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === state.currentSessionId ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_CURRENT_SESSION', payload: session.id })}
            >
              <div className="session-title">{session.title}</div>
              <div className="session-info">
                <span>{session.messages.length} msgs</span>
                {session.agent && <span className="session-agent">{session.agent}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Tarefas Ativas */}
        {activeTasks.length > 0 && (
          <div className="sidebar-tasks">
            <h3>Tarefas Ativas ({activeTasks.length})</h3>
            <TaskList 
              tasks={activeTasks} 
              showOnlyActive={true}
            />
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            <button 
              className="sidebar-toggle"
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            >
              ☰
            </button>
            <h1>{currentSession?.title || 'Nova Conversa'}</h1>
          </div>
          
          <div className="header-right">
            {/* Agent Selector */}
            <div className="agent-selector">
              <button 
                className="agent-selector-btn"
                onClick={() => setShowAgents(!showAgents)}
              >
                <span className="agent-icon">
                  🤖
                </span>
                <span className="agent-name">
                  {state.selectedAgent || 'Auto'}
                </span>
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showAgents && (
                <div className="agents-dropdown">
                  <div className="agents-dropdown-header">
                    <h3>Agentes Disponíveis</h3>
                    <span className="agents-count">
                      {state.agents.filter(a => a.status === 'healthy').length} healthy
                    </span>
                  </div>
                  <div className="agents-list">
                    <div 
                      className={`agent-option ${!state.selectedAgent ? 'selected' : ''}`}
                      onClick={() => {
                        dispatch({ type: 'SELECT_AGENT', payload: null });
                        setShowAgents(false);
                      }}
                    >
                      <span className="agent-icon">🎯</span>
                      <span>Seleção Automática</span>
                    </div>
                    {state.agents.map(agent => (
                      <AgentCard
                        key={agent.name}
                        agent={agent}
                        isSelected={state.selectedAgent === agent.name}
                        onSelect={handleSelectAgent}
                        showMetrics={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tasks Toggle */}
            <button 
              className="tasks-toggle"
              onClick={() => setShowTasks(!showTasks)}
              title="Ver tarefas"
            >
              📊 {activeTasks.length}
            </button>

            {/* Connection Status */}
            <div className={`connection-status ${state.connected ? 'connected' : 'disconnected'}`}>
              {state.connected ? '🟢' : '🔴'}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="chat-messages">
          {currentSession?.messages.map(message => (
            <div 
              key={message.id} 
              className={`message ${message.role}`}
            >
              <div className="message-header">
                <span className="message-role">
                  {message.role === 'user' ? '👤' : '🤖'}
                  {message.role === 'user' ? 'Você' : message.agent || 'Assistente'}
                </span>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {message.content}
              </div>
              {message.metadata && (
                <div className="message-metadata">
                  {message.metadata.processingTime && (
                    <span className="metadata-item">
                      ⚡ {message.metadata.processingTime}ms
                    </span>
                  )}
                  {message.metadata.model && (
                    <span className="metadata-item">
                      🏷️ {message.metadata.model}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {state.isLoading && (
            <div className="message assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-container">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              state.connected 
                ? `Mensagem para ${state.selectedAgent || 'auto-seleção'}...`
                : 'Conectando ao servidor...'
            }
            disabled={!state.connected}
            rows={1}
          />
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!state.connected || !inputMessage.trim()}
          >
            ➤
          </button>
        </div>

        {/* Error Display */}
        {state.lastError && (
          <div className="error-banner">
            <span>⚠️ {state.lastError}</span>
            <button onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}>
              ✕
            </button>
          </div>
        )}
      </main>

      {/* Tasks Panel */}
      {showTasks && (
        <aside className="tasks-panel">
          <div className="tasks-panel-header">
            <h2>Tarefas e Métricas</h2>
            <button onClick={() => setShowTasks(false)}>✕</button>
          </div>
          
          <div className="tasks-panel-content">
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Mensagens</span>
                <span className="metric-value">{state.metrics.totalMessages}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Tarefas</span>
                <span className="metric-value">{state.metrics.totalTasks}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Tempo Médio</span>
                <span className="metric-value">
                  {Math.round(state.metrics.averageResponseTime)}ms
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Uptime</span>
                <span className="metric-value">
                  {Math.floor(state.metrics.uptime / 60)}m
                </span>
              </div>
            </div>
            
            <h3>Tarefas Recentes</h3>
            <TaskList 
              tasks={Array.from(state.tasks.values()).slice(-10)} 
              showDetails={true}
            />
          </div>
        </aside>
      )}
    </div>
  );
};