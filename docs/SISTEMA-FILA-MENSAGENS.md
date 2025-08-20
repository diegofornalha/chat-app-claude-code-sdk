# 📋 Sistema de Fila de Mensagens - Documentação Completa

## 📌 Visão Geral

O Sistema de Fila de Mensagens é uma solução completa para gerenciamento assíncrono de mensagens no chat, permitindo que múltiplas mensagens sejam enviadas sem bloqueio da interface, com controle total sobre o processamento, cancelamento e retry.

## 🎯 Benefícios Principais

- **✅ Envio não-bloqueante**: Interface sempre responsiva
- **✅ Múltiplas mensagens**: Enviar várias mensagens em sequência
- **✅ Visualização da fila**: Ver status e progresso de cada mensagem
- **✅ Cancelamento**: Cancelar mensagens pendentes ou em processamento
- **✅ Retry automático**: Reprocessamento inteligente com backoff exponencial
- **✅ Priorização**: Mensagens prioritárias processadas primeiro
- **✅ Persistência**: Fila mantida mesmo em reconexões

## 🏗️ Arquitetura

### Frontend (React/TypeScript)

#### 1. Hook `useMessageQueue`
**Localização**: `/frontend/src/hooks/useMessageQueue.ts`

Gerencia o estado e lógica da fila de mensagens:

```typescript
const messageQueue = useMessageQueue({
  onProcessMessage: async (message) => {
    // Processar mensagem via Socket.IO
  },
  maxConcurrent: 1,      // Mensagens simultâneas
  maxRetries: 5,         // Tentativas máximas
  retryDelay: 1000,      // Delay entre retries
  autoProcess: true      // Processamento automático
});
```

**Funcionalidades**:
- Gerenciamento de estado da fila
- Processamento FIFO com prioridades
- Retry automático com backoff exponencial
- Estatísticas em tempo real
- Controle de processamento (pausar/retomar)

#### 2. Componente `MessageQueue`
**Localização**: `/frontend/src/components/MessageQueue/`

Interface visual para a fila:

```tsx
<MessageQueue
  queue={messageQueue.queue}
  onCancel={messageQueue.cancelMessage}
  onRetry={messageQueue.retryMessage}
  onClearCompleted={messageQueue.clearCompleted}
/>
```

**Características**:
- Design moderno com animações
- Indicadores visuais de status
- Tempo decorrido em tempo real
- Minimizar/expandir
- Responsivo (mobile/desktop)

#### 3. Integração no `App.tsx`
**Localização**: `/frontend/src/App.tsx`

Integração completa com o chat:

```typescript
// Adicionar mensagem à fila
const handleSendMessage = () => {
  const messageId = messageQueue.addToQueue(message, {
    sessionId: currentSessionId,
    priority: 1
  });
};

// Processar mensagem da fila
const processQueuedMessage = async (queuedMessage) => {
  return new Promise((resolve, reject) => {
    socket.emit('process_queued_message', {
      messageId: queuedMessage.id,
      content: queuedMessage.content,
      sessionId: queuedMessage.sessionId
    });
    // Aguardar resposta...
  });
};
```

### Backend (Node.js/Socket.IO)

#### Sistema de Gerenciamento de Filas
**Localização**: `/backend/server.js`

**Estruturas de dados**:
```javascript
const messageQueues = new Map(); // Filas por socket
const MESSAGE_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const MAX_QUEUE_SIZE = 100; // Máximo de mensagens
```

**Eventos Socket.IO**:

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `queue_message` | Client→Server | Adicionar mensagem à fila |
| `cancel_message` | Client→Server | Cancelar mensagem |
| `get_queue_status` | Client→Server | Obter status da fila |
| `process_queued_message` | Client→Server | Processar mensagem específica |
| `message_queued` | Server→Client | Confirmação de enfileiramento |
| `message_processing` | Server→Client | Início do processamento |
| `message_complete` | Server→Client | Processamento concluído |
| `message_cancelled` | Server→Client | Mensagem cancelada |
| `message_error` | Server→Client | Erro no processamento |
| `queue_status` | Server→Client | Atualização de status |

**APIs REST**:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/queues/status` | GET | Status de todas as filas |
| `/api/queues/:socketId/status` | GET | Status de fila específica |
| `/api/queues/:socketId` | DELETE | Limpar fila |
| `/api/queues/stats` | GET | Estatísticas globais |

## 🚀 Como Usar

### 1. Enviar Mensagem

```typescript
// Frontend
const message = "Olá, Claude!";
const messageId = messageQueue.addToQueue(message, {
  sessionId: currentSessionId,
  priority: 1, // 1-10, maior = mais prioritário
  metadata: { type: 'chat' }
});
```

### 2. Cancelar Mensagem

```typescript
// Frontend
messageQueue.cancelMessage(messageId);

// Ou via Socket.IO
socket.emit('cancel_message', { messageId });
```

### 3. Verificar Status

```typescript
// Frontend
const stats = messageQueue.getQueueStats();
console.log(stats); 
// { total: 5, pending: 2, processing: 1, completed: 2 }

