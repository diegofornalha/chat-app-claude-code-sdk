#!/usr/bin/env node

/**
 * Script de teste para verificar isolamento de sessões
 * 
 * Este script testa:
 * 1. Se mensagens ficam isoladas em suas respectivas sessões
 * 2. Se múltiplos clientes não interferem entre si
 * 3. Se mensagens não vazam entre sessões
 */

const io = require('socket.io-client');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Configurações
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

class SessionClient {
  constructor(clientId) {
    this.clientId = clientId;
    this.socket = null;
    this.sessionId = null;
    this.messages = [];
    this.receivedSessions = new Set();
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`${colors.blue}[Cliente ${this.clientId}] 📡 Conectando...${colors.reset}`);
      
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: false
      });

      this.socket.on('connect', () => {
        console.log(`${colors.green}[Cliente ${this.clientId}] ✅ Conectado${colors.reset}`);
        this.setupListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error(`${colors.red}[Cliente ${this.clientId}] ❌ Erro: ${error.message}${colors.reset}`);
        reject(error);
      });
    });
  }

  setupListeners() {
    // Listener para sessão criada
    this.socket.on('session_created', (session) => {
      this.sessionId = session.id;
      console.log(`${colors.magenta}[Cliente ${this.clientId}] 📋 Sessão criada: ${session.id.slice(0, 8)}...${colors.reset}`);
    });

    // Listener para mensagens
    this.socket.on('message', (message) => {
      console.log(`${colors.yellow}[Cliente ${this.clientId}] 📥 Mensagem recebida:${colors.reset}`, {
        id: message.id.slice(0, 8),
        type: message.type,
        sessionId: message.sessionId?.slice(0, 8),
        content: message.content?.substring(0, 30) + '...'
      });
      
      this.messages.push(message);
      this.receivedSessions.add(message.sessionId);
    });

    // Listener para mensagens completas
    this.socket.on('message_complete', (message) => {
      console.log(`${colors.gray}[Cliente ${this.clientId}] ✅ Mensagem completa: ${message.id.slice(0, 8)}${colors.reset}`);
      this.messages.push(message);
      this.receivedSessions.add(message.sessionId);
    });

    // Listener para erros
    this.socket.on('error', (error) => {
      console.error(`${colors.red}[Cliente ${this.clientId}] ❌ Erro: ${error.message || error}${colors.reset}`);
    });

    // Listener para stream
    this.socket.on('message_stream', (data) => {
      // Silencioso para não poluir o log
    });
  }

  createSession() {
    return new Promise((resolve) => {
      this.socket.emit('create_session');
      setTimeout(resolve, 1000);
    });
  }

  sendMessage(content) {
    return new Promise((resolve) => {
      console.log(`${colors.blue}[Cliente ${this.clientId}] 📤 Enviando: "${content}"${colors.reset}`);
      
      this.socket.emit('send_message', {
        message: content,
        sessionId: this.sessionId
      });

      setTimeout(resolve, 2000);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log(`${colors.gray}[Cliente ${this.clientId}] 👋 Desconectado${colors.reset}`);
    }
  }

  getStats() {
    return {
      clientId: this.clientId,
      sessionId: this.sessionId,
      messageCount: this.messages.length,
      userMessages: this.messages.filter(m => m.type === 'user').length,
      assistantMessages: this.messages.filter(m => m.type === 'assistant').length,
      sessionsReceived: Array.from(this.receivedSessions)
    };
  }
}

class SessionIsolationTester {
  constructor() {
    this.clients = [];
  }

  async runTest() {
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.magenta}🧪 TESTE DE ISOLAMENTO DE SESSÕES${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);

