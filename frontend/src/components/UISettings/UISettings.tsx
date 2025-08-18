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
          {/* Seção Visualização */}
          <div className="ui-settings-section">
            <h3>📊 VISUALIZAÇÃO</h3>
            
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