#!/usr/bin/env node

/**
 * Script para testar envio de uma única mensagem
 * e verificar se há duplicação
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
  magenta: '\x1b[35m'
};

class SingleMessageTester {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.userMessages = [];
    this.allMessages = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`${colors.blue}📡 Conectando ao servidor: ${SERVER_URL}${colors.reset}`);
      
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: false
      });

      this.socket.on('connect', () => {
        console.log(`${colors.green}✅ Conectado com sucesso!${colors.reset}`);
        this.setupListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error(`${colors.red}❌ Erro de conexão: ${error.message}${colors.reset}`);
        reject(error);
      });
    });
  }

  setupListeners() {
    // Listener para sessão criada
    this.socket.on('session_created', (session) => {
      this.sessionId = session.id;
      console.log(`${colors.magenta}📋 Sessão criada: ${session.id.slice(0, 8)}...${colors.reset}`);
    });

    // Listener para mensagens
    this.socket.on('message', (message) => {
      console.log(`\n${colors.yellow}📨 MENSAGEM RECEBIDA:${colors.reset}`);
      console.log(`  ID: ${message.id}`);
      console.log(`  Tipo: ${message.type}`);
      console.log(`  Conteúdo: "${message.content}"`);
      console.log(`  Sessão: ${message.sessionId?.slice(0, 8)}`);
      
      this.allMessages.push(message);
      
      if (message.type === 'user') {
        this.userMessages.push(message);
        console.log(`  ${colors.blue}→ Total de mensagens do usuário: ${this.userMessages.length}${colors.reset}`);
      }
    });

    // Listener para mensagens completas
    this.socket.on('message_complete', (message) => {
      console.log(`${colors.green}✅ Mensagem completa: ${message.id.slice(0, 8)}${colors.reset}`);
    });

    // Listener para stream
    this.socket.on('message_stream', (data) => {
      // Silencioso
    });
  }

  async sendMessage(content) {
    console.log(`\n${colors.blue}📤 ENVIANDO MENSAGEM:${colors.reset}`);
    console.log(`  Conteúdo: "${content}"`);
    console.log(`  Sessão: ${this.sessionId}`);
    
    this.socket.emit('send_message', {
      message: content,
      sessionId: this.sessionId
    });
    
    console.log(`  ${colors.green}✓ Enviada${colors.reset}`);
  }

  async runTest() {
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.magenta}🧪 TESTE DE MENSAGEM ÚNICA${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);

    try {
      // Conectar ao servidor
      await this.connect();
      
      // Criar sessão
      this.socket.emit('create_session');
      await sleep(1000);

      // Enviar UMA única mensagem
      await this.sendMessage('oi');
      
      // Aguardar processamento
      console.log(`\n${colors.gray}⏳ Aguardando 5 segundos para processar...${colors.reset}`);
      await sleep(5000);

      // Analisar resultados
      this.analyzeResults();

    } catch (error) {
      console.error(`${colors.red}❌ Erro durante teste: ${error.message}${colors.reset}`);
    } finally {
      this.disconnect();
    }
  }

  analyzeResults() {
    console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.magenta}📊 ANÁLISE DE RESULTADOS${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);

    console.log(`${colors.blue}📈 Estatísticas:${colors.reset}`);
    console.log(`  • Mensagens enviadas: 1 ("oi")`);
    console.log(`  • Total de mensagens recebidas: ${this.allMessages.length}`);
    console.log(`  • Mensagens do usuário recebidas: ${this.userMessages.length}`);
    console.log(`  • Mensagens do assistente: ${this.allMessages.filter(m => m.type === 'assistant').length}`);

    // Verificar duplicação
    console.log(`\n${colors.blue}🔍 Análise de Duplicação:${colors.reset}`);
    
    if (this.userMessages.length === 0) {
      console.log(`  ${colors.red}❌ PROBLEMA: Nenhuma mensagem do usuário foi recebida!${colors.reset}`);
    } else if (this.userMessages.length === 1) {
      console.log(`  ${colors.green}✅ PERFEITO: Exatamente 1 mensagem "oi" (sem duplicação)${colors.reset}`);
    } else if (this.userMessages.length > 1) {
      console.log(`  ${colors.red}❌ DUPLICAÇÃO DETECTADA: ${this.userMessages.length} mensagens "oi"!${colors.reset}`);
      
      console.log(`\n  Detalhes das mensagens duplicadas:`);
      this.userMessages.forEach((msg, index) => {
        console.log(`    ${index + 1}. ID: ${msg.id}, Conteúdo: "${msg.content}"`);
      });
    }

    // Verificar conteúdo
    const oiMessages = this.userMessages.filter(m => m.content === 'oi');
    if (oiMessages.length !== this.userMessages.length) {
      console.log(`\n  ${colors.yellow}⚠️  Algumas mensagens têm conteúdo diferente de "oi"${colors.reset}`);
    }

    // Resultado final
    console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
    if (this.userMessages.length === 1) {
      console.log(`${colors.green}✅✅✅ TESTE PASSOU - SEM DUPLICAÇÃO ✅✅✅${colors.reset}`);
    } else {
      console.log(`${colors.red}❌❌❌ TESTE FALHOU - DUPLICAÇÃO DETECTADA ❌❌❌${colors.reset}`);
    }
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  }

  disconnect() {
    if (this.socket) {
      console.log(`\n${colors.blue}👋 Desconectando...${colors.reset}`);
      this.socket.disconnect();
    }
  }
}

// Executar teste
async function main() {
  const tester = new SingleMessageTester();
  
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