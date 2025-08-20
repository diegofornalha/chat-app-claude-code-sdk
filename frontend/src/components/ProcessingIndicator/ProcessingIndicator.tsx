import React, { useState, useEffect } from 'react';
import './ProcessingIndicator.css';

interface ProcessingStep {
  sessionId: string;
  step: string;
  message: string;
  data?: any;
  timestamp: number;
}

interface ProcessingIndicatorProps {
  steps: ProcessingStep[];
  showDetails: boolean;
  autoExpand: boolean;
  animationsEnabled: boolean;
  viewMode?: 'minimize' | 'compact' | 'full' | 'hidden';
  stepFilters?: {
    showSystemStep: boolean;
    showInitializingStep: boolean;
    showConnectingStep: boolean;
    showThinkingStep: boolean;
    showToolSteps: boolean;
    showStreamingStep: boolean;
    showFinalizingStep: boolean;
  };
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  steps,
  showDetails,
  autoExpand,
  animationsEnabled,
  viewMode = 'minimize',
  stepFilters
}) => {
  const [expanded, setExpanded] = useState(false); // Iniciar colapsado
  const [minimized, setMinimized] = useState(viewMode === 'minimize'); // Baseado no viewMode
  
  useEffect(() => {
    setExpanded(autoExpand || viewMode === 'full');
    setMinimized(viewMode === 'minimize');
  }, [autoExpand, viewMode]);

  // Função para filtrar steps baseado nas configurações
  const shouldShowStep = (step: ProcessingStep): boolean => {
    if (!stepFilters) return true; // Se não há filtros, mostrar tudo
    
    const stepType = step.step;
    
    switch (stepType) {
      case 'system':
        return stepFilters.showSystemStep;
      case 'initializing':
      case 'initialization':
        return stepFilters.showInitializingStep;
      case 'connecting':
      case 'connection':
        return stepFilters.showConnectingStep;
      case 'thinking':
        return stepFilters.showThinkingStep;
      case 'tool_use':
      case 'tool_result':
        return stepFilters.showToolSteps;
      case 'streaming':
        return stepFilters.showStreamingStep;
      case 'finalizing':
        return stepFilters.showFinalizingStep;
      default:
        return true; // Mostrar steps não categorizados
    }
  };

  // Filtrar steps baseado nas configurações
  const filteredSteps = steps.filter(shouldShowStep);

  if (!showDetails || filteredSteps.length === 0 || viewMode === 'hidden') {
    if (viewMode === 'hidden') return null;
    
    // Modo simples - apenas indicador de processamento
    return (
      <div className={`processing-simple ${animationsEnabled ? 'animated' : ''}`}>
        <div className="processing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span className="processing-text">Processando...</span>
      </div>
    );
  }

  const currentStep = filteredSteps[filteredSteps.length - 1];
  
  const getStepEmoji = (stepType: string) => {
    switch (stepType) {
      case 'initialization': return '🚀';
      case 'connection': return '🔗';
      case 'processing': return '⚙️';
      case 'thinking': return '🤔';
      case 'writing': return '✍️';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '📍';
    }
  };

  const formatData = (data: any) => {
    if (!data) return null;
    
    const items = [];
    
    if (data.prompt_size !== undefined) {
      items.push(`${data.prompt_size} caracteres`);
    }
    if (data.max_turns !== undefined) {
      items.push(`${data.max_turns} turnos max`);
    }
    if (data.allowed_tools !== undefined) {
      items.push(`${data.allowed_tools} ferramentas`);
    }
    if (data.endpoint) {
      items.push(data.endpoint);
    }
    if (data.request_size) {
      items.push(data.request_size);
    }
    
    return items;
  };

  // Modo compacto - sem possibilidade de expandir
  if (viewMode === 'compact') {
    return (
      <div className="processing-container compact-mode">
        <div className="processing-header">
          <div className="processing-title">
            <span className="processing-icon">
              {getStepEmoji(currentStep.step)}
            </span>
            <span className="processing-current">
              {typeof currentStep.message === 'string' ? currentStep.message : JSON.stringify(currentStep.message)}
            </span>
          </div>
        </div>
        {animationsEnabled && (
          <div className="processing-animation">
            <div className="processing-pulse"></div>
          </div>
        )}
      </div>
    );
  }

  // Modo minimizado - pode expandir para full
  if (minimized && viewMode === 'minimize') {
    return (
      <div 
        className="processing-minimized"
        onClick={() => setMinimized(false)}
      >
        <div className="processing-minimized-icon">
          {getStepEmoji(currentStep.step)}
        </div>
        <span className="processing-minimized-text">
          {typeof currentStep.message === 'string' ? currentStep.message : JSON.stringify(currentStep.message)}
        </span>
        <button className="processing-expand-btn">
          ↕
        </button>
      </div>
    );
  }

  return (
    <div className={`processing-container ${animationsEnabled ? 'animated' : ''}`}>
      <div className="processing-header">
        <div className="processing-title">
          <span className="processing-icon">
            {getStepEmoji(currentStep.step)}
          </span>
          <span className="processing-current">
            {typeof currentStep.message === 'string' ? currentStep.message : JSON.stringify(currentStep.message)}
          </span>
        </div>
        <div className="processing-controls">
          <button 
            className="processing-toggle"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {expanded ? '−' : '+'}
          </button>
          <button 
            className="processing-minimize"
            onClick={() => setMinimized(true)}
            title="Minimizar"
          >
            _
          </button>
        </div>
      </div>

      {expanded && (
        <div className="processing-details">
          <div className="processing-progress">
            <div className="processing-progress-bar">
              <div 
                className="processing-progress-fill"
                style={{ 
                  width: `${Math.min((filteredSteps.length / 5) * 100, 90)}%` 
                }}
              />
            </div>
          </div>

          <div className="processing-steps">
            {filteredSteps.slice(-3).map((step, index) => {
              const dataItems = formatData(step.data);
              return (
                <div 
                  key={index} 
                  className={`processing-step ${index === filteredSteps.slice(-3).length - 1 ? 'active' : ''}`}
                >
                  <div className="processing-step-icon">
                    {getStepEmoji(step.step)}
                  </div>
                  <div className="processing-step-content">
                    <div className="processing-step-message">
                      {step.message}
                    </div>
                    {dataItems && dataItems.length > 0 && (
                      <div className="processing-step-data">
                        {dataItems.map((item, i) => (
                          <span key={i} className="processing-data-item">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="processing-step-time">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {animationsEnabled && (
        <div className="processing-animation">
          <div className="processing-pulse"></div>
        </div>
      )}
    </div>
  );
};