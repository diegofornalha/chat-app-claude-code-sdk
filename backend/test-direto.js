#!/usr/bin/env node

const io = require('socket.io-client');
const socket = io('http://localhost:8080', { transports: ['websocket'] });

console.log('🧪 TESTE DIRETO E SIMPLES');
console.log('='.repeat(40));

socket.on('connect', () => {
  console.log('✅ Conectado');
  
  // Testar modo Claude direto primeiro
  console.log('\n1️⃣ Testando Claude DIRETO (sem A2A)...');
  socket.emit('send_message', {
    message: 'Diga "teste ok" se estiver funcionando',
    sessionId: 'test-direto-' + Date.now()
  });
});

let claudeResponse = '';
let crewResponse = '';
let currentMode = 'claude';

socket.on('message_stream', (data) => {
  if (currentMode === 'claude') {
    claudeResponse += data.result || '';
    process.stdout.write(data.result || '');
  }
});

socket.on('stream', (data) => {
  if (currentMode === 'crew') {
    crewResponse += data.chunk || '';
    process.stdout.write(data.chunk || '');
  }
});

socket.on('message_complete', () => {
  if (currentMode === 'claude') {
    console.log('\n✅ Claude direto respondeu:', claudeResponse.length, 'caracteres');
    
    // Agora testar CrewAI
    console.log('\n2️⃣ Testando CrewAI via A2A...');
    currentMode = 'crew';
    
    socket.emit('a2a:select_agent', { agent: 'crew-ai' });
    
    setTimeout(() => {
      socket.emit('a2a:send_message', {
        message: 'Diga "crew ok" se estiver funcionando',
        sessionId: 'test-crew-' + Date.now(),
        useAgent: true
      });
    }, 1000);
  }
});

socket.on('stream_complete', () => {
  if (currentMode === 'crew') {
    console.log('\n✅ CrewAI respondeu:', crewResponse.length, 'caracteres');
    
    console.log('\n📊 RESUMO:');
    console.log('- Claude direto:', claudeResponse.includes('teste ok') ? '✅ OK' : '❌ FALHOU');
    console.log('- CrewAI (A2A):', crewResponse.length > 10 ? '✅ OK' : '❌ FALHOU');
    
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('\n⏱️ Timeout');
  console.log('Claude respondeu:', claudeResponse.length, 'chars');
  console.log('CrewAI respondeu:', crewResponse.length, 'chars');
  process.exit(1);
}, 15000);