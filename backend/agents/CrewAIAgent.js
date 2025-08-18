/**
 * CrewAIAgent - Agente específico para CrewAI
 * Herda de BaseAgent e implementa lógica específica do CrewAI
 */

const BaseAgent = require('./BaseAgent');
const axios = require('axios');

class CrewAIAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'crew-ai',
      url: config.url || 'http://localhost:8004',
      type: 'team',
      version: '2.0.0',
      description: 'CrewAI Multi-Agent System for complex tasks',
      capabilities: [
        'data_extraction',
        'pattern_analysis',
        'report_generation',
        'multi_agent_coordination',
        'workflow_execution',
        'task_delegation'
      ],
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutos para CrewAI
      ...config
    });
    
    // Configurações específicas do CrewAI
    this.agents = config.agents || ['data_extractor', 'pattern_analyzer', 'report_generator'];
    this.maxConcurrentTasks = config.maxConcurrentTasks || 3;
    this.streamingEnabled = config.streamingEnabled || true;
    
    // Fila de tarefas para processamento
    this.taskQueue = [];
    this.processingTasks = new Map();
  }

  /**
   * Sobrescreve executeTask para usar API do CrewAI
   */
  async executeTask(task) {
    const { message, context, intent, options = {} } = task;
    
    console.log(`🤝 CrewAI processando: "${message?.substring(0, 50)}..."`);
    
    try {
      // Preparar payload para CrewAI
      const payload = {
        task: message,
        context: {
          ...context,
          intent: intent || 'general_analysis',
          timestamp: Date.now()
        },
        streaming: options.streaming || this.streamingEnabled,
        parameters: options.parameters || {}
      };
      
      // Enviar para CrewAI
      const response = await axios.post(`${this.url}/tasks`, payload, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId()
        }
      });
      
      const { task_id, status, streaming_url } = response.data;
      
      // Se streaming está habilitado, monitorar progresso
      if (this.streamingEnabled && streaming_url) {
        return await this.monitorTaskProgress(task_id, streaming_url);
      }
      
      // Caso contrário, aguardar resultado
      return await this.waitForTaskCompletion(task_id);
      
    } catch (error) {
      console.error(`❌ Erro no CrewAI Agent:`, error);
      throw new Error(`CrewAI processing failed: ${error.message}`);
    }
  }

  /**
   * Monitora o progresso de uma tarefa com streaming
   */
  async monitorTaskProgress(taskId, streamingUrl) {
    const updates = [];
    let finalResult = null;
    const maxAttempts = 60; // 60 segundos máximo
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${this.url}${streamingUrl}`, {
          timeout: 5000
        });
        
        const { status, progress, result, updates: newUpdates } = response.data;
        
        if (newUpdates) {
          updates.push(...newUpdates);
          this.emit('task:progress', { taskId, updates: newUpdates });
        }
        
        if (status === 'completed') {
          finalResult = result;
          break;
        } else if (status === 'failed') {
          throw new Error(`Task ${taskId} failed`);
        }
        
        // Aguardar antes da próxima verificação
        await this.delay(1000);
        attempts++;
        
      } catch (error) {
        if (error.response?.status === 404) {
          // Task não encontrada ainda
          await this.delay(1000);
          attempts++;
        } else {
          throw error;
        }
      }
    }
    
    if (!finalResult && attempts >= maxAttempts) {
      throw new Error(`Task ${taskId} timeout`);
    }
    
    return {
      success: true,
      agent: this.name,
      taskId,
      result: finalResult,
      updates,
      metadata: {
        processingTime: attempts * 1000,
        agentsUsed: this.extractAgentsUsed(finalResult),
        cached: false
      }
    };
  }

  /**
   * Aguarda conclusão de uma tarefa (sem streaming)
   */
  async waitForTaskCompletion(taskId) {
    const maxAttempts = 60;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${this.url}/tasks/${taskId}`, {
          timeout: 5000
        });
        
        const { status, result } = response.data;
        
        if (status === 'completed') {
          return {
            success: true,
            agent: this.name,
            taskId,
            result,
            metadata: {
              processingTime: attempts * 1000,
              agentsUsed: this.extractAgentsUsed(result),
              cached: false
            }
          };
        } else if (status === 'failed') {
          throw new Error(`Task ${taskId} failed`);
        }
        
        await this.delay(1000);
        attempts++;
        
      } catch (error) {
        if (error.response?.status === 404) {
          await this.delay(1000);
          attempts++;
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(`Task ${taskId} timeout`);
  }

  /**
   * Extração de dados especializada
   */
  async extractData(text) {
    const task = {
      message: text,
      intent: 'data_extraction',
      options: {
        parameters: {
          extract_numbers: true,
          extract_dates: true,
          extract_entities: true,
          extract_patterns: true
        }
      }
    };
    
    return this.process(task);
  }

  /**
   * Análise de padrões
   */
  async analyzePatterns(data) {
    const task = {
      message: typeof data === 'string' ? data : JSON.stringify(data),
      intent: 'pattern_analysis',
      options: {
        parameters: {
          analyze_trends: true,
          find_anomalies: true,
          identify_correlations: true
        }
      }
    };
    
    return this.process(task);
  }

  /**
   * Geração de relatório
   */
  async generateReport(data, format = 'summary') {
    const task = {
      message: typeof data === 'string' ? data : JSON.stringify(data),
      intent: 'report_generation',
      options: {
        parameters: {
          format: format, // summary, detailed, executive
          include_visualizations: false,
          language: 'pt-BR'
        }
      }
    };
    
    return this.process(task);
  }

  /**
   * Execução de workflow complexo
   */
  async executeWorkflow(workflow) {
    const tasks = workflow.steps || [];
    const results = [];
    
    for (const step of tasks) {
      const result = await this.process({
        message: step.task,
        context: {
          step: step.name,
          previousResults: results
        },
        options: step.options
      });
      
      results.push({
        step: step.name,
        result
      });
      
      // Verificar condições de parada
      if (step.stopOnFailure && !result.success) {
        break;
      }
    }
    
    return {
      workflow: workflow.name,
      results,
      success: results.every(r => r.result.success)
    };
  }

  /**
   * Delegação para agentes específicos
   */
  async delegateToAgent(agentName, task) {
    const response = await axios.post(`${this.url}/delegate`, {
      agent: agentName,
      task: task
    }, {
      timeout: this.timeout
    });
    
    return response.data;
  }

  /**
   * Health check específico do CrewAI
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.url}/health`, {
        timeout: 5000
      });
      
      this.lastHealthCheck = Date.now();
      
      // Verificar status de todos os agentes
      const agentsHealthy = response.data.agents?.every(a => a.status === 'healthy') ?? true;
      
      this.status = response.status === 200 && agentsHealthy ? 'healthy' : 'unhealthy';
      
      return this.status === 'healthy';
    } catch (error) {
      this.status = 'unhealthy';
      return false;
    }
  }

  /**
   * Descoberta de agentes disponíveis
   */
  async discoverAgents() {
    try {
      const response = await axios.get(`${this.url}/discover`, {
        timeout: 5000
      });
      
      this.agents = response.data.agents || [];
      
      console.log(`🔍 CrewAI descobriu ${this.agents.length} agentes`);
      
      return this.agents;
    } catch (error) {
      console.error(`❌ Falha na descoberta de agentes CrewAI:`, error.message);
      return this.agents;
    }
  }

  /**
   * Extrai agentes usados do resultado
   */
  extractAgentsUsed(result) {
    if (!result) return [];
    
    if (result.agents_used) {
      return result.agents_used;
    }
    
    if (result.metadata?.agents) {
      return result.metadata.agents;
    }
    
    // Tentar detectar pelos campos do resultado
    const detected = [];
    if (result.extraction) detected.push('data_extractor');
    if (result.pattern_analysis) detected.push('pattern_analyzer');
    if (result.report) detected.push('report_generator');
    
    return detected.length > 0 ? detected : ['unknown'];
  }

  /**
   * Retorna informações específicas do CrewAI
   */
  getInfo() {
    return {
      ...super.getInfo(),
      agents: this.agents,
      maxConcurrentTasks: this.maxConcurrentTasks,
      streamingEnabled: this.streamingEnabled,
      queueSize: this.taskQueue.length,
      processingTasks: this.processingTasks.size
    };
  }
}

module.exports = CrewAIAgent;