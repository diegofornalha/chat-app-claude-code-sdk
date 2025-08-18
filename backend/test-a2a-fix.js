#!/usr/bin/env node

/**
 * Test A2A Fix - Valida que o Claude SDK agora responde corretamente no contexto A2A
 */

const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:8080';

console.log('🧪 TESTE: Validação da Correção A2A + Claude SDK');
console.log('=' .repeat(60));

const socket = io(BACKEND_URL, {
  transports: ['websocket'],
  reconnection: false
});

let testResults = {
  connection: false,
  agentSwitch: false,
  claudeResponse: false,
  crewAIIntegration: false,
  noFallback: false
};

socket.on('connect', () => {
  console.log('✅ Conectado ao backend');
  testResults.connection = true;
  
  // Primeiro, trocar para CrewAI
  console.log('\n📋 Teste 1: Trocar para agente CrewAI');
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
});

socket.on('a2a:agent_selected', (data) => {
  const selectedAgent = data.agent?.name || data.agent;
  console.log(`✅ Agente selecionado: ${selectedAgent}`);
  testResults.agentSwitch = true;
  
  if (selectedAgent === 'crew-ai') {
    // Enviar mensagem de teste para o pipeline A2A
    console.log('\n📋 Teste 2: Enviar mensagem simples "oi" via A2A');
    socket.emit('a2a:send_message', {
      message: 'oi',
      sessionId: 'test-fix-' + Date.now()
    });
  }
});

let responseContent = '';
let hasClaudeContent = false;

socket.on('stream', (data) => {
  responseContent += data.chunk;
  process.stdout.write(data.chunk);
  
  // Verificar se não é a mensagem de fallback
  if (!data.chunk.includes('Desculpe, não consegui processar')) {
    hasClaudeContent = true;
  }
});

socket.on('stream_complete', () => {
  console.log('\n\n📊 Análise da Resposta:');
  console.log('-'.repeat(40));
  
  testResults.claudeResponse = hasClaudeContent;
  testResults.noFallback = !responseContent.includes('Desculpe, não consegui processar');
  
  // Teste 3: Enviar mensagem que deveria acionar CrewAI
  console.log('\n📋 Teste 3: Enviar mensagem para análise de dados');
  socket.emit('a2a:send_message', {
    message: 'analise os números 10, 20, 30 e identifique padrões',
    sessionId: 'test-analysis-' + Date.now()
  });
  
  setTimeout(() => {
    // Teste 4: Verificar logs do servidor (seria ideal capturar via processo)
    console.log('\n\n🎯 RESULTADOS DO TESTE:');
    console.log('=' .repeat(40));
    console.log(`✅ Conexão estabelecida: ${testResults.connection ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Troca de agente funciona: ${testResults.agentSwitch ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Claude responde no A2A: ${testResults.claudeResponse ? 'SIM ✨' : 'NÃO ❌'}`);
    console.log(`✅ Sem mensagens de fallback: ${testResults.noFallback ? 'SIM ✨' : 'NÃO ❌'}`);
    
    if (testResults.claudeResponse && testResults.noFallback) {
      console.log('\n🎉 SUCESSO! Claude SDK está funcionando corretamente no contexto A2A!');
    } else {
      console.log('\n⚠️ AINDA HÁ PROBLEMAS - Verificar logs do servidor para detalhes');
    }
    
    process.exit(0);
  }, 5000);
});

socket.on('error', (error) => {
  console.error('❌ Erro no socket:', error);
});

socket.on('disconnect', () => {
  console.log('🔌 Desconectado do backend');
});

// Timeout de segurança
setTimeout(() => {
  console.log('\n⏱️ Timeout - finalizando teste...');
  process.exit(1);
}, 10000);