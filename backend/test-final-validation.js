#!/usr/bin/env node

const io = require('socket.io-client');

console.log('🎯 TESTE FINAL DE VALIDAÇÃO');
console.log('='.repeat(50));

const socket = io('http://localhost:8080', { 
  transports: ['websocket'],
  reconnection: false 
});

let testPhase = 'connecting';
let responses = {
  claude: '',
  crewai: ''
};

socket.on('connect', () => {
  console.log('✅ Conectado ao servidor\n');
  testPhase = 'claude-direct';
  
  console.log('📝 FASE 1: Testando Claude Direto');
  console.log('-'.repeat(40));
  console.log('Enviando: "Olá, responda com OK se funciona"');
  
  socket.emit('send_message', {
    message: 'Olá, responda com OK se funciona',
    sessionId: 'validation-claude-' + Date.now()
  });
});

socket.on('message_stream', (data) => {
  if (testPhase === 'claude-direct' && data.result) {
    responses.claude += data.result;
    process.stdout.write(data.result);
  }
});

socket.on('message_complete', () => {
  if (testPhase === 'claude-direct') {
    console.log('\n');
    console.log(`✅ Claude respondeu: ${responses.claude.length} caracteres`);
    
    if (responses.claude.length > 0) {
      console.log('✨ Claude está funcionando!\n');
    } else {
      console.log('❌ Claude não respondeu\n');
    }
    
    // Testar CrewAI
    testPhase = 'crewai-a2a';
    console.log('📝 FASE 2: Testando CrewAI via A2A');
    console.log('-'.repeat(40));
    
    // Selecionar CrewAI
    socket.emit('a2a:select_agent', { agent: 'crew-ai' });
  }
});

socket.on('a2a:agent_selected', (data) => {
  console.log(`Agente selecionado: ${data.agent?.name || 'crew-ai'}`);
  console.log('Enviando: "Teste CrewAI funcionando?"\n');
  
  socket.emit('a2a:send_message', {
    message: 'Teste CrewAI funcionando?',
    sessionId: 'validation-crew-' + Date.now(),
    useAgent: true
  });
});

socket.on('stream', (data) => {
  if (testPhase === 'crewai-a2a' && data.chunk) {
    responses.crewai += data.chunk;
    process.stdout.write(data.chunk);
  }
});

socket.on('stream_complete', () => {
  if (testPhase === 'crewai-a2a') {
    console.log('\n');
    console.log(`✅ CrewAI respondeu: ${responses.crewai.length} caracteres`);
    
    if (responses.crewai.length > 0 && !responses.crewai.includes('Desculpe, não consegui processar')) {
      console.log('✨ CrewAI está funcionando!\n');
    } else {
      console.log('❌ CrewAI não respondeu corretamente\n');
    }
    
    // Resultado final
    console.log('='.repeat(50));
    console.log('📊 RESULTADO FINAL:');
    console.log('-'.repeat(40));
    
    const claudeOk = responses.claude.length > 0;
    const crewOk = responses.crewai.length > 0 && !responses.crewai.includes('Desculpe, não consegui processar');
    
    console.log(`Claude Direto: ${claudeOk ? '✅ FUNCIONANDO' : '❌ FALHOU'}`);
    console.log(`CrewAI (A2A): ${crewOk ? '✅ FUNCIONANDO' : '❌ FALHOU'}`);
    
    if (claudeOk && crewOk) {
      console.log('\n🎉 SISTEMA COMPLETAMENTE FUNCIONAL!');
    } else if (claudeOk) {
      console.log('\n⚠️ Claude funciona mas CrewAI tem problemas');
    } else {
      console.log('\n❌ Sistema com problemas');
    }
    
    process.exit(0);
  }
});

socket.on('error', (error) => {
  console.error('❌ Erro:', error.message);
  process.exit(1);
});

// Timeout de segurança
setTimeout(() => {
  console.log('\n⏱️ Timeout do teste');
  console.log('Claude respondeu:', responses.claude.length, 'chars');
  console.log('CrewAI respondeu:', responses.crewai.length, 'chars');
  process.exit(1);
}, 25000);