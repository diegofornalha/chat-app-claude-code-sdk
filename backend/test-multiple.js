const io = require('socket.io-client');

const testMessages = ['oi', 'teste', 'analyze data', 'olá'];
let currentTest = 0;

console.log('🔌 Iniciando testes múltiplos...');
const socket = io('http://localhost:8080');

socket.on('connect', () => {
  console.log('✅ Conectado!');
});

socket.on('a2a:agents', (data) => {
  const crewAi = data.agents?.find(a => a.name === 'crew-ai' && a.status === 'connected');
  if (crewAi && currentTest === 0) {
    socket.emit('a2a:select_agent', { agent: 'crew-ai' });
  }
});

socket.on('a2a:agent_selected', (data) => {
  if (data.success && currentTest < testMessages.length) {
    sendNextMessage();
  }
});

function sendNextMessage() {
  if (currentTest >= testMessages.length) {
    console.log('\n✅ TODOS OS TESTES COMPLETOS!');
    socket.disconnect();
    process.exit(0);
    return;
  }
  
  const message = testMessages[currentTest];
  console.log(`\n📤 Teste ${currentTest + 1}: "${message}"`);
  
  socket.emit('a2a:send_message', {
    message: message,
    sessionId: 'test-' + Date.now(),
    useAgent: true
  });
}

socket.on('message', (data) => {
  if (data.type === 'assistant') {
    console.log(`✅ Resposta: "${data.content.substring(0, 60)}..."`);
    currentTest++;
    setTimeout(sendNextMessage, 1000);
  }
});

socket.on('a2a:error', (error) => {
  console.error('❌ Erro:', error);
});

setTimeout(() => {
  console.log('⏱️ Timeout');
  process.exit(1);
}, 30000);