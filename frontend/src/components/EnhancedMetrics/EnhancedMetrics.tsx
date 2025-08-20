import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './EnhancedMetrics.css';

interface MetricsData {
  enhanced?: {
    totalTasks: number;
    successfulTasks: number;
    avgResponseTime: number;
    successRate: number;
    totalTokensUsed: number;
  };
  quality?: {
    totalEvaluations: number;
    averageScore: number;
    successRate: number;
    improvementTrend: number;
    currentThresholds: {
      minimum: number;
      target: number;
      excellent: number;
    };
  };
  workers?: {
    pool: {
      totalTasks: number;
      completedTasks: number;
      failedTasks: number;
      avgExecutionTime: number;
    };
    utilization: number;
    workers: Array<{
      id: string;
      status: string;
      totalTasks: number;
      successRate: number;
    }>;
  };
  orchestrator?: {
    activeTasks: number;
  };
  timestamp: number;
}

interface Props {
  serverUrl?: string;
  updateInterval?: number;
  showDetailedMetrics?: boolean;
}

export const EnhancedMetrics: React.FC<Props> = ({ 
  serverUrl = 'http://localhost:8080',
  updateInterval = 5000,
  showDetailedMetrics = true
}) => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('📊 Connected to metrics server');
      
      // Subscribe to metrics updates
      newSocket.emit('metrics:subscribe');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('📊 Disconnected from metrics server');
    });

    newSocket.on('metrics:initial', (data: MetricsData) => {
      setMetrics(data);
      setLastUpdate(new Date());
      console.log('📊 Received initial metrics:', data);
    });

    newSocket.on('metrics:update', (data: MetricsData) => {
      setMetrics(data);
      setLastUpdate(new Date());
    });

    return () => {
      newSocket.emit('metrics:unsubscribe');
      newSocket.close();
    };
  }, [serverUrl]);

  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num === undefined || num === null) return 'N/A';
    return num.toFixed(decimals);
  };

  const formatPercentage = (num: number): string => {
    return `${(num * 100).toFixed(1)}%`;
  };

  const getStatusColor = (rate: number): string => {
    if (rate >= 0.9) return 'success';
    if (rate >= 0.7) return 'warning';
    return 'error';
  };

  const getTrendIcon = (trend: number): string => {
    if (trend > 0.01) return '📈';
    if (trend < -0.01) return '📉';
    return '➡️';
  };

  if (!isConnected) {
    return (
      <div className="enhanced-metrics loading">
        <div className="status-indicator connecting">
          <span className="spinner"></span>
          Conectando ao servidor de métricas...
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="enhanced-metrics loading">
        <div className="status-indicator">
          Aguardando dados de métricas...
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-metrics">
      <div className="metrics-header">
        <h3>📊 Métricas do Sistema Enhanced</h3>
        <div className="connection-status connected">
          <span className="status-dot"></span>
          Conectado
        </div>
        {lastUpdate && (
          <div className="last-update">
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="metrics-grid">
        {/* Enhanced Agent Manager Metrics */}
        {metrics.enhanced && (
          <div className="metric-card enhanced-card">
            <div className="card-header">
              <h4>🤖 Enhanced Agent Manager</h4>
            </div>
            <div className="card-content">
              <div className="metric-row">
                <span className="metric-label">Total de Tarefas:</span>
                <span className="metric-value">{metrics.enhanced.totalTasks}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Taxa de Sucesso:</span>
                <span className={`metric-value ${getStatusColor(metrics.enhanced.successRate)}`}>
                  {formatPercentage(metrics.enhanced.successRate)}
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Tempo Médio:</span>
                <span className="metric-value">{metrics.enhanced.avgResponseTime}ms</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Tokens Usados:</span>
                <span className="metric-value">{metrics.enhanced.totalTokensUsed.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Quality Controller Metrics */}
        {metrics.quality && (
          <div className="metric-card quality-card">
            <div className="card-header">
              <h4>🔍 Controle de Qualidade</h4>
            </div>
            <div className="card-content">
              <div className="metric-row">
                <span className="metric-label">Avaliações:</span>
                <span className="metric-value">{metrics.quality.totalEvaluations}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Score Médio:</span>
                <span className={`metric-value ${getStatusColor(metrics.quality.averageScore / 10)}`}>
                  {formatNumber(metrics.quality.averageScore, 2)}/10
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Taxa de Aprovação:</span>
                <span className={`metric-value ${getStatusColor(metrics.quality.successRate)}`}>
                  {formatPercentage(metrics.quality.successRate)}
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Tendência:</span>
                <span className="metric-value">
                  {getTrendIcon(metrics.quality.improvementTrend)} {formatNumber(metrics.quality.improvementTrend, 3)}
                </span>
              </div>
              {showDetailedMetrics && metrics.quality.currentThresholds && (
                <div className="thresholds">
                  <div className="threshold-item">
                    <span>Mínimo: {formatNumber(metrics.quality.currentThresholds.minimum, 2)}</span>
                  </div>
                  <div className="threshold-item">
                    <span>Alvo: {formatNumber(metrics.quality.currentThresholds.target, 2)}</span>
                  </div>
                  <div className="threshold-item">
                    <span>Excelente: {formatNumber(metrics.quality.currentThresholds.excellent, 2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Worker Pool Metrics */}
        {metrics.workers && (
          <div className="metric-card workers-card">
            <div className="card-header">
              <h4>⚙️ Pool de Workers</h4>
            </div>
            <div className="card-content">
              <div className="metric-row">
                <span className="metric-label">Utilização:</span>
                <span className={`metric-value ${getStatusColor(1 - metrics.workers.utilization)}`}>
                  {formatPercentage(metrics.workers.utilization)}
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Tarefas Completas:</span>
                <span className="metric-value">{metrics.workers.pool.completedTasks}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Tarefas Falharam:</span>
                <span className="metric-value error">{metrics.workers.pool.failedTasks}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Tempo Médio:</span>
                <span className="metric-value">{metrics.workers.pool.avgExecutionTime}ms</span>
              </div>
              {showDetailedMetrics && (
                <div className="workers-list">
                  <h5>Workers Ativos:</h5>
                  {metrics.workers.workers.slice(0, 3).map(worker => (
                    <div key={worker.id} className="worker-item">
                      <span className={`worker-status ${worker.status}`}></span>
                      <span className="worker-id">{worker.id}</span>
                      <span className={`worker-rate ${getStatusColor(worker.successRate)}`}>
                        {formatPercentage(worker.successRate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orchestrator Metrics */}
        {metrics.orchestrator && (
          <div className="metric-card orchestrator-card">
            <div className="card-header">
              <h4>🎭 Orchestrator</h4>
            </div>
            <div className="card-content">
              <div className="metric-row">
                <span className="metric-label">Tarefas Ativas:</span>
                <span className="metric-value">{metrics.orchestrator.activeTasks}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Performance Summary */}
      <div className="performance-summary">
        <div className="summary-item">
          <div className="summary-icon">🚀</div>
          <div className="summary-content">
            <div className="summary-title">Performance Geral</div>
            <div className="summary-value">
              {metrics.enhanced && metrics.quality ? (
                <span className={getStatusColor((metrics.enhanced.successRate + metrics.quality.successRate) / 2)}>
                  {formatPercentage((metrics.enhanced.successRate + metrics.quality.successRate) / 2)}
                </span>
              ) : 'N/A'}
            </div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">⚡</div>
          <div className="summary-content">
            <div className="summary-title">Eficiência</div>
            <div className="summary-value">
              {metrics.enhanced ? (
                `${metrics.enhanced.avgResponseTime}ms`
              ) : 'N/A'}
            </div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">🎯</div>
          <div className="summary-content">
            <div className="summary-title">Qualidade</div>
            <div className="summary-value">
              {metrics.quality ? (
                <span className={getStatusColor(metrics.quality.averageScore / 10)}>
                  {formatNumber(metrics.quality.averageScore, 1)}/10
                </span>
              ) : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMetrics;