const io = require('socket.io-client');

// Conectar ao backend
const socket = io('http://localhost:8080');

console.log('🧪 Teste de Fluxo Real A2A + CrewAI');
console.log('=' .repeat(50));

socket.on('connect', () => {
  console.log('✅ Conectado ao backend');
  
  // Aguardar agentes estarem prontos
  setTimeout(() => {
    console.log('\n📤 Enviando mensagem de teste...');
    
    // Enviar mensagem que requer análise real
    socket.emit('a2a:send_message', {
      message: 'Preciso extrair dados e analisar padrões neste texto',
      sessionId: 'test-real-' + Date.now(),
      useAgent: true
    });
  }, 1000);
});

// Monitorar resposta
let responseBuffer = '';
let streamStarted = false;

socket.on('stream', (data) => {
  if (!streamStarted) {
    console.log('\n📥 Recebendo resposta em stream:');
    streamStarted = true;
  }
  process.stdout.write(data.chunk);
  responseBuffer += data.chunk;
});

socket.on('message', (msg) => {
  if (msg.type === 'assistant') {
    console.log('\n\n✅ Resposta completa recebida!');
    console.log('🤖 Agente:', msg.agent || 'default');
    console.log('📝 Conteúdo:', msg.content.substring(0, 200) + '...');
    console.log('\n🎯 Teste bem-sucedido!');
    
    // Testar outra mensagem com requisitos diferentes
    setTimeout(() => {
      console.log('\n' + '=' .repeat(50));
      console.log('📤 Enviando segunda mensagem...');
      
      socket.emit('a2a:send_message', {
        message: 'Gere um relatório resumido sobre análise de dados',
        sessionId: 'test-real-' + Date.now(),
        useAgent: true
      });
    }, 2000);
  }
});

socket.on('a2a:agents', (data) => {
  console.log('\n🤖 Agentes disponíveis:');
  data.agents.forEach(agent => {
    console.log(`  - ${agent.name}: ${agent.status}`);
  });
});

socket.on('error', (error) => {
  console.error('❌ Erro:', error);
});

// Encerrar após 15 segundos
setTimeout(() => {
  console.log('\n👋 Encerrando teste...');
  socket.disconnect();
  process.exit(0);
}, 15000);