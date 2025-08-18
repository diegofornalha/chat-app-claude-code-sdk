#!/usr/bin/env node

const io = require('socket.io-client');

const socket = io('http://localhost:8080', {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Connected');
  
  // Selecionar CrewAI
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
  
  setTimeout(() => {
    console.log('📤 Sending test message...');
    socket.emit('a2a:send_message', {
      message: 'Olá, teste simples',
      sessionId: 'test-' + Date.now(),
      useAgent: true  // IMPORTANTE: habilitar uso do agente A2A
    });
  }, 500);
});

socket.on('a2a:agent_selected', (data) => {
  console.log('🤖 Agent selected:', JSON.stringify(data, null, 2));
});

socket.on('stream', (data) => {
  console.log('📥 Stream:', data.chunk);
});

socket.on('stream_complete', () => {
  console.log('✅ Stream complete');
  process.exit(0);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Safety timeout
setTimeout(() => {
  console.log('⏱️ Timeout');
  process.exit(1);
}, 8000);