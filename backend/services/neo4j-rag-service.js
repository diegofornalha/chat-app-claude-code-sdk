/**
 * Neo4j RAG Service com Fallback
 * Serviço de Retrieval-Augmented Generation com fallback direto para Neo4j
 */

const neo4j = require('neo4j-driver');

class Neo4jRAGService {
  constructor(mcpClient) {
    this.mcp = mcpClient;
    this.driver = null;
    this.session = null;
    
    // Configurações do Neo4j para fallback
    this.neo4jConfig = {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    };
    
    // Cache para melhorar performance
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Inicializar conexão direta com Neo4j (fallback)
   */
  async initDirectConnection() {
    if (!this.driver) {
      console.log('📊 Iniciando conexão direta com Neo4j (fallback)...');
      this.driver = neo4j.driver(
        this.neo4jConfig.uri,
        neo4j.auth.basic(this.neo4jConfig.username, this.neo4jConfig.password)
      );
      
      // Testar conexão
      try {
        await this.driver.verifyConnectivity();
        console.log('✅ Conexão direta com Neo4j estabelecida');
      } catch (error) {
        console.error('❌ Falha na conexão direta com Neo4j:', error);
        throw error;
      }
    }
    
    if (!this.session) {
      this.session = this.driver.session();
    }
  }

  /**
   * Adicionar documento/memória
   */
  async addDocument(doc) {
    console.log('📝 Adicionando documento ao Neo4j...');
    
    // Tentar via MCP primeiro
    if (this.mcp && this.mcp.connected) {
      try {
        const result = await this.mcp.createMemory('document', doc);
        console.log('✅ Documento adicionado via MCP');
        this.clearCache();
        return result;
      } catch (error) {
        console.warn('⚠️ Falha ao adicionar via MCP, usando fallback:', error.message);
      }
    }
    
    // Fallback: conexão direta
    return await this.directNeo4jAdd(doc);
  }

  /**
   * Adicionar documento diretamente no Neo4j
   */
  async directNeo4jAdd(doc) {
    await this.initDirectConnection();
    
    const query = `
      CREATE (d:Document {
        id: $id,
        content: $content,
        timestamp: datetime(),
        metadata: $metadata
      })
      RETURN d
    `;
    
    try {
      const result = await this.session.run(query, {
        id: doc.id || `doc_${Date.now()}`,
        content: doc.content || doc.text || JSON.stringify(doc),
        metadata: JSON.stringify(doc.metadata || {})
      });
      
      console.log('✅ Documento adicionado diretamente ao Neo4j');
      this.clearCache();
      return result.records[0]?.get('d')?.properties;
    } catch (error) {
      console.error('❌ Erro ao adicionar documento diretamente:', error);
      throw error;
    }
  }

  /**
   * Buscar contexto relevante
   */
  async searchContext(query, options = {}) {
    const cacheKey = `search_${query}_${JSON.stringify(options)}`;
    
    // Verificar cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📦 Retornando resultado do cache');
        return cached.data;
      }
    }
    
    console.log('🔍 Buscando contexto no Neo4j...');
    
    // Tentar via MCP primeiro
    if (this.mcp && this.mcp.connected) {
      try {
        const result = await this.mcp.searchMemories({
          query,
          limit: options.limit || 10,
          depth: options.depth || 1,
          label: options.label
        });
        
        console.log(`✅ Encontrados ${result.length} resultados via MCP`);
        this.cacheResult(cacheKey, result);
        return result;
      } catch (error) {
        console.warn('⚠️ Falha na busca via MCP, usando fallback:', error.message);
      }
    }
    
