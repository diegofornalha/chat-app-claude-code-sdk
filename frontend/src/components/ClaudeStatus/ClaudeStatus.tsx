/**
 * ClaudeStatus - Componente para exibir status e limite do Claude
 */

import React, { useState, useEffect } from 'react';
import './ClaudeStatus.css';

interface ClaudeStatusProps {
  isLimitReached?: boolean;
  resetTime?: string;
  error?: string;
}

export const ClaudeStatus: React.FC<ClaudeStatusProps> = ({ 
  isLimitReached = false, 
  resetTime,
  error 
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Calcular tempo restante até o reset
  useEffect(() => {
    if (!resetTime) return;

    const updateTimeRemaining = () => {
      try {
        // Assumindo que resetTime está no formato brasileiro: "19/08/2025, 20:00:00"
        const [datePart, timePart] = resetTime.split(', ');
        const [day, month, year] = datePart.split('/');
        const [hour, minute, second] = timePart.split(':');
        
        const resetDate = new Date(
          parseInt(year), 
          parseInt(month) - 1, 
          parseInt(day), 
          parseInt(hour), 
          parseInt(minute), 
          parseInt(second)
        );

        const now = new Date();
        const diff = resetDate.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining('Limite resetado! Você pode tentar novamente.');
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s restantes`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s restantes`);
        } else {
          setTimeRemaining(`${seconds}s restantes`);
        }
      } catch (error) {
        console.error('Erro ao calcular tempo restante:', error);
        setTimeRemaining('Tempo de reset indisponível');
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [resetTime]);

  // Detectar se o erro contém informações de limite do Claude
  const isClaudeLimit = error?.includes('Claude usage limit reached') || 
                       error?.includes('Claude AI usage limit reached') ||
                       isLimitReached;

  if (!isClaudeLimit && !error) return null;

  return (
    <div className={`claude-status ${isClaudeLimit ? 'claude-status--limit' : 'claude-status--error'}`}>
      <div className="claude-status__icon">
        {isClaudeLimit ? '⏰' : '⚠️'}
      </div>
      
      <div className="claude-status__content">
        {isClaudeLimit ? (
          <>
            <div className="claude-status__title">
              🤖 Claude Temporariamente Indisponível
            </div>
            <div className="claude-status__message">
              Limite de uso atingido. 
              {resetTime && (
                <>
                  <br />
                  <strong>Reset em:</strong> {resetTime}
                  {timeRemaining && (
                    <>
                      <br />
                      <span className="claude-status__countdown">⏰ {timeRemaining}</span>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="claude-status__tip">
              💡 <strong>Dica:</strong> O sistema continuará funcionando para outras funcionalidades que não dependem do Claude.
            </div>
          </>
        ) : (
          <>
            <div className="claude-status__title">
              ⚠️ Erro de Conexão
            </div>
            <div className="claude-status__message">
              {error}
            </div>
          </>
        )}
      </div>
      
      <div className="claude-status__actions">
        <button 
          className="claude-status__retry-btn"
          onClick={() => window.location.reload()}
          title="Recarregar página"
        >
          🔄
        </button>
      </div>
    </div>
  );
};

export default ClaudeStatus;

