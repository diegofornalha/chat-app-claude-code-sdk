import React, { useState, useEffect } from 'react';
import { ChevronDown, Bot, Users, Brain, Check, AlertCircle } from 'lucide-react';

interface Agent {
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  capabilities: string[];
}

interface AgentSelectorProps {
  socket: any;
  onAgentSelect: (agent: string | null) => void;
  selectedAgent: string | null;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({ socket, onAgentSelect, selectedAgent }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Solicitar lista de agentes ao conectar
    if (socket) {
      socket.emit('a2a:get_agents');

      // Escutar atualizações de agentes
      socket.on('a2a:agents', (data: { agents: Agent[] }) => {
        setAgents(data.agents);
        setLoading(false);
        
        // Claude (Direto) é o padrão - não selecionar agentes A2A automaticamente
      });

      socket.on('a2a:agent_registered', (agent: Agent) => {
        setAgents(prev => [...prev.filter(a => a.name !== agent.name), agent]);
      });

      socket.on('a2a:agent_selected', (data: { success: boolean; agent: Agent }) => {
        if (data.success) {
          setIsOpen(false);
        }
      });

      socket.on('a2a:error', (data: { error: string }) => {
        console.error('A2A Error:', data.error);
        setLoading(false);
      });
    }

    return () => {
      if (socket) {
        socket.off('a2a:agents');
        socket.off('a2a:agent_registered');
        socket.off('a2a:agent_selected');
        socket.off('a2a:error');
      }
    };
  }, [socket, selectedAgent]);

  const handleSelectAgent = (agentName: string | null) => {
    setLoading(true);
    
    if (agentName === null) {
      // Desselecionar agente (usar Claude direto)
      socket.emit('a2a:select_agent', { agent: null });
      onAgentSelect(null);
      setIsOpen(false);
      setLoading(false);
    } else {
      // Selecionar agente A2A
      socket.emit('a2a:select_agent', { agent: agentName });
      onAgentSelect(agentName);
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'assistant':
        return <Bot className="w-4 h-4" />;
      case 'team':
        return <Users className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const selectedAgentData = agents.find(a => a.name === selectedAgent);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {selectedAgent ? (
          <>
            {getAgentIcon(selectedAgentData?.type || 'assistant')}
            <span className="font-medium">{selectedAgent}</span>
            <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedAgentData?.status || 'disconnected')}`} />
          </>
        ) : (
          <>
            <Bot className="w-4 h-4" />
            <span>Claude (Direto)</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-72 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="p-2">
            <div className="text-xs text-gray-400 px-2 py-1 uppercase tracking-wider">
              Agentes Disponíveis
            </div>

            {/* Opção Claude Direto */}
            <button
              onClick={() => handleSelectAgent(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors ${
                !selectedAgent ? 'bg-gray-700' : ''
              }`}
            >
              <Bot className="w-5 h-5 text-blue-400" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-200">Claude (Direto)</div>
                <div className="text-xs text-gray-400">Conexão direta com Claude Code SDK</div>
              </div>
              {!selectedAgent && <Check className="w-4 h-4 text-green-400" />}
            </button>

            {/* Separador */}
            <div className="border-t border-gray-700 my-2" />

            {/* Agentes A2A */}
            {agents.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhum agente A2A disponível
              </div>
            ) : (
              agents.map(agent => (
                <button
                  key={agent.name}
                  onClick={() => handleSelectAgent(agent.name)}
                  disabled={agent.status !== 'connected'}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 transition-colors ${
                    selectedAgent === agent.name ? 'bg-gray-700' : ''
                  } ${agent.status !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {getAgentIcon(agent.type)}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-200">{agent.name}</span>
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                    </div>
                    <div className="text-xs text-gray-400">
                      {agent.type === 'team' ? 'Equipe de agentes' : 'Agente assistente'}
                    </div>
                    {agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.capabilities.slice(0, 3).map((cap, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-300"
                          >
                            {cap.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{agent.capabilities.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedAgent === agent.name && <Check className="w-4 h-4 text-green-400" />}
                </button>
              ))
            )}

            {/* Info sobre A2A */}
            <div className="border-t border-gray-700 mt-2 pt-2 px-3 pb-2">
              <div className="text-xs text-gray-500">
                Agentes A2A permitem capacidades especializadas como processamento em equipe,
                tomada de decisão autônoma e aprendizagem contínua.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
        </div>
      )}
    </div>
  );
};

export default AgentSelector;