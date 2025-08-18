const io = require('socket.io-client');

// Conectar ao backend
const socket = io('http://localhost:8080');

console.log('🗣️ Teste de Conversa Natural com Claude + CrewAI');
console.log('=' .repeat(50));

let messageCount = 0;
const messages = [
  "Olá! Como você está hoje?",
  "Preciso analisar alguns dados de vendas",
  "Você pode me ajudar a extrair padrões desses dados?",
  "Gere um relatório resumido sobre isso"
];

socket.on('connect', () => {
  console.log('✅ Conectado ao backend\n');
  
  // Selecionar agente CrewAI
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
});

socket.on('a2a:agent_selected', (data) => {
  console.log('🤖 Agente selecionado:', data.agent);
  console.log('\n' + '=' .repeat(50));
  sendNextMessage();
});

function sendNextMessage() {
  if (messageCount < messages.length) {
    const message = messages[messageCount];
    console.log(`\n👤 USUÁRIO: "${message}"`);
    
    socket.emit('a2a:send_message', {
      message: message,
      sessionId: 'natural-conv-' + Date.now(),
      useAgent: true
    });
    
    messageCount++;
  } else {
    setTimeout(() => {
      console.log('\n' + '=' .repeat(50));
      console.log('✅ Conversa finalizada!');
      process.exit(0);
    }, 3000);
  }
}

// Monitorar resposta completa
let currentResponse = '';
let isStreaming = false;

socket.on('stream', (data) => {
  if (!isStreaming) {
    console.log('\n🤖 CLAUDE+CREWAI: ', { end: '' });
    isStreaming = true;
  }
  process.stdout.write(data.chunk);
  currentResponse += data.chunk;
});

socket.on('message', (msg) => {
  if (msg.type === 'assistant') {
    console.log(''); // Nova linha após streaming
    isStreaming = false;
    currentResponse = '';
    
    // Análise da resposta
    console.log(`\n📊 Análise da Resposta:`);
    console.log(`   - Natural? ${msg.content.includes('.') || msg.content.includes('!') ? '✅' : '❌'}`);
    console.log(`   - Contextual? ${msg.content.length > 50 ? '✅' : '❌'}`);
    console.log(`   - Menciona CrewAI? ${msg.content.toLowerCase().includes('crew') ? '✅' : '❌'}`);
    
    // Aguardar antes da próxima mensagem
    setTimeout(sendNextMessage, 2000);
  }
});

socket.on('error', (error) => {
  console.error('\n❌ Erro:', error);
});

// Timeout geral
setTimeout(() => {
  console.log('\n⏱️ Timeout - encerrando teste...');
  process.exit(0);
}, 30000);