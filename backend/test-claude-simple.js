const io = require('socket.io-client');

// Conectar ao backend
const socket = io('http://localhost:8080');

console.log('🧪 Teste Simples Claude SDK');
console.log('=' .repeat(50));

socket.on('connect', () => {
  console.log('✅ Conectado');
  
  // Selecionar CrewAI e enviar mensagem simples
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
});

socket.on('a2a:agent_selected', () => {
  console.log('📤 Enviando: "olá"');
  
  socket.emit('a2a:send_message', {
    message: 'olá',
    sessionId: 'test-simple',
    useAgent: true
  });
});

socket.on('stream', (data) => {
  console.log('📥 Stream chunk:', data.chunk);
});

socket.on('message', (msg) => {
  if (msg.type === 'assistant') {
    console.log('\n✅ Resposta completa:', msg.content);
    setTimeout(() => process.exit(0), 1000);
  }
});

setTimeout(() => {
  console.log('⏱️ Timeout');
  process.exit(1);
}, 10000);