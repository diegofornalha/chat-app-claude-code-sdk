/**
 * AgentCard - Componente modular para exibir informações de um agente
 * Inspirado no agent_card.py do Mesop
 */

import React from 'react';
import { Agent } from '../../context/AppContext';
import './AgentCard.css';

interface AgentCardProps {
  agent: Agent;
  isSelected?: boolean;
  onSelect?: (agent: Agent) => void;
  showMetrics?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isSelected = false,
  onSelect,
  showMetrics = true
}) => {
  const getStatusIcon = () => {
    switch (agent.status) {
      case 'healthy':
        return '🟢';
      case 'unhealthy':
        return '🔴';
      case 'disconnected':
      default:
        return '⚫';
    }
  };

  const getTypeIcon = () => {
    switch (agent.type) {
      case 'llm':
        return '🤖';
      case 'team':
        return '👥';
      case 'generic':
      default:
        return '⚙️';
    }
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={`agent-card ${isSelected ? 'selected' : ''} ${agent.status}`}
      onClick={() => onSelect?.(agent)}
    >
      <div className="agent-card-header">
        <div className="agent-card-title">
          <span className="agent-type-icon">{getTypeIcon()}</span>
          <h3>{agent.name}</h3>
          <span className="agent-status-icon">{getStatusIcon()}</span>
        </div>
        {agent.type && <div className="agent-card-type">{agent.type}</div>}
      </div>

      <div className="agent-card-body">
        {agent.url && <div className="agent-card-url">{agent.url}</div>}
        
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="agent-card-capabilities">
            <h4>Capacidades:</h4>
            <div className="capabilities-list">
              {agent.capabilities!.slice(0, 3).map((cap, idx) => (
                <span key={idx} className="capability-badge">
                  {cap}
                </span>
              ))}
              {agent.capabilities!.length > 3 && (
                <span className="capability-more">
                  +{agent.capabilities!.length - 3} mais
                </span>
              )}
            </div>
          </div>
        )}

        {showMetrics && agent.metrics && (
          <div className="agent-card-metrics">
            <div className="metric">
              <span className="metric-label">Requisições:</span>
              <span className="metric-value">{agent.metrics.requestsProcessed}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Tempo médio:</span>
              <span className="metric-value">
                {formatResponseTime(agent.metrics.averageResponseTime)}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Taxa de sucesso:</span>
              <span className="metric-value success-rate">
                {agent.metrics.successRate.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {isSelected && (
        <div className="agent-card-selected-indicator">
          <span>✓ Selecionado</span>
        </div>
      )}
    </div>
  );
};