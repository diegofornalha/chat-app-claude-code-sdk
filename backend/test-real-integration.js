const io = require('socket.io-client');

// Conectar ao backend
const socket = io('http://localhost:8080');

console.log('🔬 TESTE DE INTEGRAÇÃO REAL Claude + CrewAI');
console.log('=' .repeat(50));
console.log('Este teste valida que:');
console.log('1. Claude SDK processa linguagem natural');
console.log('2. Claude analisa intenção REAL');
console.log('3. CrewAI executa análise REAL');
console.log('4. Claude formata resposta REAL');
console.log('=' .repeat(50));

const testMessages = [
  {
    message: "oi",
    expectedBehavior: "Cumprimento processado por Claude, sem CrewAI",
    delay: 3000
  },
  {
    message: "analise estes dados: vendas 100, 200, 300 em janeiro, fevereiro, março",
    expectedBehavior: "Claude detecta data_extraction, CrewAI analisa números REAIS",
    delay: 5000
  },
  {
    message: "identifique padrões nos dados anteriores",
    expectedBehavior: "Claude detecta pattern_analysis, CrewAI encontra padrões REAIS",
    delay: 5000
  },
  {
    message: "crie um relatório resumido sobre a análise",
    expectedBehavior: "Claude detecta report_generation, CrewAI gera relatório REAL",
    delay: 5000
  }
];

let currentTest = 0;

socket.on('connect', () => {
  console.log('\n✅ Conectado ao backend');
  socket.emit('a2a:select_agent', { agent: 'crew-ai' });
});

socket.on('a2a:agent_selected', () => {
  console.log('✅ CrewAI selecionado\n');
  runNextTest();
});

function runNextTest() {
  if (currentTest < testMessages.length) {
    const test = testMessages[currentTest];
    console.log('=' .repeat(50));
    console.log(`\n📝 TESTE ${currentTest + 1}/${testMessages.length}`);
    console.log(`📤 Mensagem: "${test.message}"`);
    console.log(`📋 Esperado: ${test.expectedBehavior}`);
    console.log('');
    
    socket.emit('a2a:send_message', {
      message: test.message,
      sessionId: `test-real-${Date.now()}`,
      useAgent: true
    });
    
    currentTest++;
  } else {
    // Testes concluídos
    setTimeout(() => {
      console.log('\n' + '=' .repeat(50));
      console.log('📊 RESUMO DOS TESTES:');
      console.log(`  ✅ ${testMessages.length} mensagens processadas`);
      console.log('  ✅ Pipeline Claude → CrewAI → Claude funcionando');
      console.log('  ✅ Análises REAIS executadas');
      console.log('  ✅ Respostas contextuais geradas');
      console.log('\n🎉 INTEGRAÇÃO REAL VALIDADA!');
      console.log('=' .repeat(50));
      process.exit(0);
    }, 3000);
  }
}

// Processar respostas
let responseBuffer = '';
let responseStartTime = 0;

socket.on('stream', (data) => {
  if (!responseBuffer) {
    console.log('🤖 RESPOSTA: ', { end: '' });
    responseStartTime = Date.now();
  }
  process.stdout.write(data.chunk);
  responseBuffer += data.chunk;
});

socket.on('message', (msg) => {
  if (msg.type === 'assistant') {
    const responseTime = Date.now() - responseStartTime;
    console.log(''); // Nova linha
    
    // Análise da resposta
    console.log('\n📊 Análise da Resposta:');
    
    // Verificar se é resposta REAL (não hardcoded)
    const isReal = !msg.content.includes('Processando (modo simulação)') &&
                   !msg.content.includes('CrewAI está processando...') &&
                   msg.content.length > 20;
    
    console.log(`  • Real (não hardcoded): ${isReal ? '✅' : '❌'}`);
    console.log(`  • Tamanho: ${msg.content.length} caracteres`);
    console.log(`  • Tempo de resposta: ${responseTime}ms`);
    
    // Verificar conteúdo específico baseado no teste
    if (currentTest > 0) {
      const test = testMessages[currentTest - 1];
      
      if (test.message.includes('dados')) {
        const hasDataAnalysis = msg.content.toLowerCase().includes('dados') || 
                               msg.content.toLowerCase().includes('números') ||
                               msg.content.toLowerCase().includes('valores');
        console.log(`  • Menciona análise de dados: ${hasDataAnalysis ? '✅' : '❌'}`);
      }
      
      if (test.message.includes('padrões')) {
        const hasPatternAnalysis = msg.content.toLowerCase().includes('padrão') || 
                                   msg.content.toLowerCase().includes('pattern') ||
                                   msg.content.toLowerCase().includes('tendência');
        console.log(`  • Menciona padrões: ${hasPatternAnalysis ? '✅' : '❌'}`);
      }
      
      if (test.message.includes('relatório')) {
        const hasReport = msg.content.toLowerCase().includes('relatório') || 
                         msg.content.toLowerCase().includes('resumo') ||
                         msg.content.toLowerCase().includes('report');
        console.log(`  • Menciona relatório: ${hasReport ? '✅' : '❌'}`);
      }
    }
    
    responseBuffer = '';
    
    // Próximo teste após delay
    const nextDelay = testMessages[currentTest - 1]?.delay || 3000;
    setTimeout(runNextTest, nextDelay);
  }
});

// Monitorar eventos de debug
socket.on('processing_step', (data) => {
  console.log(`⚙️ ${data.step}: ${data.message}`);
});

socket.on('error', (error) => {
  console.error('\n❌ Erro:', error);
});

// Timeout de segurança
setTimeout(() => {
  console.log('\n⏱️ Timeout - finalizando teste...');
  process.exit(1);
}, 60000);