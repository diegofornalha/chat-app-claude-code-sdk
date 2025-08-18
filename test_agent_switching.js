#!/usr/bin/env node

/**
 * Teste para verificar a troca de agentes no Chat App
 * Simula o que acontece quando o usuário tenta trocar de crew-ai para claude (direto)
 */

const io = require('socket.io-client');

console.log('🧪 Iniciando teste de troca de agentes...');

// Conectar ao backend
const socket = io('http://localhost:8080');

socket.on('connect', () => {
  console.log('✅ Conectado ao backend');
  
  // Primeiro, obter lista de agentes
  console.log('📋 Solicitando lista de agentes...');
  socket.emit('a2a:get_agents');
});

socket.on('a2a:agents', (data) => {
  console.log('📋 Agentes disponíveis:', data.agents);
  
  // Encontrar crew-ai
  const crewAi = data.agents.find(a => a.name === 'crew-ai');
  if (crewAi && crewAi.status === 'connected') {
    console.log('🤖 Selecionando crew-ai...');
    socket.emit('a2a:select_agent', { agent: 'crew-ai' });
  } else {
    console.log('❌ CrewAI não está disponível');
    process.exit(1);
  }
});

socket.on('a2a:agent_selected', (data) => {
  console.log('✅ Agente selecionado:', data);
  
  if (data.success && data.agent.name === 'crew-ai') {
    console.log('🔄 Agora tentando trocar para Claude (direto)...');
    
    // Simular a troca para Claude direto (selectedAgent = null)
    // No frontend, isso chamaria onAgentSelect(null) e não emite evento de socket
    console.log('💭 No frontend, isso chamaria onAgentSelect(null)');
    console.log('💭 Não há evento de socket emitido para Claude direto');
    console.log('✅ Troca para Claude (direto) deveria funcionar instantaneamente');
    
    // Vamos testar selecionando crew-ai novamente para ver se há problemas
    setTimeout(() => {
      console.log('🔄 Tentando selecionar crew-ai novamente...');
      socket.emit('a2a:select_agent', { agent: 'crew-ai' });
    }, 2000);
  }
});

socket.on('a2a:error', (data) => {
  console.error('❌ Erro A2A:', data.error);
});

socket.on('disconnect', () => {
  console.log('🔌 Desconectado do backend');
});

// Timeout para finalizar o teste
setTimeout(() => {
  console.log('⏰ Finalizando teste...');
  socket.disconnect();
  process.exit(0);
}, 10000);