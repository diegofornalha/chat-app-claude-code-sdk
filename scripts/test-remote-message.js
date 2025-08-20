#!/usr/bin/env node

/**
 * Script para testar envio de mensagem remota e comportamento
 * 
 * Este script simula o cenário exato:
 * 1. Conecta como cliente remoto
 * 2. Envia mensagens
 * 3. Monitora todas as respostas
 * 4. Verifica duplicação e comportamento correto
 */

const io = require('socket.io-client');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const readline = require('readline');

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
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

class RemoteMessageTester {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.messageHistory = [];
    this.messageIds = new Map(); // ID -> contagem
    this.sessionMessages = new Map(); // sessionId -> mensagens
    this.streamBuffer = '';
    this.currentStreaming = false;
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
        console.log(`${colors.gray}Socket ID: ${this.socket.id}${colors.reset}`);
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
    console.log(`${colors.gray}🎧 Configurando listeners...${colors.reset}\n`);

    // Listener para sessão criada
    this.socket.on('session_created', (session) => {
      this.sessionId = session.id;
      console.log(`${colors.magenta}📋 SESSÃO CRIADA:${colors.reset}`);
      console.log(`   ID: ${colors.white}${session.id}${colors.reset}`);
      console.log(`   Timestamp: ${new Date().toISOString()}\n`);
    });

    // Listener para mensagens
    this.socket.on('message', (message) => {
      this.handleMessage(message, 'MESSAGE');
    });

    // Listener para mensagens completas
    this.socket.on('message_complete', (message) => {
      this.handleMessage(message, 'MESSAGE_COMPLETE');
      this.currentStreaming = false;
      this.streamBuffer = '';
    });

    // Listener para stream
    this.socket.on('message_stream', (data) => {
      if (!this.currentStreaming) {
        console.log(`${colors.magenta}🌊 INÍCIO DO STREAM:${colors.reset}`);
        this.currentStreaming = true;
      }
      this.streamBuffer = data.fullContent || data.content || '';
      process.stdout.write(`${colors.gray}   [Streaming ${this.streamBuffer.length} chars...]${colors.reset}\r`);
    });

    // Listener para typing
    this.socket.on('typing_start', () => {
      console.log(`${colors.gray}⌨️  Assistente digitando...${colors.reset}`);
    });

    this.socket.on('typing_end', () => {
      console.log(`${colors.gray}⌨️  Digitação concluída${colors.reset}`);
    });

    // Listener para processing steps
    this.socket.on('processing_step', (step) => {
      console.log(`${colors.gray}⚙️  Processando: ${step.message || step.step}${colors.reset}`);
    });

    // Listener para erros
    this.socket.on('error', (error) => {
      console.error(`\n${colors.red}❌ ERRO RECEBIDO:${colors.reset}`);
      console.error(`   ${colors.red}${error.message || error.error || error}${colors.reset}\n`);
    });

