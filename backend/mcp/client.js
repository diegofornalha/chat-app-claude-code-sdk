/**
 * MCP Client para Neo4j Memory
 * Usa stdio transport para evitar conflitos com WebSocket
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');

class MCPClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.mcpProcess = null;
    this.connected = false;
    this.requestQueue = [];
    this.responseHandlers = new Map();
    this.requestId = 0;
    
    // Configurações
    this.config = {
      mcpServerPath: options.mcpServerPath || '/Users/2a/.claude/mcp-neo4j-agent-memory/build/index.js',
      neo4jUri: options.neo4jUri || process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4jUsername: options.neo4jUsername || process.env.NEO4J_USERNAME || 'neo4j',
      neo4jPassword: options.neo4jPassword || process.env.NEO4J_PASSWORD || 'password',
      transport: 'stdio', // Sempre usar stdio
      debug: options.debug || false
    };
    
    this.buffer = '';
  }

  /**
   * Conectar ao servidor MCP Neo4j
   */
  async connect() {
    if (this.connected) {
      console.log('⚠️ MCP Client já está conectado');
      return;
    }

    try {
      console.log('🔌 Conectando MCP Client ao Neo4j...');
      
      // Verificar se o arquivo existe
      const fs = require('fs');
      if (!fs.existsSync(this.config.mcpServerPath)) {
        throw new Error(`MCP server não encontrado em: ${this.config.mcpServerPath}`);
      }

      // Iniciar processo MCP
      this.mcpProcess = spawn('node', [this.config.mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NEO4J_URI: this.config.neo4jUri,
          NEO4J_USERNAME: this.config.neo4jUsername,
          NEO4J_PASSWORD: this.config.neo4jPassword,
          MCP_TRANSPORT: 'stdio'
        }
      });

      // Configurar handlers de eventos
      this.mcpProcess.stdout.on('data', this.handleStdout.bind(this));
      this.mcpProcess.stderr.on('data', this.handleStderr.bind(this));
      
      this.mcpProcess.on('close', (code) => {
        console.log(`MCP process exited with code ${code}`);
        this.connected = false;
        this.emit('disconnected', code);
      });

      this.mcpProcess.on('error', (error) => {
        console.error('MCP process error:', error);
        this.connected = false;
        this.emit('error', error);
      });

      // Aguardar inicialização
      await this.waitForConnection();
      
      // Registrar esta instância
      await this.registerChatApp();
      
      console.log('✅ MCP Client conectado com sucesso');
      this.emit('connected');
      
    } catch (error) {
      console.error('❌ Erro conectando MCP:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Aguardar conexão estar pronta com retry logic
   */
  async waitForConnection(retryCount = 0) {
    const maxRetries = 3;
    const timeoutMs = 30000; // Aumentado de 10s para 30s
    
    console.log(`🔄 Tentativa ${retryCount + 1}/${maxRetries} de conectar ao MCP...`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        
        if (retryCount < maxRetries - 1) {
          console.log(`⏱️  Timeout na tentativa ${retryCount + 1}, tentando novamente...`);
          this.waitForConnection(retryCount + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Timeout conectando ao MCP após ${maxRetries} tentativas`));
        }
      }, timeoutMs);

      const checkInterval = setInterval(async () => {
        try {
          // Tentar uma operação simples para verificar conexão
          const result = await this.sendRequest('initialize', {
            clientInfo: {
              name: 'chat-app-sdk',
              version: '1.0.0'
            }
          });
          
          if (result) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            this.connected = true;
            console.log(`✅ MCP conectado na tentativa ${retryCount + 1}`);
            resolve();
          }
        } catch (error) {
          // Ainda não conectado
          if (this.config.debug) {
            console.log(`⏳ Aguardando MCP ficar pronto... (tentativa ${retryCount + 1})`);
          }
        }
      }, 500);
    });
  }

  /**
   * Processar dados do stdout
   */
  handleStdout(data) {
    this.buffer += data.toString();
    
    // Processar mensagens completas (separadas por newline)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Guardar última linha incompleta
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          if (this.config.debug) {
            console.log('Non-JSON output:', line);
          }
        }
      }
    }
  }

  /**
   * Processar stderr
   */
  handleStderr(data) {
    const message = data.toString();
    if (this.config.debug || message.toLowerCase().includes('error')) {
      console.error('MCP stderr:', message);
    }
  }

  /**
   * Processar mensagem recebida
   */
  handleMessage(message) {
    if (this.config.debug) {
      console.log('MCP message received:', JSON.stringify(message, null, 2));
    }

    // Verificar se é uma resposta para requisição pendente
    if (message.id && this.responseHandlers.has(message.id)) {
      const handler = this.responseHandlers.get(message.id);
      this.responseHandlers.delete(message.id);
      
      if (message.error) {
        handler.reject(new Error(message.error.message || 'MCP error'));
      } else {
        handler.resolve(message.result);
      }
    }
    
    // Emitir evento para mensagens não solicitadas
    if (message.method) {
      this.emit('notification', message);
    }
  }

  /**
   * Enviar requisição ao MCP
   */
  async sendRequest(method, params = {}) {
    if (!this.mcpProcess) {
      throw new Error('MCP não está conectado');
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Registrar handler para resposta
      this.responseHandlers.set(id, { resolve, reject });
      
      // Enviar requisição
      const requestStr = JSON.stringify(request) + '\n';
      this.mcpProcess.stdin.write(requestStr);
      
      if (this.config.debug) {
        console.log('MCP request sent:', request);
      }
      
      // Timeout
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error(`Timeout for request ${id}`));
        }
      }, 30000);
    });
  }

  /**
   * Registrar aplicação no Neo4j
   */
  async registerChatApp() {
    try {
      const result = await this.createMemory('platform_session', {
        name: 'Chat App SDK Active Session',
        type: 'web_chat_active',
        started_at: new Date().toISOString(),
        pid: process.pid,
        status: 'active',
        has_a2a: true,
        has_mcp: true,
        platform: 'chat_app_sdk'
      });
      
      console.log('📝 Chat App registrado no Neo4j:', result);
      return result;
    } catch (error) {
      console.error('Erro registrando Chat App:', error);
    }
  }

  // === Métodos de Memória ===

  /**
   * Buscar memórias
   */
  async searchMemories(params = {}) {
    try {
      const result = await this.sendRequest('tools/search_memories', {
        query: params.query || '',
        limit: params.limit || 10,
        depth: params.depth || 1,
        label: params.label,
        since_date: params.since_date
      });
      
      return result?.memories || [];
    } catch (error) {
      console.error('Erro buscando memórias:', error);
      return [];
    }
  }

  /**
   * Criar nova memória
   */
  async createMemory(label, properties) {
    try {
      const result = await this.sendRequest('tools/create_memory', {
        label,
        properties
      });
      
      return result;
    } catch (error) {
      console.error('Erro criando memória:', error);
      throw error;
    }
  }

  /**
   * Criar conexão entre memórias
   */
  async createConnection(fromMemoryId, toMemoryId, type, properties = {}) {
    try {
      const result = await this.sendRequest('tools/create_connection', {
        fromMemoryId,
        toMemoryId,
        type,
        properties
      });
      
      return result;
    } catch (error) {
      console.error('Erro criando conexão:', error);
      throw error;
    }
  }

  /**
   * Atualizar memória existente
   */
  async updateMemory(nodeId, properties) {
    try {
      const result = await this.sendRequest('tools/update_memory', {
        nodeId,
        properties
      });
      
      return result;
    } catch (error) {
      console.error('Erro atualizando memória:', error);
      throw error;
    }
  }

  /**
   * Deletar memória
   */
  async deleteMemory(nodeId) {
    try {
      const result = await this.sendRequest('tools/delete_memory', {
        nodeId
      });
      
      return result;
    } catch (error) {
      console.error('Erro deletando memória:', error);
      throw error;
    }
  }

  /**
   * Listar labels de memória
   */
  async listMemoryLabels() {
    try {
      const result = await this.sendRequest('tools/list_memory_labels', {});
      return result?.labels || [];
    } catch (error) {
      console.error('Erro listando labels:', error);
      return [];
    }
  }

  /**
   * Desconectar cliente
   */
  async disconnect() {
    if (this.mcpProcess) {
      console.log('🔌 Desconectando MCP Client...');
      
      // Tentar shutdown gracioso
      try {
        await this.sendRequest('shutdown', {});
      } catch (error) {
        // Ignorar erros no shutdown
      }
      
      // Fechar processo
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.connected = false;
      
      console.log('✅ MCP Client desconectado');
    }
  }

  /**
   * Status do cliente
   */
  getStatus() {
    return {
      connected: this.connected,
      processRunning: !!this.mcpProcess,
      pendingRequests: this.responseHandlers.size,
      config: {
        neo4jUri: this.config.neo4jUri,
        transport: this.config.transport
      }
    };
  }

  /**
   * Testar conexão com Neo4j através do MCP
   */
  async testConnection() {
    try {
      console.log('🧪 Testando conexão MCP -> Neo4j...');
      
      // Tentar buscar labels como teste
      const labels = await this.listMemoryLabels();
      
      // Tentar criar uma memória de teste
      const testMemory = await this.createMemory('test_connection', {
        name: 'MCP Connection Test',
        timestamp: new Date().toISOString(),
        test: true
      });
      
      // Deletar memória de teste
      if (testMemory?.memory?._id) {
        await this.deleteMemory(testMemory.memory._id);
      }
      
      console.log('✅ Conexão MCP -> Neo4j funcionando!');
      return {
        success: true,
        connected: true,
        labels: labels.length,
        message: 'MCP conectado e Neo4j acessível'
      };
    } catch (error) {
      console.error('❌ Falha no teste de conexão:', error.message);
      return {
        success: false,
        connected: this.connected,
        error: error.message,
        message: 'Falha na conexão MCP -> Neo4j'
      };
    }
  }
}

module.exports = MCPClient;