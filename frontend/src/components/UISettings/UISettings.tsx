import React from 'react';
import './UISettings.css';

interface UISettingsProps {
  settings: {
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
    expandedByDefault: boolean;
    processingViewMode?: 'minimize' | 'compact' | 'full' | 'hidden';
    messageViewMode?: 'minimal' | 'standard' | 'detailed' | 'developer';
    
    // Processing Steps Control
    showSystemStep: boolean;
    showInitializingStep: boolean;
    showConnectingStep: boolean;
    showThinkingStep: boolean;
    showToolSteps: boolean;
    showStreamingStep: boolean;
    showFinalizingStep: boolean;
  };
  onSettingsChange: (settings: any) => void;
  onClose: () => void;
}

export const UISettings: React.FC<UISettingsProps> = ({ 
  settings, 
  onSettingsChange, 
  onClose 
}) => {
  const handleToggle = (key: string) => {
    onSettingsChange({ [key]: !settings[key as keyof typeof settings] });
  };

  return (
    <div className="ui-settings-overlay" onClick={onClose}>
      <div className="ui-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ui-settings-header">
          <h2>⚙️ Configurações de Interface</h2>
          <button className="ui-settings-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="ui-settings-content">
          {/* Seção Modos de Visualização */}
          <div className="ui-settings-section">
            <h3>🎨 MODOS DE VISUALIZAÇÃO</h3>
            
            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="processingViewMode">
                  Modo de Processamento
                </label>
                <p className="ui-setting-description">
                  Como exibir indicadores de processamento e logs
                </p>
              </div>
              <select
                id="processingViewMode"
                className="ui-select"
                value={settings.processingViewMode || 'minimize'}
                onChange={(e) => onSettingsChange({ processingViewMode: e.target.value })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="hidden">🚫 Oculto - Sem indicadores</option>
                <option value="minimize">📦 Minimizado - Apenas ícone</option>
                <option value="compact">📊 Compacto - Info básica</option>
                <option value="full">📈 Completo - Todos detalhes</option>
              </select>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="messageViewMode">
                  Modo de Mensagens
                </label>
                <p className="ui-setting-description">
                  Nível de detalhes nas mensagens do chat
                </p>
              </div>
              <select
                id="messageViewMode"
                className="ui-select"
                value={settings.messageViewMode || 'standard'}
                onChange={(e) => onSettingsChange({ messageViewMode: e.target.value })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="minimal">💬 Mínimo - Apenas texto</option>
                <option value="standard">📝 Padrão - Com metadados</option>
                <option value="detailed">📋 Detalhado - Info completa</option>
                <option value="developer">🔧 Developer - Debug mode</option>
              </select>
            </div>
          </div>

          {/* Seção Visualização */}
          <div className="ui-settings-section">
            <h3>📊 OPÇÕES DE VISUALIZAÇÃO</h3>
            
            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showProcessingLogs">
                  Logs de Processamento
                </label>
                <p className="ui-setting-description">
                  Exibe detalhes técnicos durante o processamento das mensagens
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showProcessingLogs"
                  type="checkbox"
                  checked={settings.showProcessingLogs}
                  onChange={() => handleToggle('showProcessingLogs')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showDetailedMetrics">
                  Métricas Detalhadas
                </label>
                <p className="ui-setting-description">
                  Mostra informações avançadas de performance e estatísticas
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showDetailedMetrics"
                  type="checkbox"
                  checked={settings.showDetailedMetrics}
                  onChange={() => handleToggle('showDetailedMetrics')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="autoExpandLogs">
                  Auto-expandir Logs
                </label>
                <p className="ui-setting-description">
                  Expande automaticamente os detalhes dos logs quando disponíveis
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="autoExpandLogs"
                  type="checkbox"
                  checked={settings.autoExpandLogs}
                  onChange={() => handleToggle('autoExpandLogs')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="expandedByDefault">
                  📄 Mensagens Expandidas por Padrão
                </label>
                <p className="ui-setting-description">
                  Mostra mensagens longas completamente expandidas ao invés de colapsadas
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="expandedByDefault"
                  type="checkbox"
                  checked={settings.expandedByDefault}
                  onChange={() => handleToggle('expandedByDefault')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showTimestamps">
                  Timestamps Detalhados
                </label>
                <p className="ui-setting-description">
                  Mostra horário completo com milissegundos em cada mensagem
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showTimestamps"
                  type="checkbox"
                  checked={settings.showTimestamps}
                  onChange={() => handleToggle('showTimestamps')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showMessageIds">
                  IDs de Mensagens
                </label>
                <p className="ui-setting-description">
                  Exibe identificadores únicos para cada mensagem
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showMessageIds"
                  type="checkbox"
                  checked={settings.showMessageIds}
                  onChange={() => handleToggle('showMessageIds')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Seção Debug */}
          <div className="ui-settings-section">
            <h3>🐛 DEBUG & INFORMAÇÕES</h3>
            
            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showNetworkLatency">
                  Latência de Rede
                </label>
                <p className="ui-setting-description">
                  Mostra tempo de resposta e latência das requisições
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showNetworkLatency"
                  type="checkbox"
                  checked={settings.showNetworkLatency}
                  onChange={() => handleToggle('showNetworkLatency')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showAgentVersions">
                  Versões dos Agentes
                </label>
                <p className="ui-setting-description">
                  Exibe informações de versão e capacidades dos agentes
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showAgentVersions"
                  type="checkbox"
                  checked={settings.showAgentVersions}
                  onChange={() => handleToggle('showAgentVersions')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showTokenUsage">
                  Uso de Tokens
                </label>
                <p className="ui-setting-description">
                  Mostra contagem de tokens de entrada/saída e cache
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showTokenUsage"
                  type="checkbox"
                  checked={settings.showTokenUsage}
                  onChange={() => handleToggle('showTokenUsage')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="enableConsoleLogs">
                  Logs no Console
                </label>
                <p className="ui-setting-description">
                  Habilita logs detalhados no console do navegador (F12)
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="enableConsoleLogs"
                  type="checkbox"
                  checked={settings.enableConsoleLogs}
                  onChange={() => handleToggle('enableConsoleLogs')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showSessionInfo">
                  Informações de Sessão
                </label>
                <p className="ui-setting-description">
                  Exibe ID da sessão, duração e estatísticas
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showSessionInfo"
                  type="checkbox"
                  checked={settings.showSessionInfo}
                  onChange={() => handleToggle('showSessionInfo')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showCostEstimates">
                  Estimativas de Custo
                </label>
                <p className="ui-setting-description">
                  Mostra estimativa de custo por mensagem e total da sessão
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showCostEstimates"
                  type="checkbox"
                  checked={settings.showCostEstimates}
                  onChange={() => handleToggle('showCostEstimates')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Seção Performance */}
          <div className="ui-settings-section">
            <h3>⚡ PERFORMANCE</h3>
            
            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="animationsEnabled">
                  Animações
                </label>
                <p className="ui-setting-description">
                  Habilita animações e transições suaves na interface
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="animationsEnabled"
                  type="checkbox"
                  checked={settings.animationsEnabled}
                  onChange={() => handleToggle('animationsEnabled')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="compactMode">
                  Modo Compacto
                </label>
                <p className="ui-setting-description">
                  Reduz o espaçamento e tamanho dos elementos para mostrar mais conteúdo
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="compactMode"
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={() => handleToggle('compactMode')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Seção Processing Steps Control */}
          <div className="ui-settings-section">
            <h3>⚙️ CONTROLE DE ETAPAS</h3>
            <div className="ui-setting-section-description">
              Configure quais etapas do processamento exibir durante a execução
            </div>
            
            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showSystemStep">
                  System Processing
                </label>
                <p className="ui-setting-description">
                  Mostra etapa "Processing: system" (só relevante com System Prompt configurado)
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showSystemStep"
                  type="checkbox"
                  checked={settings.showSystemStep}
                  onChange={() => handleToggle('showSystemStep')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showInitializingStep">
                  Inicialização
                </label>
                <p className="ui-setting-description">
                  Mostra "Initializing Claude Code SDK..."
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showInitializingStep"
                  type="checkbox"
                  checked={settings.showInitializingStep}
                  onChange={() => handleToggle('showInitializingStep')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showConnectingStep">
                  Conexão
                </label>
                <p className="ui-setting-description">
                  Mostra "Establishing connection to Claude API..."
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showConnectingStep"
                  type="checkbox"
                  checked={settings.showConnectingStep}
                  onChange={() => handleToggle('showConnectingStep')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showThinkingStep">
                  Análise
                </label>
                <p className="ui-setting-description">
                  Mostra "Claude is analyzing your request..."
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showThinkingStep"
                  type="checkbox"
                  checked={settings.showThinkingStep}
                  onChange={() => handleToggle('showThinkingStep')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showToolSteps">
                  Ferramentas
                </label>
                <p className="ui-setting-description">
                  Mostra etapas de execução de ferramentas "Executing tool: [nome]"
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showToolSteps"
                  type="checkbox"
                  checked={settings.showToolSteps}
                  onChange={() => handleToggle('showToolSteps')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showStreamingStep">
                  Streaming
                </label>
                <p className="ui-setting-description">
                  Mostra "Streaming response content..." (geralmente redundante)
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showStreamingStep"
                  type="checkbox"
                  checked={settings.showStreamingStep}
                  onChange={() => handleToggle('showStreamingStep')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>

            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showFinalizingStep">
                  Finalização
                </label>
                <p className="ui-setting-description">
                  Mostra "Finalizing response..." (muito rápido, raramente útil)
                </p>
              </div>
              <label className="ui-toggle">
                <input
                  id="showFinalizingStep"
                  type="checkbox"
                  checked={settings.showFinalizingStep}
                  onChange={() => handleToggle('showFinalizingStep')}
                />
                <span className="ui-toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="ui-settings-footer">
            <div className="ui-settings-info-text">
              💡 Todas as configurações são aplicadas em tempo real
            </div>
            <button className="ui-settings-btn primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};