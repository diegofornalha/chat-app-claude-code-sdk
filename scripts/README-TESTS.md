# 🧪 Sistema de Testes para Filas de Mensagens

## 📋 Visão Geral

Este diretório contém um sistema abrangente de testes para validar o funcionamento do sistema de filas de mensagens do Chat App Claude Code SDK. Os testes cobrem todos os aspectos críticos do sistema, desde funcionalidades básicas até cenários complexos de integração.

## 📁 Arquivos do Sistema de Testes

### 🎯 Scripts Principais

- **`test-message-queue.js`** - Script principal de testes
- **`run-queue-tests.sh`** - Script bash para execução automatizada
- **`test-message-samples.json`** - Mensagens de exemplo para testes

### 📄 Documentação

- **`README-TESTS.md`** - Esta documentação
- **Logs** - Gerados automaticamente em `logs/`

## 🚀 Como Executar os Testes

### Execução Rápida

```bash
# Execução padrão
./scripts/run-queue-tests.sh

# Ou diretamente com Node.js
node scripts/test-message-queue.js
```

### Opções Avançadas

```bash
# Modo verboso
./scripts/run-queue-tests.sh -v

# Timeout personalizado (2 minutos)
./scripts/run-queue-tests.sh -t 120

# Porta personalizada
./scripts/run-queue-tests.sh -p 3002

# Execução rápida (pula setup)
./scripts/run-queue-tests.sh --quick

# Sem relatório HTML
./scripts/run-queue-tests.sh --no-report
```

### Ajuda Completa

```bash
./scripts/run-queue-tests.sh --help
```

## 🧩 Estrutura dos Testes

### 1. 🏗️ Queue Creation and Management
- ✅ Inicialização automática de fila
- ✅ Limite de tamanho da fila
- ✅ Limpeza de fila na desconexão

### 2. 📨 Enqueueing and Dequeueing
- ✅ Adicionar mensagem à fila
- ✅ Processamento automático (dequeue)
- ✅ Status da fila durante processamento

### 3. 📊 FIFO Processing Order
- ✅ Verificação da ordem FIFO
- ✅ Processamento sequencial correto

### 4. ⚡ Priority Messages
- ✅ Processamento prioritário
- ✅ Ordenação por prioridade

### 5. ❌ Message Cancellation
- ✅ Cancelar mensagem pendente
- ✅ Cancelar mensagem inexistente
- ✅ Validação de cancelamento

### 6. 🛠️ Error Handling and Retry Logic
- ✅ Tratamento de erros
- ✅ Lógica de retry
- ✅ Timeouts e falhas

### 7. ⏱️ Timeout Scenarios
- ✅ Timeout de mensagens longas
- ✅ Configuração de timeouts

### 8. 🔄 Queue Status Updates
- ✅ Atualizações em tempo real
- ✅ Sincronização de status

### 9. 🔗 Frontend/Backend Integration
- ✅ Compatibilidade com `useMessageQueue`
- ✅ Estrutura de dados consistente

### 10. 🚀 Concurrent Processing
- ✅ Múltiplos clientes simultâneos
- ✅ Isolamento de filas

### 11. 🔌 Socket Events Verification
- ✅ Todos os eventos funcionam
- ✅ Ordem correta de eventos

### 12. 🌐 REST API Endpoints
- ✅ GET /api/queues/status
- ✅ GET /api/queues/stats
- ✅ Outros endpoints relacionados

## 📊 Tipos de Mensagens Testadas

### Mensagens Básicas
```javascript
{
  "type": "send_message",
  "messageData": {
    "message": "Mensagem de teste",
    "sessionId": "session-id"
  },
  "priority": "normal"
}
```

### Mensagens com Contexto
```javascript
{
  "type": "send_message_with_context",
  "messageData": {
    "message": "Analise este código",
    "context": { "files": ["app.js"] }
  }
}
```

### Mensagens A2A (Agent-to-Agent)
```javascript
{
  "type": "a2a:send_message",
  "messageData": {
    "message": "Coordenar deployment",
    "targetAgent": "deployment-coordinator"
  }
}
```

### Mensagens de Prioridade
```javascript
{
  "priority": "high",  // Para alta prioridade
  "priority": "normal" // Para prioridade normal
}
```

## 📈 Relatórios e Logs

