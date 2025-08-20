import React, { useState, useEffect, useCallback } from 'react';

interface ClaudeCountdownProps {
  onResetTime?: () => void;
  limitReached?: boolean;
  resetTimeFromBackend?: string | null;
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export const ClaudeCountdown: React.FC<ClaudeCountdownProps> = ({ 
  onResetTime, 
  limitReached = false,
  resetTimeFromBackend 
}) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [nextResetTime, setNextResetTime] = useState<Date | null>(null);
  const [limitReachedTime, setLimitReachedTime] = useState<Date | null>(null);

  // Calcular próximo horário de reset baseado em quando o limite foi atingido
  const calculateNextReset = useCallback(() => {
    // Se temos informação do backend sobre o reset, usar ela
    if (resetTimeFromBackend) {
      const match = resetTimeFromBackend.match(/dia (\d+), (\d+)h/);
      if (match) {
        const day = parseInt(match[1]);
        const hour = parseInt(match[2]);
        const resetDate = new Date();
        resetDate.setDate(day);
        resetDate.setHours(hour, 0, 0, 0);
        return resetDate;
      }
    }

    // Se o limite foi atingido, calcular 5 horas a partir desse momento
    if (limitReached && !limitReachedTime) {
      const now = new Date();
      setLimitReachedTime(now);
      localStorage.setItem('claudeLimitReachedTime', now.toISOString());
      
      // Adicionar 5 horas ao momento atual
      const resetDate = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      return resetDate;
    }

    // Tentar recuperar do localStorage
    const savedLimitTime = localStorage.getItem('claudeLimitReachedTime');
    if (savedLimitTime) {
      const limitTime = new Date(savedLimitTime);
      const resetDate = new Date(limitTime.getTime() + 5 * 60 * 60 * 1000);
      
      // Se já passou do tempo de reset, limpar localStorage
      if (resetDate.getTime() <= new Date().getTime()) {
        localStorage.removeItem('claudeLimitReachedTime');
        return null;
      }
      
      return resetDate;
    }

    return null;
  }, [resetTimeFromBackend, limitReached, limitReachedTime]);

  // Calcular tempo restante
  const calculateTimeRemaining = useCallback(() => {
    if (!nextResetTime) return null;

    const now = new Date();
    const diff = nextResetTime.getTime() - now.getTime();
    
    if (diff <= 0) {
      // Reset aconteceu
      localStorage.removeItem('claudeLimitReachedTime');
      setLimitReachedTime(null);
      setNextResetTime(null);
      if (onResetTime) onResetTime();
      return null;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours,
      minutes,
      seconds,
      totalSeconds
    };
  }, [nextResetTime, onResetTime]);

  // Atualizar próximo reset quando componente monta ou quando muda info
  useEffect(() => {
    const reset = calculateNextReset();
    setNextResetTime(reset);
  }, [calculateNextReset]);

  // Buscar informações do backend periodicamente
  useEffect(() => {
    const fetchResetInfo = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/claude-reset-info');
        const data = await response.json();
        
        if (data.success && data.resetTimestamp) {
          const resetDate = new Date(data.resetTimestamp * 1000);
          setNextResetTime(resetDate);
        }
      } catch (error) {
        console.log('Não foi possível obter info de reset do backend');
      }
    };

    // Buscar na montagem e a cada minuto
    fetchResetInfo();
    const interval = setInterval(fetchResetInfo, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Timer para atualizar contagem regressiva
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeRemaining]);

  // Formatar display do tempo
  const formatTimeDisplay = () => {
    if (!timeRemaining) return '--:--:--';
    
    const { hours, minutes, seconds } = timeRemaining;
    
    // Formato HH:MM:SS
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // Se não há informações de reset, não mostrar nada
  if (!nextResetTime && !limitReached) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      padding: '4px 8px',
      borderRadius: '4px',
      backgroundColor: limitReached ? '#FFF3E0' : 'transparent'
    }}>
      <span>⏱️</span>
      <span>Reset em:</span>
      <span style={{
        fontFamily: 'monospace',
        fontWeight: 'bold',
        color: limitReached ? '#FF6B00' : '#4CAF50'
      }}>
        {formatTimeDisplay()}
      </span>
    </div>
  );
};

export default ClaudeCountdown;