// Backend via API
GET /api/queues/stats
```

### 4. Mensagens Prioritárias

```typescript
// Alta prioridade (processada primeiro)
messageQueue.addToQueue("Urgente!", {
  priority: 10
});

// Prioridade normal
messageQueue.addToQueue("Normal", {
  priority: 5
});
```

## 🧪 Testes

### Executar Testes

```bash
# Método 1: Script automatizado
./scripts/run-queue-tests.sh

# Método 2: Node direto
node scripts/test-message-queue.js

# Método 3: Com opções
./scripts/run-queue-tests.sh -v --timeout 120
```

### Suites de Teste

1. **Básicos**: Criação, adição, remoção
2. **FIFO**: Ordem de processamento
3. **Prioridade**: Processamento prioritário
4. **Cancelamento**: Cancelar mensagens
5. **Erro/Retry**: Tratamento de erros
6. **Timeout**: Timeouts de processamento
7. **Status**: Atualizações de status
8. **Integração**: Frontend/Backend
9. **Concorrência**: Múltiplas mensagens
10. **Socket Events**: Eventos Socket.IO
11. **REST API**: Endpoints HTTP
12. **Stress**: Carga e performance

## 📊 Estados de Mensagem

| Estado | Descrição | Ações Disponíveis |
|--------|-----------|------------------|
| `pending` | Aguardando processamento | Cancelar, Remover |
| `processing` | Sendo processada | Cancelar |
| `completed` | Processada com sucesso | Remover |
| `error` | Erro no processamento | Retry, Remover |
| `cancelled` | Cancelada pelo usuário | Remover |

## ⚙️ Configuração

### Frontend

```typescript
// useMessageQueue options
{
  maxConcurrent: 1,      // Máximo de mensagens simultâneas
  maxRetries: 5,         // Tentativas máximas por mensagem
  retryDelay: 1000,      // Delay inicial entre retries (ms)
  autoProcess: true,     // Processar automaticamente
  onProcessMessage: fn   // Função de processamento
}
```

### Backend

```javascript
// server.js constants
const MESSAGE_TIMEOUT = 5 * 60 * 1000;  // Timeout de processamento
const MAX_QUEUE_SIZE = 100;             // Tamanho máximo da fila
const CLEANUP_INTERVAL = 60 * 1000;     // Intervalo de limpeza
```

## 🔧 Troubleshooting

### Problema: Mensagens não são processadas

**Soluções**:
1. Verificar se o backend está rodando
2. Verificar conexão Socket.IO
3. Verificar se `autoProcess: true`
4. Verificar console para erros

### Problema: Timeout frequente

**Soluções**:
1. Aumentar `MESSAGE_TIMEOUT` no backend
2. Verificar performance do processamento
3. Implementar processamento em chunks

### Problema: Fila muito grande

**Soluções**:
1. Ajustar `MAX_QUEUE_SIZE`
2. Implementar limpeza automática
3. Limitar envios por usuário

## 🎨 Customização

### Personalizar UI

```css
/* MessageQueue.css */
.message-queue-container {
  /* Customizar posição */
  top: 100px;
  right: 20px;
}

.queue-item-processing {
  /* Customizar cor de processamento */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Adicionar Novos Status

```typescript
// Extend QueuedMessage interface
interface QueuedMessage {
  // ...existing
  status: '...' | 'custom_status';
}

// Handle in UI
const getStatusIcon = (status) => {
  switch(status) {
    case 'custom_status': return '🔧';
    // ...
  }
};
```

## 📈 Métricas e Monitoramento

### Métricas Disponíveis

- **Taxa de processamento**: Mensagens/minuto
- **Tempo médio**: Tempo por mensagem
- **Taxa de erro**: % de falhas
- **Taxa de retry**: % de retries
- **Tamanho da fila**: Mensagens pendentes

### API de Estatísticas

```javascript
// GET /api/queues/stats
{
  "totalQueues": 5,
  "totalMessages": 150,
  "byStatus": {
    "pending": 10,
    "processing": 2,
    "completed": 130,
    "error": 5,
    "cancelled": 3
  },
  "avgProcessingTime": 2500,
  "errorRate": 0.033,
  "retryRate": 0.05
}
```

## 🔐 Segurança

- **Validação**: Todas as mensagens são validadas
- **Sanitização**: Conteúdo sanitizado antes do processamento
- **Rate Limiting**: Limite de mensagens por usuário
- **Timeout**: Proteção contra mensagens travadas
- **Autenticação**: Sessões verificadas

## 🚦 Roadmap Futuro

- [ ] Persistência em banco de dados
- [ ] Processamento distribuído
- [ ] Webhooks para status
- [ ] Dashboard de monitoramento
- [ ] Exportação de métricas
- [ ] Integração com message brokers

## 📚 Referências

- [Socket.IO Documentation](https://socket.io/docs/)
- [React Hooks Guide](https://react.dev/reference/react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 👥 Suporte

Para dúvidas ou problemas:
1. Verificar esta documentação
2. Consultar logs em `/logs`
3. Executar testes de diagnóstico
4. Contatar equipe de desenvolvimento

---

*Última atualização: 19 de Agosto de 2025*
*Versão: 1.0.0*