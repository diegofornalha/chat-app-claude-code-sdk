import React from 'react';
import './UISettings.css';

interface UISettingsProps {
  settings: {
    showProcessingLogs: boolean;
    showDetailedMetrics: boolean;
    autoExpandLogs: boolean;
    animationsEnabled: boolean;
    compactMode: boolean;
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
          <h2>Configurações de Interface</h2>
          <button className="ui-settings-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="ui-settings-content">
          <div className="ui-settings-section">
            <h3>Visualização</h3>
            
            <div className="ui-setting-item">
              <div className="ui-setting-info">
                <label htmlFor="showProcessingLogs">
                  Mostrar Logs de Processamento
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
          </div>

          <div className="ui-settings-section">
            <h3>Performance</h3>
            
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
            <button className="ui-settings-btn secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="ui-settings-btn primary" onClick={onClose}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};