    try {
      // Criar 3 clientes simultâneos
      console.log(`${colors.blue}📱 Criando múltiplos clientes...${colors.reset}\n`);
      
      for (let i = 1; i <= 3; i++) {
        const client = new SessionClient(i);
        await client.connect();
        await client.createSession();
        this.clients.push(client);
        await sleep(500);
      }

      // Cada cliente envia mensagens diferentes
      console.log(`\n${colors.blue}💬 Enviando mensagens de cada cliente...${colors.reset}\n`);
      
      await this.clients[0].sendMessage('Cliente 1: Primeira mensagem');
      await this.clients[1].sendMessage('Cliente 2: Olá do cliente 2');
      await this.clients[2].sendMessage('Cliente 3: Teste de isolamento');
      
      await sleep(2000);
      
      // Segunda rodada de mensagens
      await this.clients[0].sendMessage('Cliente 1: Segunda mensagem');
      await this.clients[1].sendMessage('Cliente 2: Verificando sessão');
      
      await sleep(3000);

      // Analisar resultados
      this.analyzeResults();

    } catch (error) {
      console.error(`${colors.red}❌ Erro durante teste: ${error.message}${colors.reset}`);
    } finally {
      // Desconectar todos os clientes
      this.clients.forEach(client => client.disconnect());
    }
  }

  analyzeResults() {
    console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.magenta}📊 ANÁLISE DE ISOLAMENTO DE SESSÕES${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);

    const stats = this.clients.map(c => c.getStats());
    
    // Verificar estatísticas por cliente
    console.log(`${colors.blue}📈 Estatísticas por Cliente:${colors.reset}\n`);
    
    stats.forEach(stat => {
      console.log(`${colors.yellow}Cliente ${stat.clientId}:${colors.reset}`);
      console.log(`  • Sessão ID: ${stat.sessionId?.slice(0, 8)}...`);
      console.log(`  • Mensagens totais: ${stat.messageCount}`);
      console.log(`  • Mensagens do usuário: ${stat.userMessages}`);
      console.log(`  • Mensagens do assistente: ${stat.assistantMessages}`);
      console.log(`  • Sessões vistas: ${stat.sessionsReceived.map(s => s?.slice(0, 8)).join(', ')}`);
      console.log();
    });

    // Verificar isolamento
    console.log(`${colors.blue}🔒 Verificação de Isolamento:${colors.reset}\n`);
    
    let isolationPassed = true;
    const problems = [];

    stats.forEach((stat, index) => {
      // Cada cliente deve ver apenas sua própria sessão
      if (stat.sessionsReceived.length > 1) {
        problems.push(`Cliente ${stat.clientId} viu ${stat.sessionsReceived.length} sessões diferentes!`);
        isolationPassed = false;
      }

      // A sessão vista deve ser a própria
      const otherSessions = stat.sessionsReceived.filter(s => s !== stat.sessionId);
      if (otherSessions.length > 0) {
        problems.push(`Cliente ${stat.clientId} recebeu mensagens de outras sessões: ${otherSessions.map(s => s?.slice(0, 8)).join(', ')}`);
        isolationPassed = false;
      }

      // Verificar se não recebeu mensagens de outros clientes
      const client = this.clients[index];
      const wrongMessages = client.messages.filter(m => {
        const content = m.content || '';
        const otherClients = [1, 2, 3].filter(id => id !== stat.clientId);
        return otherClients.some(id => content.includes(`Cliente ${id}:`));
      });

      if (wrongMessages.length > 0) {
        problems.push(`Cliente ${stat.clientId} recebeu ${wrongMessages.length} mensagens de outros clientes!`);
        isolationPassed = false;
      }
    });

    if (isolationPassed) {
      console.log(`${colors.green}✅ ISOLAMENTO PERFEITO!${colors.reset}`);
      console.log(`${colors.green}Cada cliente manteve suas mensagens isoladas em sua própria sessão.${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ PROBLEMAS DE ISOLAMENTO DETECTADOS:${colors.reset}\n`);
      problems.forEach(problem => {
        console.log(`  ${colors.red}• ${problem}${colors.reset}`);
      });
    }

    // Verificar vazamento de mensagens
    console.log(`\n${colors.blue}🔍 Verificação de Vazamento:${colors.reset}\n`);
    
    const allSessions = new Set();
    stats.forEach(stat => {
      stat.sessionsReceived.forEach(s => allSessions.add(s));
    });

    console.log(`  • Total de sessões únicas: ${allSessions.size}`);
    console.log(`  • Total de clientes: ${this.clients.length}`);
    
    if (allSessions.size === this.clients.length) {
      console.log(`  ${colors.green}✅ Número correto de sessões criadas${colors.reset}`);
    } else {
      console.log(`  ${colors.red}❌ Discrepância no número de sessões!${colors.reset}`);
    }

    // Resumo final
    console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
    if (isolationPassed && allSessions.size === this.clients.length) {
      console.log(`${colors.green}✅✅✅ TESTE PASSOU COMPLETAMENTE ✅✅✅${colors.reset}`);
      console.log(`${colors.green}Sistema mantém isolamento perfeito entre sessões!${colors.reset}`);
    } else {
      console.log(`${colors.red}❌❌❌ TESTE FALHOU ❌❌❌${colors.reset}`);
      console.log(`${colors.red}Existem problemas de isolamento entre sessões!${colors.reset}`);
    }
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  }
}

// Executar teste
async function main() {
  const tester = new SessionIsolationTester();
  
  try {
    await tester.runTest();
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}❌ Erro fatal: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Executar
main().catch(console.error);