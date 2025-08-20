// Script de teste para verificar contexto
const io = require('socket.io-client');

const socket = io('http://localhost:8080');

const sessionId = `test-session-${Date.now()}`;

socket.on('connect', () => {
  console.log('✅ Conectado ao servidor');
  
  // Enviar primeira mensagem
  console.log('\n📤 Enviando: "meu nome é Diego"');
  socket.emit('send_message', {
    message: 'meu nome é Diego',
    content: 'meu nome é Diego',
    sessionId: sessionId,
    messageId: `msg-1-${Date.now()}`
  });
});

socket.on('message_complete', (response) => {
  console.log('\n📥 Resposta recebida:');
  console.log('  ID:', response.id);
  console.log('  Conteúdo:', response.content?.substring(0, 100) + '...');
  
  // Esperar 2 segundos e enviar segunda mensagem
  setTimeout(() => {
    console.log('\n📤 Enviando: "qual é meu nome?"');
    socket.emit('send_message', {
      message: 'qual é meu nome?',
      content: 'qual é meu nome?',
      sessionId: sessionId,
      messageId: `msg-2-${Date.now()}`
    });
  }, 2000);
});

socket.on('error', (error) => {
  console.error('❌ Erro:', error);
});

// Timeout de segurança
setTimeout(() => {
  console.log('\n⏱️ Teste finalizado');
  process.exit(0);
}, 30000);