    // Fallback: busca direta
    return await this.directNeo4jSearch(query, options);
  }

  /**
   * Busca direta no Neo4j
   */
  async directNeo4jSearch(query, options = {}) {
    await this.initDirectConnection();
    
    const cypherQuery = `
      MATCH (n)
      WHERE n.content CONTAINS $query 
        OR n.name CONTAINS $query
        OR n.description CONTAINS $query
      RETURN n
      ORDER BY n.timestamp DESC
      LIMIT $limit
    `;
    
    try {
      const result = await this.session.run(cypherQuery, {
        query,
        limit: neo4j.int(options.limit || 10)
      });
      
      const memories = result.records.map(record => {
        const node = record.get('n');
        return {
          memory: node.properties,
          connections: []
        };
      });
      
      console.log(`✅ Encontrados ${memories.length} resultados diretos`);
      this.cacheResult(cypherQuery, memories);
      return memories;
    } catch (error) {
      console.error('❌ Erro na busca direta:', error);
      return [];
    }
  }

  /**
   * Construir prompt com contexto
   */
  async buildContextualPrompt(userMessage, sessionId) {
    const contexts = [];
    
    // 1. Buscar contexto relevante
    const relevantMemories = await this.searchContext(userMessage, {
      limit: 5,
      depth: 2
    });
    
    if (relevantMemories.length > 0) {
      contexts.push('Contexto relevante:');
      relevantMemories.forEach(mem => {
        if (mem.memory) {
          const content = mem.memory.content || mem.memory.name || JSON.stringify(mem.memory);
          contexts.push(`- ${content}`);
        }
      });
    }
    
    // 2. Buscar histórico da sessão
    if (sessionId) {
      const sessionHistory = await this.getSessionHistory(sessionId, 5);
      if (sessionHistory.length > 0) {
        contexts.push('\nHistórico recente:');
        sessionHistory.forEach(msg => {
          contexts.push(`- ${msg.role}: ${msg.content.substring(0, 100)}...`);
        });
      }
    }
    
    // 3. Construir prompt final
    if (contexts.length > 0) {
      return `${contexts.join('\n')}\n\nMensagem do usuário: ${userMessage}`;
    }
    
    return userMessage;
  }

  /**
   * Obter histórico da sessão
   */
  async getSessionHistory(sessionId, limit = 10) {
    console.log(`📜 Buscando histórico da sessão ${sessionId}...`);
    
    // Tentar via MCP
    if (this.mcp && this.mcp.connected) {
      try {
        const history = await this.mcp.searchMemories({
          query: sessionId,
          label: 'message',
          limit
        });
        
        return history.map(h => ({
          role: h.memory.type || 'user',
          content: h.memory.content || ''
        }));
      } catch (error) {
        console.warn('⚠️ Falha ao buscar histórico via MCP');
      }
    }
    
    // Fallback: busca direta
    return await this.directGetSessionHistory(sessionId, limit);
  }

  /**
   * Buscar histórico direto no Neo4j
   */
  async directGetSessionHistory(sessionId, limit) {
    await this.initDirectConnection();
    
    const query = `
      MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message)
      RETURN m
      ORDER BY m.timestamp DESC
      LIMIT $limit
    `;
    
    try {
      const result = await this.session.run(query, {
        sessionId,
        limit: neo4j.int(limit)
      });
      
      return result.records.map(record => {
        const msg = record.get('m').properties;
        return {
          role: msg.type || 'user',
          content: msg.content || ''
        };
      }).reverse();
    } catch (error) {
      console.error('❌ Erro ao buscar histórico direto:', error);
      return [];
    }
  }

  /**
   * Salvar mensagem no histórico
   */
  async saveMessage(sessionId, message) {
    const messageData = {
      sessionId,
      content: message.content,
      type: message.role || 'user',
      timestamp: new Date().toISOString(),
      ...message.metadata
    };
    
    // Tentar via MCP
    if (this.mcp && this.mcp.connected) {
      try {
        await this.mcp.createMemory('message', messageData);
        console.log('✅ Mensagem salva via MCP');
        return;
      } catch (error) {
        console.warn('⚠️ Falha ao salvar via MCP, usando fallback');
      }
    }
    
    // Fallback: salvar direto
    await this.directSaveMessage(sessionId, messageData);
  }

  /**
   * Salvar mensagem diretamente
   */
  async directSaveMessage(sessionId, messageData) {
    await this.initDirectConnection();
    
    const query = `
      MERGE (s:Session {id: $sessionId})
      CREATE (m:Message {
        id: $messageId,
        content: $content,
        type: $type,
        timestamp: datetime($timestamp)
      })
      CREATE (s)-[:HAS_MESSAGE]->(m)
      RETURN m
    `;
    
    try {
      await this.session.run(query, {
        sessionId,
        messageId: `msg_${Date.now()}`,
        content: messageData.content,
        type: messageData.type,
        timestamp: messageData.timestamp
      });
      
      console.log('✅ Mensagem salva diretamente no Neo4j');
    } catch (error) {
      console.error('❌ Erro ao salvar mensagem diretamente:', error);
    }
  }

  /**
   * Cache de resultados
   */
  cacheResult(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Limpar cache antigo
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Limpar cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Status do serviço
   */
  getStatus() {
    return {
      mcpConnected: this.mcp?.connected || false,
      directConnectionAvailable: !!this.driver,
      cacheSize: this.cache.size,
      neo4jUri: this.neo4jConfig.uri
    };
  }

  /**
   * Fechar conexões
   */
  async close() {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
    
    this.clearCache();
    console.log('🔌 Neo4j RAG Service fechado');
  }
}

module.exports = Neo4jRAGService;