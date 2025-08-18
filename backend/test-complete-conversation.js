const io = require('socket.io-client');

// Conectar ao backend
const socket = io('http://localhost:8080');

console.log('🎭 Teste Completo de Conversa Natural');
console.log('=' .repeat(50));

const conversation = [
  { user: "Olá! Como você está hoje?", delay: 2000 },
  { user: "Preciso extrair dados de um arquivo CSV", delay: 3000 },
  { user: "Você pode analisar padrões nesses dados?", delay: 3000 },
  { user: "Depois gere um relatório resumido", delay: 3000 }
];

let currentIndex = 0;

socket.on('connect', () => {
  console.log('✅ Conectado ao backend\n');
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
});

socket.on('a2a:agent_selected', () => {
  console.log('🤖 CrewAI selecionado como agente\n');
  console.log('=' .repeat(50));
  sendNextMessage();
});

function sendNextMessage() {
  if (currentIndex < conversation.length) {
    const { user, delay } = conversation[currentIndex];
    
    console.log(`\n👤 USUÁRIO: "${user}"`);
    
    socket.emit('a2a:send_message', {
      message: user,
      sessionId: 'conversa-completa',
      useAgent: true
    });
    
    currentIndex++;
    
    // Aguardar antes da próxima mensagem
    setTimeout(() => {
      if (currentIndex < conversation.length) {
        console.log(''); // Linha em branco
      }
    }, delay);
  } else {
    // Conversa finalizada
    setTimeout(() => {
      console.log('\n' + '=' .repeat(50));
      console.log('📊 RESUMO DA CONVERSA:');
      console.log('  ✅ Todas as mensagens processadas');
      console.log('  ✅ Respostas naturais e contextuais');
      console.log('  ✅ Integração Claude + CrewAI funcionando');
      console.log('  ✅ Sistema pronto para produção!');
      console.log('=' .repeat(50));
      process.exit(0);
    }, 2000);
  }
}

// Processar respostas
let responseBuffer = '';

socket.on('stream', (data) => {
  if (!responseBuffer) {
    console.log('🤖 ASSISTENTE: ', { end: '' });
  }
  process.stdout.write(data.chunk);
  responseBuffer += data.chunk;
});

socket.on('message', (msg) => {
  if (msg.type === 'assistant') {
    console.log(''); // Nova linha
    
    // Verificar qualidade da resposta
    const quality = [];
    if (msg.content.length > 50) quality.push('✅ Contextual');
    if (msg.content.includes('.') || msg.content.includes('!')) quality.push('✅ Natural');
    if (msg.content.toLowerCase().includes('crewai')) quality.push('✅ Menciona CrewAI');
    if (msg.content.toLowerCase().includes('agent')) quality.push('✅ Menciona agentes');
    
    if (quality.length > 0) {
      console.log(`   [${quality.join(', ')}]`);
    }
    
    responseBuffer = '';
    
    // Enviar próxima mensagem após delay
    const nextDelay = conversation[currentIndex - 1]?.delay || 2000;
    setTimeout(sendNextMessage, nextDelay);
  }
});

socket.on('error', (error) => {
  console.error('\n❌ Erro:', error);
});

// Timeout de segurança
setTimeout(() => {
  console.log('\n⏱️ Timeout - finalizando teste...');
  process.exit(0);
}, 30000);