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
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  steps,
  showDetails,
  autoExpand,
  animationsEnabled,
  viewMode = 'minimize'
}) => {
  const [expanded, setExpanded] = useState(false); // Iniciar colapsado
  const [minimized, setMinimized] = useState(viewMode === 'minimize'); // Baseado no viewMode
  
  useEffect(() => {
    setExpanded(autoExpand || viewMode === 'full');
    setMinimized(viewMode === 'minimize');
  }, [autoExpand, viewMode]);

  if (!showDetails || steps.length === 0 || viewMode === 'hidden') {
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

  const currentStep = steps[steps.length - 1];
  
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
                  width: `${Math.min((steps.length / 5) * 100, 90)}%` 
                }}
              />
            </div>
          </div>

          <div className="processing-steps">
            {steps.slice(-3).map((step, index) => {
              const dataItems = formatData(step.data);
              return (
                <div 
                  key={index} 
                  className={`processing-step ${index === steps.slice(-3).length - 1 ? 'active' : ''}`}
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