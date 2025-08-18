#!/usr/bin/env node

const io = require('socket.io-client');

const socket = io('http://localhost:8080', {
  transports: ['websocket']
});

const sessionId = 'validation-continue-' + Date.now();

console.log('🧪 TESTE DE SESSÃO CONTÍNUA');
console.log('='.repeat(50));
console.log(`📍 Session: ${sessionId}`);
console.log('='.repeat(50));

const messages = [
  { text: "Olá! Vamos testar se você está funcionando", mode: 'claude' },
  { text: "Analise os dados: A=10, B=20, C=30", mode: 'crew' },
  { text: "Gere um relatório sobre o teste anterior", mode: 'crew' }
];

let messageIndex = 0;

socket.on('connect', () => {
  console.log('✅ Conectado\n');
  sendNextMessage();
});

function sendNextMessage() {
  if (messageIndex >= messages.length) {
    console.log('\n🎉 Todos os testes completados!');
    setTimeout(() => process.exit(0), 2000);
    return;
  }
  
  const msg = messages[messageIndex];
  console.log(`\n📝 MENSAGEM ${messageIndex + 1}/${messages.length}`);
  console.log(`Modo: ${msg.mode.toUpperCase()}`);
  console.log(`Você: ${msg.text}`);
  console.log('\nAssistente:');
  
  if (msg.mode === 'claude') {
    socket.emit('send_message', {
      message: msg.text,
      sessionId: sessionId
    });
  } else {
    // Primeiro selecionar CrewAI se necessário
    if (messageIndex === 1) {
      socket.emit('a2a:select_agent', { agent: 'crew-ai' });
      setTimeout(() => {
        socket.emit('a2a:send_message', {
          message: msg.text,
          sessionId: sessionId,
          useAgent: true
        });
      }, 500);
    } else {
      socket.emit('a2a:send_message', {
        message: msg.text,
        sessionId: sessionId,
        useAgent: true
      });
    }
  }
  
  messageIndex++;
}

// Handlers para respostas
let currentResponse = '';

socket.on('message_stream', (data) => {
  if (data.result) {
    currentResponse += data.result;
    process.stdout.write(data.result);
  }
});

socket.on('stream', (data) => {
  if (data.chunk) {
    currentResponse += data.chunk;
    process.stdout.write(data.chunk);
  }
});

socket.on('message_complete', () => {
  console.log(`\n[Resposta Claude: ${currentResponse.length} chars]`);
  currentResponse = '';
  setTimeout(sendNextMessage, 2000);
});

socket.on('stream_complete', () => {
  console.log(`\n[Resposta CrewAI: ${currentResponse.length} chars]`);
  currentResponse = '';
  setTimeout(sendNextMessage, 2000);
});

socket.on('error', (error) => {
  console.error('❌ Erro:', error);
});

// Timeout de segurança
setTimeout(() => {
  console.log('\n⏱️ Timeout do teste');
  process.exit(1);
}, 30000);