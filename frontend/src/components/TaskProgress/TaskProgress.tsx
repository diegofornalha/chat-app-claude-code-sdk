/**
 * TaskProgress - Componente para exibir progresso de tarefas em tempo real
 * Inspirado no async_poller.py do Mesop
 */

import React, { useEffect, useState } from 'react';
import { Task } from '../../context/AppContext';
import './TaskProgress.css';

interface TaskProgressProps {
  task: Task;
  showDetails?: boolean;
  onCancel?: (taskId: string) => void;
}

export const TaskProgress: React.FC<TaskProgressProps> = ({
  task,
  showDetails = false,
  onCancel
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (task.status === 'processing') {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - task.createdAt);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [task.status, task.createdAt]);

  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'pending':
        return '#f59e0b';
      case 'processing':
        return '#3b82f6';
      case 'completed':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const getProgressPercentage = () => {
    if (task.status === 'completed') return 100;
    if (task.status === 'failed') return 0;
    if (task.progress !== undefined) return task.progress;
    
    // Estimativa baseada no tempo decorrido (máximo 30s)
    if (task.status === 'processing') {
      const estimatedProgress = Math.min((elapsedTime / 30000) * 100, 95);
      return Math.round(estimatedProgress);
    }
    
    return 0;
  };

  return (
    <div className={`task-progress ${task.status}`}>
      <div className="task-progress-header">
        <div className="task-progress-info">
          <span className="task-status-icon">{getStatusIcon()}</span>
          <span className="task-id">{task.id}</span>
          {task.agent && (
            <span className="task-agent">({task.agent})</span>
          )}
        </div>
        <div className="task-progress-actions">
          {task.status === 'processing' && (
            <span className="task-time">{formatTime(elapsedTime)}</span>
          )}
          {task.status === 'processing' && onCancel && (
            <button
              className="task-cancel-btn"
              onClick={() => onCancel(task.id)}
              title="Cancelar tarefa"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="task-progress-bar-container">
        <div
          className="task-progress-bar"
          style={{
            width: `${getProgressPercentage()}%`,
            backgroundColor: getStatusColor()
          }}
        >
          {task.status === 'processing' && (
            <div className="task-progress-pulse" />
          )}
        </div>
      </div>

      <div className="task-progress-footer">
        <span className="task-status-text">{task.status}</span>
        {task.progress !== undefined && (
          <span className="task-progress-percentage">
            {getProgressPercentage()}%
          </span>
        )}
      </div>

      {showDetails && (
        <div className="task-progress-details">
          {task.error && (
            <div className="task-error">
              <strong>Erro:</strong> {task.error}
            </div>
          )}
          {task.result && (
            <div className="task-result">
              <strong>Resultado:</strong>
              <pre>{JSON.stringify(task.result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente para lista de tarefas
interface TaskListProps {
  tasks: Task[];
  showOnlyActive?: boolean;
  showDetails?: boolean;
  onCancel?: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  showOnlyActive = false,
  showDetails = false,
  onCancel
}) => {
  const filteredTasks = showOnlyActive
    ? tasks.filter(t => t.status === 'pending' || t.status === 'processing')
    : tasks;

  if (filteredTasks.length === 0) {
    return (
      <div className="task-list-empty">
        <span>Nenhuma tarefa {showOnlyActive ? 'ativa' : 'encontrada'}</span>
      </div>
    );
  }

  return (
    <div className="task-list">
      {filteredTasks.map(task => (
        <TaskProgress
          key={task.id}
          task={task}
          showDetails={showDetails}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
};