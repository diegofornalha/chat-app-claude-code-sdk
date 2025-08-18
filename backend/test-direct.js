const io = require('socket.io-client');

// Conectar ao backend
const socket = io('http://localhost:8080');

console.log('🧪 Teste Direto de Mensagem A2A');
console.log('=' .repeat(50));

socket.on('connect', () => {
  console.log('✅ Conectado ao backend');
  
  // Primeiro, selecionar o agente
  console.log('📌 Selecionando agente crew-ai...');
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
});

socket.on('a2a:agent_selected', (data) => {
  console.log('✅ Agente selecionado:', data.agent);
  
  // Agora enviar mensagem
  console.log('\n📤 Enviando mensagem para CrewAI...');
  socket.emit('a2a:send_message', {
    message: 'Teste: extrair dados e analisar padrões',
    sessionId: 'test-direct-' + Date.now(),
    useAgent: true
  });
});

// Monitorar todos os eventos
socket.on('stream', (data) => {
  console.log('📥 Stream:', data.chunk);
});

socket.on('message', (msg) => {
  console.log('💬 Mensagem:', msg);
});

socket.on('a2a:message_response', (data) => {
  console.log('🤖 Resposta A2A:', data);
});

socket.on('error', (error) => {
  console.error('❌ Erro:', error);
});

// Debug: monitorar qualquer evento
socket.onAny((eventName, ...args) => {
  if (!['stream', 'message', 'a2a:agent_selected'].includes(eventName)) {
    console.log(`📡 Evento: ${eventName}`, args);
  }
});

// Encerrar após 10 segundos
setTimeout(() => {
  console.log('\n👋 Encerrando teste...');
  socket.disconnect();
  process.exit(0);
}, 10000);