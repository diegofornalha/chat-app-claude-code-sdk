#!/usr/bin/env node

/**
 * Script de teste para verificar deduplicação de mensagens
 * 
 * Este script testa se as mensagens não são duplicadas no chat
 * enviando múltiplas mensagens e verificando os IDs únicos
 */

const io = require('socket.io-client');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Configurações
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const TEST_MESSAGES = [
  'oi',
  'tudo bem?',
  'teste de duplicação 1',
  'teste de duplicação 2',
  'mensagem final'
];

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

class DeduplicationTester {
  constructor() {
    this.socket = null;
    this.messages = [];
    this.messageIds = new Set();
    this.duplicates = [];
    this.sessionId = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`${colors.blue}📡 Conectando ao servidor: ${SERVER_URL}${colors.reset}`);
      
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true
      });

      this.socket.on('connect', () => {
        console.log(`${colors.green}✅ Conectado com sucesso!${colors.reset}`);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error(`${colors.red}❌ Erro de conexão: ${error.message}${colors.reset}`);
        reject(error);
      });

      // Setup event listeners
      this.setupListeners();
    });
  }

  setupListeners() {
    // Listener para mensagens
    this.socket.on('message', (message) => {
      this.handleMessage(message, 'message');
    });

    // Listener para mensagens completas
    this.socket.on('message_complete', (message) => {
      this.handleMessage(message, 'message_complete');
    });

    // Listener para stream
    this.socket.on('message_stream', (data) => {
      console.log(`${colors.magenta}🌊 Stream recebido${colors.reset}`);
    });

    // Listener para sessão criada
    this.socket.on('session_created', (session) => {
      this.sessionId = session.id;
      console.log(`${colors.blue}📋 Sessão criada: ${session.id.slice(0, 8)}...${colors.reset}`);
    });

    // Listener para erros
    this.socket.on('error', (error) => {
      console.error(`${colors.red}❌ Erro: ${error.message || error}${colors.reset}`);
    });
  }

  handleMessage(message, eventType) {
    console.log(`${colors.yellow}📥 [${eventType}] Mensagem recebida:${colors.reset}`, {
      id: message.id,
      type: message.type,
      content: message.content?.substring(0, 50) + '...'
    });

    // Verificar duplicação
    if (this.messageIds.has(message.id)) {
      console.log(`${colors.red}🔄 DUPLICATA DETECTADA! ID: ${message.id}${colors.reset}`);
      this.duplicates.push({
        id: message.id,
        eventType,
        content: message.content
      });
    } else {
      this.messageIds.add(message.id);
      this.messages.push(message);
      console.log(`${colors.green}✅ ID único confirmado: ${message.id}${colors.reset}`);
    }
  }

  async sendMessage(content) {
    return new Promise((resolve) => {
      console.log(`${colors.blue}📤 Enviando: "${content}"${colors.reset}`);
      
      this.socket.emit('send_message', {
        message: content,
        sessionId: this.sessionId
      });

      // Aguardar um pouco para processar
      setTimeout(resolve, 2000);
    });
  }

  async runTest() {
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.magenta}🧪 TESTE DE DEDUPLICAÇÃO DE MENSAGENS${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);

    try {
      // Conectar ao servidor
      await this.connect();
      
      // Criar sessão
      this.socket.emit('create_session');
      await sleep(1000);

      // Enviar mensagens de teste
      console.log(`\n${colors.blue}📮 Enviando mensagens de teste...${colors.reset}\n`);
      
      for (const message of TEST_MESSAGES) {
        await this.sendMessage(message);
        await sleep(1500); // Aguardar entre mensagens
      }

      // Aguardar processamento final
      await sleep(3000);

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
    console.log(`${colors.magenta}📊 RESULTADOS DO TESTE${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);

    console.log(`${colors.blue}📈 Estatísticas:${colors.reset}`);
    console.log(`  • Mensagens enviadas: ${TEST_MESSAGES.length}`);
    console.log(`  • Mensagens recebidas: ${this.messages.length}`);
    console.log(`  • IDs únicos: ${this.messageIds.size}`);
    console.log(`  • Duplicatas detectadas: ${this.duplicates.length}`);

    if (this.duplicates.length > 0) {
      console.log(`\n${colors.red}⚠️  PROBLEMAS ENCONTRADOS:${colors.reset}`);
      console.log(`${colors.red}Foram detectadas ${this.duplicates.length} mensagens duplicadas!${colors.reset}\n`);
      
      this.duplicates.forEach((dup, index) => {
        console.log(`  ${index + 1}. ID: ${dup.id}`);
        console.log(`     Evento: ${dup.eventType}`);
        console.log(`     Conteúdo: ${dup.content?.substring(0, 50)}...`);
      });

      console.log(`\n${colors.red}❌ TESTE FALHOU - Duplicação detectada${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✅ TESTE PASSOU - Nenhuma duplicação detectada!${colors.reset}`);
    }

    // Mostrar IDs únicos
    console.log(`\n${colors.blue}🔑 IDs únicos gerados:${colors.reset}`);
    const ids = Array.from(this.messageIds);
    ids.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });

    // Verificar padrão de IDs
    console.log(`\n${colors.blue}🔍 Análise de padrões de ID:${colors.reset}`);
    const userIds = ids.filter(id => id.startsWith('user_'));
    const assistantIds = ids.filter(id => id.startsWith('assistant_'));
    const errorIds = ids.filter(id => id.startsWith('error_'));
    const numericIds = ids.filter(id => /^\d+$/.test(id));

    console.log(`  • IDs de usuário (user_*): ${userIds.length}`);
    console.log(`  • IDs de assistente (assistant_*): ${assistantIds.length}`);
    console.log(`  • IDs de erro (error_*): ${errorIds.length}`);
    console.log(`  • IDs numéricos (legado): ${numericIds.length}`);

    if (numericIds.length > 0) {
      console.log(`\n${colors.yellow}⚠️  Aviso: Ainda existem ${numericIds.length} IDs no formato antigo (numérico)${colors.reset}`);
    }
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
  const tester = new DeduplicationTester();
  
  try {
    await tester.runTest();
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}❌ Erro fatal: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Verificar se socket.io-client está instalado
try {
  require.resolve('socket.io-client');
} catch (e) {
  console.log(`${colors.yellow}📦 Instalando dependências...${colors.reset}`);
  require('child_process').execSync('npm install socket.io-client', { stdio: 'inherit' });
}

// Executar
main().catch(console.error);