### Logs de Execução
- Salvos automaticamente em `logs/test-queue-YYYYMMDD-HHMMSS.log`
- Contém detalhes completos da execução
- Informações de debug e erro

### Relatórios HTML
- Gerados em `logs/test-report-YYYYMMDD-HHMMSS.html`
- Visualização interativa dos resultados
- Gráficos e estatísticas detalhadas

### Estrutura do Relatório
```
📊 Resumo Executivo
├── Total de Testes
├── Taxa de Sucesso
├── Tempo de Execução
└── Configurações Utilizadas

🔧 Detalhes por Suite
├── Queue Creation and Management
├── Enqueueing and Dequeueing
├── FIFO Processing Order
└── ... (todas as suites)

📝 Logs e Evidências
└── Links para logs detalhados
```

## 🛠️ Configuração e Dependências

### Pré-requisitos
- Node.js >= 14.0.0
- npm >= 6.0.0
- Backend rodando na porta configurada (padrão: 8080)

### Dependências Principais
- `socket.io-client` - Cliente WebSocket
- `axios` - Cliente HTTP
- `perf_hooks` - Medição de performance

### Variáveis de Ambiente
```bash
TEST_BACKEND_PORT=8080     # Porta do backend
TEST_FRONTEND_PORT=3000    # Porta do frontend
TEST_TIMEOUT=60           # Timeout global em segundos
TEST_VERBOSE=false        # Modo verboso
```

## 🚨 Troubleshooting

### Problemas Comuns

#### ❌ "Backend não está rodando"
```bash
# Solução: Iniciar o backend
cd backend
npm start
```

#### ❌ "Socket connection error"
```bash
# Verificar se a porta está correta
./scripts/run-queue-tests.sh -p 3002
```

#### ❌ "Test timeout"
```bash
# Aumentar timeout
./scripts/run-queue-tests.sh -t 120
```

#### ❌ "Permission denied"
```bash
# Dar permissão de execução
chmod +x scripts/run-queue-tests.sh
chmod +x scripts/test-message-queue.js
```

### Debug Mode
```bash
# Execução com logs detalhados
DEBUG=* node scripts/test-message-queue.js

# Ou modo verboso do script
./scripts/run-queue-tests.sh -v
```

## 📋 Cenários de Teste Específicos

### Teste de Stress
```bash
# Executar múltiplas mensagens simultâneas
node -e "
const tester = new (require('./scripts/test-message-queue.js').MessageQueueTester)();
// ... código de stress test
"
```

### Teste de Integração
```bash
# Testar com frontend rodando
./scripts/run-queue-tests.sh -f 3000
```

### Teste de Performance
```bash
# Medir tempos de resposta
./scripts/run-queue-tests.sh --quick -v
```

## 🔄 Integração com CI/CD

### GitHub Actions
```yaml
- name: Run Message Queue Tests
  run: |
    npm install
    cd backend && npm install && npm start &
    sleep 5
    ./scripts/run-queue-tests.sh --no-report
```

### Jenkins
```groovy
stage('Queue Tests') {
  steps {
    sh './scripts/run-queue-tests.sh'
    publishHTML([
      allowMissing: false,
      alwaysLinkToLastBuild: true,
      keepAll: true,
      reportDir: 'logs',
      reportFiles: 'test-report-*.html',
      reportName: 'Queue Tests Report'
    ])
  }
}
```

## 🎯 Próximos Passos

### Melhorias Planejadas
- [ ] Testes de performance mais detalhados
- [ ] Integração com métricas de produção
- [ ] Testes de carga automatizados
- [ ] Dashboard em tempo real

### Extensões Possíveis
- [ ] Testes de clustering
- [ ] Testes de failover
- [ ] Testes de backup/restore
- [ ] Validação de segurança

## 📞 Suporte

Para questões ou problemas:

1. Verifique os logs em `logs/`
2. Execute em modo verboso: `./scripts/run-queue-tests.sh -v`
3. Consulte a documentação da API em `backend/docs/message-queue-api.md`
4. Abra uma issue no repositório

---

## 📝 Changelog

### v1.0.0 (Atual)
- ✅ Sistema completo de testes implementado
- ✅ 12 suites de teste com 30+ casos
- ✅ Relatórios HTML automatizados
- ✅ Script de execução bash
- ✅ Mensagens de exemplo
- ✅ Documentação completa

---

**Criado com ❤️ para garantir a qualidade do sistema de filas de mensagens**