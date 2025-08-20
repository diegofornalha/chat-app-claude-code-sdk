const neo4j = require('neo4j-driver');

class MemoryMiddleware {
  constructor(mcpClient, ragService) {
    this.mcp = mcpClient;
    this.ragService = ragService;
    this.sessionMemory = new Map();
    this.contextWindow = 10; // Últimas 10 mensagens
  }

  /**
   * Intercepta e processa TODAS as mensagens
   */
  async processMessage(message, userId, sessionId) {
    console.log('🧠 MemoryMiddleware: Processando mensagem', {
      userId,
      sessionId,
      messageType: message.type || 'user'
    });

    try {
      // 1. Buscar contexto relevante do Neo4j
      const context = await this.getRelevantContext(message, userId, sessionId);
      
      // 2. Enriquecer mensagem com contexto
      const enrichedMessage = this.enrichMessage(message, context);
      
      // 3. Processar mensagem com contexto
      const processedMessage = await this.processWithContext(enrichedMessage, context);
      
      // 4. Salvar interação no grafo
      await this.saveInteraction(processedMessage, userId, sessionId, context);
      
      // 5. Atualizar memória de sessão
      this.updateSessionMemory(sessionId, processedMessage);
      
      // 6. Retornar mensagem processada com contexto
      return {
        ...processedMessage,
        context: this.formatContext(context),
        sessionMemory: this.getSessionSummary(sessionId)
      };
    } catch (error) {
      console.error('❌ Erro no MemoryMiddleware:', error);
      // Fallback: processar sem contexto
      return {
        ...message,
        context: null,
        error: 'Processamento sem contexto histórico'
      };
    }
  }

  /**
   * Busca contexto relevante do Neo4j
   */
  async getRelevantContext(message, userId, sessionId) {
    const contexts = [];
    
    // 1. Buscar mensagens anteriores da sessão
    const sessionHistory = await this.ragService.searchMemories({
      query: `session:${sessionId}`,
      limit: this.contextWindow,
      order_by: 'created_at DESC'
    });
    contexts.push({ type: 'session', data: sessionHistory });
    
    // 2. Buscar memórias relacionadas ao conteúdo
    if (message.content) {
      const semanticMemories = await this.ragService.searchMemories({
        query: message.content,
        limit: 5
      });
      contexts.push({ type: 'semantic', data: semanticMemories });
    }
    
    // 3. Buscar padrões de interação do usuário
    const userPatterns = await this.ragService.searchMemories({
        query: `user:${userId} type:pattern`,
        limit: 3
      });
    contexts.push({ type: 'patterns', data: userPatterns });
    
    // 4. Buscar conhecimento do domínio
    if (message.domain || message.topic) {
      const domainKnowledge = await this.ragService.searchMemories({
        query: `domain:${message.domain || message.topic}`,
        limit: 5
      });
      contexts.push({ type: 'domain', data: domainKnowledge });
    }
    
    return contexts;
  }

  /**
   * Enriquece mensagem com contexto
   */
  enrichMessage(message, context) {
    const enriched = { ...message };
    
    // Adicionar contexto histórico
    const sessionContext = context.find(c => c.type === 'session');
    if (sessionContext?.data?.length > 0) {
      enriched.previousMessages = sessionContext.data.map(m => ({
        role: m.properties?.role || 'user',
        content: m.properties?.content || '',
        timestamp: m.properties?.created_at
      }));
    }
    
    // Adicionar memórias semânticas relacionadas
    const semanticContext = context.find(c => c.type === 'semantic');
    if (semanticContext?.data?.length > 0) {
      enriched.relatedMemories = semanticContext.data.map(m => ({
        content: m.properties?.content || '',
        relevance: m.properties?.relevance || 0,
        source: m.properties?.source || 'memory'
      }));
    }
    
    // Adicionar padrões identificados
    const patterns = context.find(c => c.type === 'patterns');
    if (patterns?.data?.length > 0) {
      enriched.userPatterns = patterns.data.map(p => ({
        pattern: p.properties?.pattern || '',
        frequency: p.properties?.frequency || 0
      }));
    }
    
    return enriched;
  }

  /**
   * Processa mensagem com contexto
   */
  async processWithContext(message, context) {
    const processed = { ...message };
    
    // Adicionar timestamp
    processed.timestamp = new Date().toISOString();
    
    // Detectar intenção baseada no contexto
    processed.intent = this.detectIntent(message, context);
    
    // Extrair entidades
    processed.entities = this.extractEntities(message.content || '');
    
    // Calcular sentimento
    processed.sentiment = this.analyzeSentiment(message.content || '');
    
    // Adicionar tags baseadas no contexto
    processed.tags = this.generateTags(message, context);
    
    return processed;
  }

