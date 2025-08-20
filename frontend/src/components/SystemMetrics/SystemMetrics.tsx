import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './SystemMetrics.css';

interface SessionMetric {
  sessionId: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  startTime: number;
  lastActivity: number;
}

interface SystemMetricsData {
  // Métricas globais
  totalMessages: number;
  totalTokensUsed: number;
  totalCost: number;
  activeConnections: number;
  activeSessions: number;
  
  // Métricas por sessão
  sessions: SessionMetric[];
  
  // Métricas de tempo
  uptime: number;
  avgResponseTime: number;
  
  // Histórico (últimas 24h)
  hourlyMetrics: {
    hour: string;
    messages: number;
    tokens: number;
    cost: number;
  }[];
  
  // Top usuários/sessões
  topSessions: {
    sessionId: string;
    messages: number;
    cost: number;
  }[];
}

interface Props {
  serverUrl?: string;
  updateInterval?: number;
  showDetailedMetrics?: boolean;
}

const SystemMetrics: React.FC<Props> = ({
  serverUrl = 'http://localhost:8080',
  updateInterval = 5000,
  showDetailedMetrics = true
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [metrics, setMetrics] = useState<SystemMetricsData>({
    totalMessages: 0,
    totalTokensUsed: 0,
    totalCost: 0,
    activeConnections: 0,
    activeSessions: 0,
    sessions: [],
    uptime: 0,
    avgResponseTime: 0,
    hourlyMetrics: [],
    topSessions: []
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // Conectar ao servidor via WebSocket
    const newSocket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('📊 Conectado ao servidor de métricas');
      setIsConnected(true);
      // Solicitar métricas iniciais
      newSocket.emit('request_metrics');
    });

    newSocket.on('disconnect', () => {
      console.log('📊 Desconectado do servidor de métricas');
      setIsConnected(false);
    });

    newSocket.on('metrics_update', (data: SystemMetricsData) => {
      setMetrics(data);
      setLastUpdate(new Date());
    });

    newSocket.on('session_metrics', (sessionData: SessionMetric) => {
      setMetrics(prev => ({
        ...prev,
        sessions: [...prev.sessions.filter(s => s.sessionId !== sessionData.sessionId), sessionData]
      }));
    });

    setSocket(newSocket);

    // Solicitar atualizações periódicas
    const interval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('request_metrics');
      }
    }, updateInterval);

    return () => {
      clearInterval(interval);
      newSocket.close();
    };
  }, [serverUrl, updateInterval]);

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (): string => {
    if (!isConnected) return 'status-red';
    if (metrics.activeConnections > 0) return 'status-green';
    return 'status-yellow';
  };

  return (
    <div className="system-metrics">
      <div className="metrics-header">
        <h2>📊 Métricas do Sistema</h2>
        <div className="connection-status">
          <span className={`status-indicator ${getStatusColor()}`}></span>
          <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>

      {/* Cards principais */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Custo Total</h3>
            <p className="metric-value">{formatCost(metrics.totalCost)}</p>
            <span className="metric-label">Acumulado</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💬</div>
          <div className="metric-content">
            <h3>Mensagens</h3>
            <p className="metric-value">{formatNumber(metrics.totalMessages)}</p>
            <span className="metric-label">Total</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <h3>Tokens</h3>
            <p className="metric-value">{formatNumber(metrics.totalTokensUsed)}</p>
            <span className="metric-label">Usados</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <h3>Sessões</h3>
            <p className="metric-value">{metrics.activeSessions}</p>
            <span className="metric-label">Ativas</span>
          </div>
        </div>
      </div>

      {/* Métricas detalhadas */}
      <div className="metrics-details">
        <div className="detail-section">
          <h3>⏱️ Performance</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Tempo de Resposta</span>
              <span className="detail-value">{metrics.avgResponseTime.toFixed(2)}ms</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Uptime</span>
              <span className="detail-value">{formatUptime(metrics.uptime)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Conexões Ativas</span>
              <span className="detail-value">{metrics.activeConnections}</span>
            </div>
          </div>
        </div>

        {/* Top Sessões */}
        {metrics.topSessions.length > 0 && (
          <div className="detail-section">
            <h3>🏆 Top Sessões</h3>
            <div className="top-sessions">
              {metrics.topSessions.slice(0, 5).map((session, index) => (
                <div key={session.sessionId} className="session-item">
                  <span className="session-rank">#{index + 1}</span>
                  <span className="session-id">{session.sessionId.slice(0, 8)}...</span>
                  <span className="session-messages">{session.messages} msgs</span>
                  <span className="session-cost">{formatCost(session.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gráfico de uso por hora */}
        {metrics.hourlyMetrics.length > 0 && (
          <div className="detail-section">
            <h3>📈 Uso nas Últimas 24h</h3>
            <div className="hourly-chart">
              <div className="chart-bars">
                {metrics.hourlyMetrics.map((hour, index) => {
                  const maxMessages = Math.max(...metrics.hourlyMetrics.map(h => h.messages), 1);
                  const height = (hour.messages / maxMessages) * 100;
                  return (
                    <div key={index} className="chart-bar-container">
                      <div 
                        className="chart-bar" 
                        style={{ height: `${height}%` }}
                        title={`${hour.hour}: ${hour.messages} mensagens, ${formatCost(hour.cost)}`}
                      >
                        <span className="bar-value">{hour.messages}</span>
                      </div>
                      <span className="bar-label">{hour.hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Custo médio */}
        <div className="detail-section">
          <h3>💸 Análise de Custos</h3>
          <div className="cost-analysis">
            <div className="cost-item">
              <span className="cost-label">Custo Médio por Mensagem</span>
              <span className="cost-value">
                {metrics.totalMessages > 0 
                  ? formatCost(metrics.totalCost / metrics.totalMessages)
                  : '$0.00'}
              </span>
            </div>
            <div className="cost-item">
              <span className="cost-label">Custo por 1K Tokens</span>
              <span className="cost-value">
                {metrics.totalTokensUsed > 0 
                  ? formatCost((metrics.totalCost / metrics.totalTokensUsed) * 1000)
                  : '$0.00'}
              </span>
            </div>
            <div className="cost-item">
              <span className="cost-label">Projeção Mensal</span>
              <span className="cost-value">
                {metrics.uptime > 0 
                  ? formatCost((metrics.totalCost / (metrics.uptime / 86400)) * 30)
                  : '$0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé com última atualização */}
      <div className="metrics-footer">
        <span className="update-time">
          Última atualização: {lastUpdate.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default SystemMetrics;