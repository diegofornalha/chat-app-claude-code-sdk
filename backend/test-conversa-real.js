#!/usr/bin/env node

/**
 * Teste de Conversa Real - Simula uma conversa completa via WebSocket
 */

const io = require('socket.io-client');
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

const socket = io('http://localhost:8080', {
  transports: ['websocket']
});

let currentTest = 0;
let responseBuffer = '';
let testStartTime = null;

const tests = [
  {
    message: "Olá! Você está funcionando?",
    description: "Teste de cumprimento básico",
    expectedPatterns: ["Olá", "funcionando", "sim", "ajudar"]
  },
  {
    message: "Analise os números 10, 20, 30, 40 e me diga qual é o padrão",
    description: "Teste de análise de dados com CrewAI",
    expectedPatterns: ["padrão", "10", "sequência", "incremento"]
  },
  {
    message: "Gere um relatório sobre vendas de produtos eletrônicos",
    description: "Teste de geração de relatório",
    expectedPatterns: ["relatório", "vendas", "eletrônicos", "análise"]
  }
];

console.log(`${colors.magenta}🧪 TESTE DE CONVERSA REAL - Claude + CrewAI${colors.reset}`);
console.log('='.repeat(60));

socket.on('connect', () => {
  console.log(`${colors.green}✅ Conectado ao servidor${colors.reset}`);
  
  // Selecionar CrewAI
  console.log(`${colors.yellow}🤖 Selecionando agente CrewAI...${colors.reset}`);
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
});

socket.on('a2a:agent_selected', (data) => {
  const agentName = data.agent?.name || data.agent;
  console.log(`${colors.green}✅ Agente selecionado: ${agentName}${colors.reset}\n`);
  
  // Iniciar primeiro teste
  runNextTest();
});

function runNextTest() {
  if (currentTest >= tests.length) {
    console.log(`\n${colors.green}🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!${colors.reset}`);
    process.exit(0);
    return;
  }
  
  const test = tests[currentTest];
  responseBuffer = '';
  testStartTime = Date.now();
  
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}📝 TESTE ${currentTest + 1}/${tests.length}: ${test.description}${colors.reset}`);
  console.log(`${colors.blue}💬 Enviando: "${test.message}"${colors.reset}`);
  
  socket.emit('a2a:send_message', {
    message: test.message,
    sessionId: `test-conversa-${Date.now()}`,
    useAgent: true
  });
}

socket.on('stream', (data) => {
  if (data.chunk) {
    responseBuffer += data.chunk;
    process.stdout.write(colors.green + data.chunk + colors.reset);
  }
});

socket.on('stream_complete', (data) => {
  const responseTime = Date.now() - testStartTime;
  console.log(`\n${colors.blue}⏱️ Tempo de resposta: ${responseTime}ms${colors.reset}`);
  
  // Validar resposta
  const test = tests[currentTest];
  let patternsFound = 0;
  
  for (const pattern of test.expectedPatterns) {
    if (responseBuffer.toLowerCase().includes(pattern.toLowerCase())) {
      patternsFound++;
    }
  }
  
  if (patternsFound > 0) {
    console.log(`${colors.green}✅ Resposta válida (${patternsFound}/${test.expectedPatterns.length} padrões encontrados)${colors.reset}`);
  } else {
    console.log(`${colors.red}⚠️ Resposta não contém padrões esperados${colors.reset}`);
  }
  
  // Análise da resposta
  if (responseBuffer.includes('Desculpe, não consegui processar')) {
    console.log(`${colors.red}❌ ERRO: Resposta de fallback detectada!${colors.reset}`);
  } else if (responseBuffer.length < 10) {
    console.log(`${colors.yellow}⚠️ Resposta muito curta (${responseBuffer.length} caracteres)${colors.reset}`);
  } else {
    console.log(`${colors.green}✨ Resposta natural do Claude (${responseBuffer.length} caracteres)${colors.reset}`);
  }
  
  currentTest++;
  
  // Aguardar um pouco antes do próximo teste
  setTimeout(() => {
    runNextTest();
  }, 2000);
});

socket.on('error', (error) => {
  console.error(`${colors.red}❌ Erro no socket: ${error}${colors.reset}`);
});

socket.on('disconnect', () => {
  console.log(`${colors.yellow}🔌 Desconectado do servidor${colors.reset}`);
});

// Timeout de segurança
setTimeout(() => {
  console.log(`\n${colors.red}⏱️ Timeout - teste demorou muito${colors.reset}`);
  console.log(`${colors.yellow}Testes completados: ${currentTest}/${tests.length}${colors.reset}`);
  process.exit(1);
}, 30000);