  /**
   * Salva interação no Neo4j
   */
  async saveInteraction(message, userId, sessionId, context) {
    try {
      // 1. Criar/atualizar nó da mensagem
      const messageNode = await this.ragService.createMemory({
        label: 'message',
        properties: {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: message.content || '',
          role: message.role || 'user',
          userId,
          sessionId,
          timestamp: message.timestamp,
          intent: message.intent,
          sentiment: message.sentiment,
          tags: message.tags?.join(',') || '',
          created_at: new Date().toISOString()
        }
      });
      
      // 2. Criar relações com contexto
      if (context && context.length > 0) {
        // Conectar com sessão
        const sessionContext = context.find(c => c.type === 'session');
        if (sessionContext?.data?.[0]) {
          await this.ragService.createConnection({
            fromMemoryId: messageNode.id,
            toMemoryId: sessionContext.data[0].id,
            type: 'FOLLOWS',
            properties: {
              sequence: this.getSessionMessageCount(sessionId)
            }
          });
        }
        
        // Conectar com memórias semânticas
        const semanticContext = context.find(c => c.type === 'semantic');
        if (semanticContext?.data) {
          for (const memory of semanticContext.data.slice(0, 3)) {
            await this.ragService.createConnection({
              fromMemoryId: messageNode.id,
              toMemoryId: memory.id,
              type: 'RELATES_TO',
              properties: {
                relevance: memory.properties?.relevance || 0.5
              }
            });
          }
        }
      }
      
      // 3. Atualizar padrões do usuário
      if (message.intent) {
        await this.updateUserPatterns(userId, message.intent);
      }
      
      console.log('✅ Interação salva no Neo4j:', messageNode.id);
      return messageNode;
    } catch (error) {
      console.error('❌ Erro ao salvar interação:', error);
      throw error;
    }
  }

  /**
   * Atualiza memória de sessão local
   */
  updateSessionMemory(sessionId, message) {
    if (!this.sessionMemory.has(sessionId)) {
      this.sessionMemory.set(sessionId, []);
    }
    
    const sessionMessages = this.sessionMemory.get(sessionId);
    sessionMessages.push({
      timestamp: message.timestamp,
      role: message.role || 'user',
      content: message.content || '',
      intent: message.intent,
      sentiment: message.sentiment
    });
    
    // Manter apenas as últimas N mensagens em memória
    if (sessionMessages.length > this.contextWindow * 2) {
      sessionMessages.shift();
    }
  }

