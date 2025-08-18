/**
 * AgentManager - Gerenciador central de agentes
 * Inspirado no sistema de descoberta e orquestração do Mesop
 */

const EventEmitter = require('events');
const axios = require('axios');
const ClaudeAgent = require('../agents/ClaudeAgent');
const CrewAIAgent = require('../agents/CrewAIAgent');
const BaseAgent = require('../agents/BaseAgent');
const { getAsyncPoller } = require('./AsyncPoller');

class AgentManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuração
    this.config = {
      discoveryInterval: config.discoveryInterval || 30000, // 30 segundos
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minuto
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      enableAutoDiscovery: config.enableAutoDiscovery !== false,
      ...config
    };
    
    // Registro de agentes
    this.agents = new Map(); // name -> agent instance
    this.agentTypes = new Map(); // type -> [agent names]
    this.agentCapabilities = new Map(); // capability -> [agent names]
    
    // Tarefas e sessões
    this.activeTasks = new Map(); // taskId -> taskInfo
    this.sessions = new Map(); // sessionId -> sessionInfo
    
    // Poller para tarefas assíncronas
    this.poller = getAsyncPoller({ interval: 1000 });
    
    // Métricas
    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Inicializa o gerenciador
   */
  async initialize() {
    console.log('🚀 Inicializando AgentManager...');
    
    try {
      // Registrar agentes padrão
      await this.registerDefaultAgents();
      
      // Iniciar descoberta automática se habilitada
      if (this.config.enableAutoDiscovery) {
        this.startAutoDiscovery();
      }
      
      // Iniciar poller
      this.poller.start();
      
      // Configurar listeners do poller
      this.setupPollerListeners();
      
      console.log(`✅ AgentManager inicializado com ${this.agents.size} agentes`);
      
      return true;
    } catch (error) {
      console.error('❌ Falha ao inicializar AgentManager:', error);
      return false;
    }
  }

  /**
   * Registra agentes padrão
   */
  async registerDefaultAgents() {
    // Registrar Claude
    const claudeAgent = new ClaudeAgent({
      systemPrompt: 'Você é um assistente útil que responde em português.'
    });
    
    if (await claudeAgent.initialize()) {
      this.registerAgent(claudeAgent);
    }
    
    // Registrar CrewAI
    const crewAIAgent = new CrewAIAgent();
    
    if (await crewAIAgent.initialize()) {
      this.registerAgent(crewAIAgent);
    }
  }

  /**
   * Registra um agente
   */
  registerAgent(agent) {
    if (!(agent instanceof BaseAgent)) {
      throw new Error('Agent must extend BaseAgent');
    }
    
    const name = agent.name;
    
    // Adicionar ao registro principal
    this.agents.set(name, agent);
    
    // Indexar por tipo
    if (!this.agentTypes.has(agent.type)) {
      this.agentTypes.set(agent.type, []);
    }
    this.agentTypes.get(agent.type).push(name);
    
    // Indexar por capacidades
    for (const capability of agent.capabilities) {
      if (!this.agentCapabilities.has(capability)) {
        this.agentCapabilities.set(capability, []);
      }
      this.agentCapabilities.get(capability).push(name);
    }
    
    // Configurar listeners do agente
    this.setupAgentListeners(agent);
    
    console.log(`✅ Agente registrado: ${name} (${agent.type})`);
    this.emit('agent:registered', { agent: name, info: agent.getInfo() });
  }

  /**
   * Remove um agente
   */
  async unregisterAgent(agentName) {
    const agent = this.agents.get(agentName);
    
    if (!agent) {
      console.warn(`⚠️ Agente não encontrado: ${agentName}`);
      return false;
    }
    
    // Desligar o agente
    await agent.shutdown();
    
    // Remover dos registros
    this.agents.delete(agentName);
    
    // Remover dos índices
    const type = agent.type;
    if (this.agentTypes.has(type)) {
      const agents = this.agentTypes.get(type);
      const index = agents.indexOf(agentName);
      if (index > -1) {
        agents.splice(index, 1);
      }
    }
    
    for (const capability of agent.capabilities) {
      if (this.agentCapabilities.has(capability)) {
        const agents = this.agentCapabilities.get(capability);
        const index = agents.indexOf(agentName);
        if (index > -1) {
          agents.splice(index, 1);
        }
      }
    }
    
    console.log(`✅ Agente removido: ${agentName}`);
    this.emit('agent:unregistered', { agent: agentName });
    
    return true;
  }

  /**
   * Processa uma tarefa escolhendo o melhor agente
   */
  async processTask(task, options = {}) {
    const taskId = this.generateTaskId();
    const startTime = Date.now();
    
    try {
      // Registrar tarefa
      this.activeTasks.set(taskId, {
        id: taskId,
        task,
        status: 'analyzing',
        createdAt: startTime
      });
      
      // Adicionar ao poller para monitoramento
      this.poller.addTask(taskId, { task, options });
      
      // Analisar intenção se não fornecida
      let intent = task.intent;
      if (!intent) {
        const claudeAgent = this.agents.get('claude');
        if (claudeAgent && claudeAgent instanceof ClaudeAgent) {
          intent = await claudeAgent.analyzeIntent(task.message);
          task.intent = intent;
        }
      }
      
      // Escolher agente baseado na análise
      const selectedAgent = this.selectBestAgent(task, intent);
      
      if (!selectedAgent) {
        throw new Error('No suitable agent found');
      }
      
      console.log(`🎯 Tarefa ${taskId} atribuída ao agente: ${selectedAgent.name}`);
      
      // Atualizar status
      this.updateTaskStatus(taskId, 'processing', { agent: selectedAgent.name });
      
      // Processar com o agente selecionado
      const result = await selectedAgent.process(task);
      
      // Se CrewAI foi usado e temos Claude, formatar resposta
      if (selectedAgent.name === 'crew-ai' && intent?.suggested_agent === 'both') {
        const claudeAgent = this.agents.get('claude');
        if (claudeAgent && claudeAgent instanceof ClaudeAgent) {
          const formatted = await claudeAgent.formatResponse(
            task.message,
            intent,
            result
          );
          result.formattedResponse = formatted.result;
        }
      }
      
      // Atualizar métricas
      this.updateMetrics(Date.now() - startTime, true);
      
      // Marcar como completo
      this.updateTaskStatus(taskId, 'completed', { result });
      
      // Remover tarefa ativa após um delay
      setTimeout(() => {
        this.activeTasks.delete(taskId);
        this.poller.removeTask(taskId);
      }, 5000);
      
      return {
        taskId,
        success: true,
        agent: selectedAgent.name,
        result,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error(`❌ Erro processando tarefa ${taskId}:`, error);
      
      this.updateMetrics(Date.now() - startTime, false);
      this.updateTaskStatus(taskId, 'failed', { error: error.message });
      
      setTimeout(() => {
        this.activeTasks.delete(taskId);
        this.poller.removeTask(taskId);
      }, 5000);
      
      throw error;
    }
  }

  /**
   * Seleciona o melhor agente para uma tarefa
   */
  selectBestAgent(task, intent) {
    // Se agente específico foi solicitado
    if (task.agent) {
      return this.agents.get(task.agent);
    }
    
    // Se temos análise de intenção
    if (intent?.suggested_agent) {
      const suggested = this.agents.get(intent.suggested_agent);
      if (suggested && suggested.status === 'healthy') {
        return suggested;
      }
    }
    
    // Baseado em capacidades necessárias
    if (task.requiredCapabilities) {
      for (const capability of task.requiredCapabilities) {
        const agentNames = this.agentCapabilities.get(capability) || [];
        for (const name of agentNames) {
          const agent = this.agents.get(name);
          if (agent && agent.status === 'healthy') {
            return agent;
          }
        }
      }
    }
    
    // Baseado no tipo de intenção
    if (intent?.intent) {
      switch (intent.intent) {
        case 'data_extraction':
        case 'pattern_analysis':
        case 'report_generation':
          const crewAI = this.agents.get('crew-ai');
          if (crewAI && crewAI.status === 'healthy') {
            return crewAI;
          }
          break;
          
        case 'code_task':
        case 'general_query':
        default:
          const claude = this.agents.get('claude');
          if (claude && claude.status === 'healthy') {
            return claude;
          }
          break;
      }
    }
    
    // Fallback: primeiro agente healthy
    for (const agent of this.agents.values()) {
      if (agent.status === 'healthy') {
        return agent;
      }
    }
    
    return null;
  }

  /**
   * Atualiza status de uma tarefa
   */
  updateTaskStatus(taskId, status, data = {}) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      Object.assign(task, data);
      
      this.emit('task:updated', { taskId, status, ...data });
    }
  }

  /**
   * Descoberta automática de agentes
   */
  startAutoDiscovery() {
    console.log('🔍 Iniciando descoberta automática de agentes...');
    
    // Descoberta inicial
    this.discoverAgents();
    
    // Descoberta periódica
    this.discoveryInterval = setInterval(() => {
      this.discoverAgents();
    }, this.config.discoveryInterval);
  }

  /**
   * Descobre novos agentes
   */
  async discoverAgents() {
    // Lista de URLs conhecidas para verificar
    const knownUrls = [
      'http://localhost:8001', // Claude
      'http://localhost:8002', // Outro agente
      'http://localhost:8003', // Outro agente
      'http://localhost:8004', // CrewAI
      'http://localhost:8005', // Outro agente
    ];
    
    for (const url of knownUrls) {
      try {
        // Verificar se já temos este agente
        const existingAgent = Array.from(this.agents.values())
          .find(a => a.url === url);
        
        if (existingAgent) {
          continue;
        }
        
        // Tentar descobrir
        const response = await axios.get(`${url}/.well-known/agent.json`, {
          timeout: 2000
        });
        
        const agentInfo = response.data;
        
        // Criar novo agente genérico
        const newAgent = new BaseAgent({
          name: agentInfo.name || `agent-${Date.now()}`,
          url: url,
          type: agentInfo.type || 'generic',
          capabilities: agentInfo.capabilities || [],
          description: agentInfo.description
        });
        
        if (await newAgent.initialize()) {
          this.registerAgent(newAgent);
          console.log(`🆕 Novo agente descoberto: ${newAgent.name} em ${url}`);
        }
        
      } catch (error) {
        // Silenciosamente ignorar URLs sem agentes
      }
    }
  }

  /**
   * Configura listeners do poller
   */
  setupPollerListeners() {
    this.poller.on('task:updated', (data) => {
      this.emit('task:progress', data);
    });
    
    this.poller.on('task:completed', (data) => {
      this.emit('task:completed', data);
    });
    
    this.poller.on('task:failed', (data) => {
      this.emit('task:failed', data);
    });
  }

  /**
   * Configura listeners de um agente
   */
  setupAgentListeners(agent) {
    agent.on('healthy', (data) => {
      console.log(`✅ Agente ${data.agent} está healthy`);
      this.emit('agent:healthy', data);
    });
    
    agent.on('unhealthy', (data) => {
      console.log(`⚠️ Agente ${data.agent} está unhealthy`);
      this.emit('agent:unhealthy', data);
    });
    
    agent.on('error', (data) => {
      console.error(`❌ Erro no agente ${data.agent}:`, data.error);
      this.emit('agent:error', data);
    });
  }

  /**
   * Atualiza métricas
   */
  updateMetrics(processingTime, success) {
    this.metrics.totalTasks++;
    
    if (success) {
      this.metrics.successfulTasks++;
    } else {
      this.metrics.failedTasks++;
    }
    
    // Atualizar tempo médio
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalTasks - 1);
    this.metrics.averageProcessingTime = (totalTime + processingTime) / this.metrics.totalTasks;
  }

  /**
   * Utilitários
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Retorna informações do gerenciador
   */
  getInfo() {
    return {
      agents: Array.from(this.agents.values()).map(a => a.getInfo()),
      activeTasks: this.activeTasks.size,
      sessions: this.sessions.size,
      metrics: this.metrics,
      poller: this.poller.getMetrics()
    };
  }

  /**
   * Retorna lista de agentes
   */
  getAgents() {
    return Array.from(this.agents.values()).map(a => ({
      name: a.name,
      type: a.type,
      status: a.status,
      capabilities: a.capabilities,
      url: a.url
    }));
  }

  /**
   * Retorna agente específico
   */
  getAgent(name) {
    return this.agents.get(name);
  }

  /**
   * Desliga o gerenciador
   */
  async shutdown() {
    console.log('🛑 Desligando AgentManager...');
    
    // Parar descoberta
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    // Parar poller
    this.poller.stop();
    
    // Desligar todos os agentes
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }
    
    this.agents.clear();
    this.activeTasks.clear();
    this.sessions.clear();
    
    console.log('✅ AgentManager desligado');
  }
}

// Singleton
let managerInstance = null;

function getAgentManager(config) {
  if (!managerInstance) {
    managerInstance = new AgentManager(config);
  }
  return managerInstance;
}

module.exports = {
  AgentManager,
  getAgentManager
};