# Sistema de Filas de Mensagens - API Backend

## Visão Geral

O sistema de gerenciamento de filas de mensagens implementado no backend fornece:

- Processamento FIFO (First In, First Out) de mensagens
- Suporte a cancelamento de mensagens em fila ou em processamento
- Monitoramento de status em tempo real
- Tratamento de timeout para mensagens de longa duração
- Estatísticas de performance detalhadas

## Eventos Socket.IO

### Eventos de Cliente para Servidor

#### `queue_message`
Adiciona uma mensagem à fila de processamento.

```javascript
socket.emit('queue_message', {
  type: 'send_message', // 'send_message' | 'send_message_with_context' | 'a2a:send_message'
  messageData: {
    message: 'Sua mensagem aqui',
    sessionId: 'optional-session-id',
    // outros parâmetros específicos do tipo
  },
  priority: 'normal' // 'normal' | 'high'
});
```

#### `cancel_message`
Cancela uma mensagem específica na fila ou em processamento.

```javascript
socket.emit('cancel_message', {
  messageId: 'uuid-da-mensagem'
});
```

#### `get_queue_status`
Solicita o status atual da fila.

```javascript
socket.emit('get_queue_status');
```

#### `process_queued_message`
Força o processamento da próxima mensagem na fila (se não estiver processando).

```javascript
socket.emit('process_queued_message');
```

### Eventos de Servidor para Cliente

#### `message_queued`
Confirmação de que a mensagem foi adicionada à fila.

```javascript
{
  messageId: 'uuid',
  queuePosition: 3,
  estimatedWait: 15000, // ms
  timestamp: 1234567890
}
```

#### `queue_status`
Status atual da fila.

```javascript
{
  queueLength: 5,
  processing: true,
  currentMessage: {
    id: 'uuid',
    type: 'send_message',
    startTime: 1234567890,
    elapsedTime: 5000
  },
  stats: {
    totalProcessed: 25,
    totalCancelled: 2,
    totalErrors: 1,
    avgProcessingTime: 8500
  }
}
```

#### `message_processing`
Indica que uma mensagem começou a ser processada.

```javascript
{
  messageId: 'uuid',
  timestamp: 1234567890
}
```

#### `message_complete`
Indica que uma mensagem foi processada com sucesso.

```javascript
{
  messageId: 'uuid',
  processingTime: 8500,
  timestamp: 1234567890
}
```

#### `message_cancelled`
Confirmação de cancelamento de mensagem.

```javascript
{
  messageId: 'uuid',
  timestamp: 1234567890
}
```

#### `message_error`
Erro durante o processamento de mensagem.

```javascript
{
  messageId: 'uuid',
  error: 'Descrição do erro',
  type: 'processing_error' | 'timeout',
  timestamp: 1234567890
}
```

## API REST Endpoints

### `GET /api/queues/status`
Retorna o status de todas as filas ativas.

### `GET /api/queues/:socketId/status`
Retorna o status de uma fila específica.

### `DELETE /api/queues/:socketId`
Limpa uma fila específica.

### `GET /api/queues/stats`
Retorna estatísticas globais do sistema de filas.

## Configurações

### Constantes Principais

- `MESSAGE_TIMEOUT`: 300000ms (5 minutos) - Timeout para processamento
- `MAX_QUEUE_SIZE`: 100 - Tamanho máximo da fila por socket

### Estados de Mensagem

- `QUEUED`: Mensagem na fila aguardando processamento
- `PROCESSING`: Mensagem sendo processada
- `COMPLETED`: Mensagem processada com sucesso
- `CANCELLED`: Mensagem cancelada
- `ERROR`: Erro durante o processamento
- `TIMEOUT`: Timeout durante o processamento

## Funcionamento

1. **Adição à Fila**: Mensagens são adicionadas via `queue_message`
2. **Processamento FIFO**: Primeira mensagem da fila é processada automaticamente
3. **Timeout**: Mensagens que excedem 5 minutos são canceladas automaticamente
4. **Cancelamento**: Mensagens podem ser canceladas a qualquer momento
5. **Limpeza**: Filas são limpas automaticamente quando o socket desconecta

## Integração com Frontend

O sistema foi projetado para funcionar perfeitamente com o sistema de filas do frontend, mantendo sincronização de estados e fornecendo feedback em tempo real sobre o progresso das mensagens.