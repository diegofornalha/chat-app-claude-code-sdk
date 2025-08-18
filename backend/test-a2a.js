const io = require('socket.io-client');

console.log('🔌 Iniciando teste A2A...');
const socket = io('http://localhost:8080');

let testComplete = false;

socket.on('connect', () => {
  console.log('✅ Conectado! Socket ID:', socket.id);
});

socket.on('a2a:agents', (data) => {
  console.log('📋 Agentes disponíveis:', 
    data.agents?.map(a => `${a.name} (${a.status})`).join(', '));
  
  // Selecionar crew-ai se disponível
  const crewAi = data.agents?.find(a => a.name === 'crew-ai' && a.status === 'connected');
  if (crewAi && !testComplete) {
    console.log('🤖 Selecionando crew-ai...');
    socket.emit('a2a:select_agent', { agent: 'crew-ai' });
  }
});

socket.on('a2a:agent_selected', (data) => {
  console.log('✅ Agente selecionado:', data.success ? data.agent.name : 'erro');
  
  if (data.success && !testComplete) {
    // Enviar mensagem de teste
    setTimeout(() => {
      console.log('📤 Enviando mensagem: "oi"');
      socket.emit('a2a:send_message', {
        message: 'oi',
        sessionId: 'test-' + Date.now(),
        useAgent: true
      });
    }, 500);
  }
});

socket.on('message', (data) => {
  console.log('\n💬 MENSAGEM RECEBIDA:', {
    type: data.type,
    content: data.content,
    agent: data.agent,
    timestamp: new Date(data.timestamp).toLocaleTimeString()
  });
  
  if (data.type === 'assistant') {
    testComplete = true;
    console.log('\n✅ TESTE COMPLETO - Resposta recebida com sucesso!');
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 1000);
  }
});

socket.on('stream', (data) => {
  process.stdout.write(`[STREAM] ${data.chunk}`);
});

socket.on('stream_end', (data) => {
  console.log('\n📝 Stream finalizado para sessão:', data.sessionId);
});

socket.on('typing_start', () => {
  console.log('⌨️ Claude começou a digitar...');
});

socket.on('typing_stop', () => {
  console.log('⌨️ Claude parou de digitar');
});

socket.on('processing_step', (step) => {
  console.log('🔄 Processando:', step.message);
});

socket.on('a2a:message_response', (data) => {
  console.log('🤖 RESPOSTA A2A ADICIONAL:', data);
});

socket.on('a2a:error', (error) => {
  console.error('❌ ERRO A2A:', error);
});

socket.on('error', (error) => {
  console.error('❌ Erro de socket:', error);
});

// Timeout de segurança
setTimeout(() => {
  if (!testComplete) {
    console.log('\n⏱️ TIMEOUT - Teste não completou em 20 segundos');
    process.exit(1);
  }
}, 20000);