    // Listener para estatísticas
    this.socket.on('connection_stats', (stats) => {
      console.log(`${colors.gray}📊 Stats: ${stats.active_connections} conexões, ${stats.active_sessions} sessões${colors.reset}`);
    });
  }

  handleMessage(message, eventType) {
    console.log(`\n${colors.yellow}📨 ${eventType}:${colors.reset}`);
    
    // Verificar duplicação
    const count = (this.messageIds.get(message.id) || 0) + 1;
    this.messageIds.set(message.id, count);
    
    if (count > 1) {
      console.log(`   ${colors.red}⚠️  DUPLICATA DETECTADA! (${count}ª vez)${colors.reset}`);
    }

    // Detalhes da mensagem
    console.log(`   ID: ${colors.white}${message.id}${colors.reset}`);
    console.log(`   Tipo: ${colors.blue}${message.type}${colors.reset}`);
    console.log(`   Sessão: ${colors.magenta}${message.sessionId || 'N/A'}${colors.reset}`);
    
    // Verificar se a sessão está correta
    if (message.sessionId && message.sessionId !== this.sessionId) {
      console.log(`   ${colors.red}⚠️  SESSÃO INCORRETA! Esperado: ${this.sessionId}${colors.reset}`);
    }
    
    // Conteúdo
    const content = message.content || this.streamBuffer;
    if (content) {
      const preview = content.substring(0, 100);
      console.log(`   Conteúdo: "${colors.white}${preview}${content.length > 100 ? '...' : ''}${colors.reset}"`);
      console.log(`   Tamanho: ${content.length} caracteres`);
    }

    // Metadata adicional
    if (message.cost) console.log(`   Custo: ${message.cost}`);
    if (message.duration) console.log(`   Duração: ${message.duration}ms`);
    if (message.turns) console.log(`   Turnos: ${message.turns}`);
    if (message.agent) console.log(`   Agente: ${message.agent}`);

    // Adicionar ao histórico
    this.messageHistory.push({
      eventType,
      message,
      timestamp: new Date().toISOString(),
      duplicate: count > 1
    });

    // Adicionar ao mapa de sessões
    if (message.sessionId) {
      if (!this.sessionMessages.has(message.sessionId)) {
        this.sessionMessages.set(message.sessionId, []);
      }
      this.sessionMessages.get(message.sessionId).push(message);
    }
  }

  async sendMessage(content) {
    console.log(`\n${colors.blue}📤 ENVIANDO MENSAGEM:${colors.reset}`);
    console.log(`   Conteúdo: "${colors.white}${content}${colors.reset}"`);
    console.log(`   Sessão: ${colors.magenta}${this.sessionId}${colors.reset}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    
    this.socket.emit('send_message', {
      message: content,
      sessionId: this.sessionId
    });

    console.log(`${colors.green}   ✓ Mensagem enviada${colors.reset}\n`);
  }

  async runAutomatedTest() {
    console.log(`\n${colors.magenta}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.magenta}🤖 TESTE AUTOMATIZADO DE MENSAGEM REMOTA${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(70)}${colors.reset}\n`);

    // Criar sessão
    this.socket.emit('create_session');
    await sleep(1000);

    // Enviar sequência de mensagens
    const testMessages = [
      'oi',
      'tudo bem?',
      'me fala sobre o conductor'
    ];

    for (const msg of testMessages) {
      await this.sendMessage(msg);
      await sleep(5000); // Aguardar resposta completa
    }

    // Analisar resultados
    this.analyzeResults();
  }

  async runInteractiveMode() {
    console.log(`\n${colors.magenta}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.magenta}💬 MODO INTERATIVO DE TESTE REMOTO${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(70)}${colors.reset}\n`);
    
    console.log(`${colors.gray}Comandos disponíveis:${colors.reset}`);
    console.log(`  ${colors.white}/quit${colors.reset} - Sair`);
    console.log(`  ${colors.white}/stats${colors.reset} - Ver estatísticas`);
    console.log(`  ${colors.white}/clear${colors.reset} - Limpar histórico`);
    console.log(`  ${colors.white}/session${colors.reset} - Criar nova sessão`);
    console.log(`  ${colors.white}Qualquer texto${colors.reset} - Enviar mensagem\n`);

    // Criar sessão inicial
    this.socket.emit('create_session');
    await sleep(1000);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.blue}> ${colors.reset}`
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      
      if (input === '/quit') {
        this.analyzeResults();
        rl.close();
        return;
      }
      
      if (input === '/stats') {
        this.showStats();
      } else if (input === '/clear') {
        this.messageHistory = [];
        this.messageIds.clear();
        console.log(`${colors.green}✓ Histórico limpo${colors.reset}`);
      } else if (input === '/session') {
        this.socket.emit('create_session');
        console.log(`${colors.green}✓ Criando nova sessão...${colors.reset}`);
      } else if (input) {
        await this.sendMessage(input);
      }
      
      setTimeout(() => rl.prompt(), 100);
    });

    rl.on('close', () => {
      this.disconnect();
    });
  }

  showStats() {
    console.log(`\n${colors.yellow}📊 ESTATÍSTICAS ATUAIS:${colors.reset}`);
    console.log(`   Mensagens totais: ${this.messageHistory.length}`);
    console.log(`   IDs únicos: ${this.messageIds.size}`);
    console.log(`   Duplicatas: ${Array.from(this.messageIds.values()).filter(c => c > 1).length}`);
    console.log(`   Sessões vistas: ${this.sessionMessages.size}`);
    console.log(`   Sessão atual: ${this.sessionId}\n`);
  }

  analyzeResults() {
    console.log(`\n${colors.magenta}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.magenta}📊 ANÁLISE FINAL${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(70)}${colors.reset}\n`);

    // Estatísticas gerais
    this.showStats();

    // Verificar duplicatas
    const duplicates = Array.from(this.messageIds.entries())
      .filter(([id, count]) => count > 1);
    
    if (duplicates.length > 0) {
      console.log(`${colors.red}⚠️  DUPLICATAS ENCONTRADAS:${colors.reset}`);
      duplicates.forEach(([id, count]) => {
        console.log(`   ID ${id}: apareceu ${count} vezes`);
      });
    } else {
      console.log(`${colors.green}✅ Nenhuma duplicata detectada${colors.reset}`);
    }

    // Verificar consistência de sessão
    const wrongSessionMessages = this.messageHistory.filter(h => 
      h.message.sessionId && h.message.sessionId !== this.sessionId
    );
    
    if (wrongSessionMessages.length > 0) {
      console.log(`\n${colors.red}⚠️  MENSAGENS EM SESSÃO INCORRETA: ${wrongSessionMessages.length}${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ Todas as mensagens na sessão correta${colors.reset}`);
    }

    // Resumo
    console.log(`\n${colors.magenta}${'='.repeat(70)}${colors.reset}`);
    if (duplicates.length === 0 && wrongSessionMessages.length === 0) {
      console.log(`${colors.green}✅✅✅ TESTE PASSOU - COMPORTAMENTO CORRETO ✅✅✅${colors.reset}`);
    } else {
      console.log(`${colors.red}❌❌❌ PROBLEMAS DETECTADOS ❌❌❌${colors.reset}`);
    }
    console.log(`${colors.magenta}${'='.repeat(70)}${colors.reset}\n`);
  }

  disconnect() {
    if (this.socket) {
      console.log(`${colors.blue}👋 Desconectando...${colors.reset}`);
      this.socket.disconnect();
    }
  }
}

// Main
async function main() {
  const tester = new RemoteMessageTester();
  
  try {
    await tester.connect();
    
    // Verificar modo
    const mode = process.argv[2];
    
    if (mode === '--interactive' || mode === '-i') {
      await tester.runInteractiveMode();
    } else {
      await tester.runAutomatedTest();
      tester.disconnect();
    }
    
  } catch (error) {
    console.error(`${colors.red}❌ Erro fatal: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Executar
console.log(`${colors.blue}🚀 Iniciando teste de mensagem remota...${colors.reset}`);
console.log(`${colors.gray}Use --interactive ou -i para modo interativo${colors.reset}\n`);

main().catch(console.error);