  /**
   * Detecta intenção da mensagem
   */
  detectIntent(message, context) {
    const content = (message.content || '').toLowerCase();
    
    // Intents básicos
    const intents = {
      greeting: /^(oi|olá|hey|hi|hello|bom dia|boa tarde|boa noite)/i,
      question: /\?|como|quando|onde|por que|qual|quem|what|how|when|where|why/i,
      command: /^(faça|crie|execute|rode|delete|remova|adicione|do|create|run|delete|add)/i,
      affirmation: /^(sim|yes|ok|certo|claro|com certeza|pode|vamos)/i,
      negation: /^(não|no|nunca|jamais|nem|nope)/i,
      thanks: /(obrigado|thanks|thank you|valeu|gratidão)/i,
      help: /(ajuda|help|socorro|não entendi|explique)/i,
      code: /(código|code|function|class|const|let|var|import|export)/i,
      config: /(configurar|setup|install|config|settings)/i,
      error: /(erro|bug|falha|problema|issue|error|fail)/i
    };
    
    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(content)) {
        return intent;
      }
    }
    
    // Se não identificou, verificar contexto
    const sessionContext = context.find(c => c.type === 'session');
    if (sessionContext?.data?.[0]?.properties?.intent) {
      return 'continuation'; // Continuação da conversa anterior
    }
    
    return 'general';
  }

  /**
   * Extrai entidades da mensagem
   */
  extractEntities(content) {
    const entities = [];
    
    // Extrair URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlPattern);
    if (urls) {
      entities.push(...urls.map(url => ({ type: 'url', value: url })));
    }
    
    // Extrair emails
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = content.match(emailPattern);
    if (emails) {
      entities.push(...emails.map(email => ({ type: 'email', value: email })));
    }
    
    // Extrair menções de arquivos
    const filePattern = /\b\w+\.(js|ts|jsx|tsx|json|md|txt|css|html|py|java|go|rs)\b/g;
    const files = content.match(filePattern);
    if (files) {
      entities.push(...files.map(file => ({ type: 'file', value: file })));
    }
    
    // Extrair números significativos
    const numberPattern = /\b\d{3,}\b/g;
    const numbers = content.match(numberPattern);
    if (numbers) {
      entities.push(...numbers.map(num => ({ type: 'number', value: num })));
    }
    
    return entities;
  }

  /**
   * Analisa sentimento da mensagem
   */
  analyzeSentiment(content) {
    const positive = /(bom|ótimo|excelente|perfeito|incrível|amazing|great|good|nice|love|❤️|😊|👍)/gi;
    const negative = /(ruim|péssimo|horrível|problema|erro|falha|bad|terrible|awful|hate|😞|👎|❌)/gi;
    const neutral = /(ok|certo|entendi|sim|não|maybe|perhaps)/gi;
    
    const positiveCount = (content.match(positive) || []).length;
    const negativeCount = (content.match(negative) || []).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Gera tags baseadas no contexto
   */
  generateTags(message, context) {
    const tags = new Set();
    
    // Tags baseadas na intenção
    if (message.intent) {
      tags.add(message.intent);
    }
    
    // Tags baseadas no sentimento
    if (message.sentiment) {
      tags.add(message.sentiment);
    }
    
    // Tags baseadas em entidades
    if (message.entities) {
      message.entities.forEach(entity => {
        tags.add(entity.type);
      });
    }
    
    // Tags baseadas em palavras-chave técnicas
    const techKeywords = ['api', 'database', 'frontend', 'backend', 'deploy', 'test', 'debug', 'performance'];
    const content = (message.content || '').toLowerCase();
    techKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        tags.add(keyword);
      }
    });
    
    return Array.from(tags);
  }

  /**
   * Atualiza padrões do usuário
   */
  async updateUserPatterns(userId, intent) {
    try {
      // Buscar padrão existente
      const existingPattern = await this.ragService.searchMemories({
        query: `user:${userId} intent:${intent} type:pattern`,
        limit: 1
      });
      
      if (existingPattern && existingPattern.length > 0) {
        // Atualizar frequência
        const pattern = existingPattern[0];
        await this.ragService.updateMemory({
          nodeId: pattern.id,
          properties: {
            frequency: (pattern.properties?.frequency || 0) + 1,
            last_seen: new Date().toISOString()
          }
        });
      } else {
        // Criar novo padrão
        await this.ragService.createMemory({
          label: 'pattern',
          properties: {
            userId,
            type: 'pattern',
            pattern: intent,
            intent,
            frequency: 1,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar padrões:', error);
    }
  }

  /**
   * Formata contexto para resposta
   */
  formatContext(context) {
    const formatted = {};
    
    context.forEach(ctx => {
      if (ctx.data && ctx.data.length > 0) {
        formatted[ctx.type] = ctx.data.map(item => ({
          id: item.id,
          content: item.properties?.content || '',
          relevance: item.properties?.relevance || 0,
          timestamp: item.properties?.created_at || item.properties?.timestamp
        }));
      }
    });
    
    return formatted;
  }

  /**
   * Obtém resumo da sessão
   */
  getSessionSummary(sessionId) {
    const messages = this.sessionMemory.get(sessionId) || [];
    
    return {
      messageCount: messages.length,
      intents: [...new Set(messages.map(m => m.intent).filter(Boolean))],
      sentiments: {
        positive: messages.filter(m => m.sentiment === 'positive').length,
        negative: messages.filter(m => m.sentiment === 'negative').length,
        neutral: messages.filter(m => m.sentiment === 'neutral').length
      },
      lastMessage: messages[messages.length - 1]?.timestamp || null
    };
  }

  /**
   * Obtém contagem de mensagens da sessão
   */
  getSessionMessageCount(sessionId) {
    const messages = this.sessionMemory.get(sessionId) || [];
    return messages.length;
  }

  /**
   * Limpa memória de sessão antiga
   */
  cleanupOldSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 horas
    const now = Date.now();
    
    for (const [sessionId, messages] of this.sessionMemory.entries()) {
      if (messages.length === 0) {
        this.sessionMemory.delete(sessionId);
        continue;
      }
      
      const lastMessage = messages[messages.length - 1];
      const lastTimestamp = new Date(lastMessage.timestamp).getTime();
      
      if (now - lastTimestamp > maxAge) {
        this.sessionMemory.delete(sessionId);
        console.log(`🧹 Sessão limpa da memória: ${sessionId}`);
      }
    }
  }

  /**
   * Exporta memória da sessão
   */
  exportSessionMemory(sessionId) {
    return {
      sessionId,
      messages: this.sessionMemory.get(sessionId) || [],
      summary: this.getSessionSummary(sessionId),
      exported_at: new Date().toISOString()
    };
  }

  /**
   * Importa memória da sessão
   */
  importSessionMemory(sessionId, data) {
    if (data.messages && Array.isArray(data.messages)) {
      this.sessionMemory.set(sessionId, data.messages);
      console.log(`📥 Memória importada para sessão: ${sessionId}`);
      return true;
    }
    return false;
  }
}

module.exports = MemoryMiddleware;