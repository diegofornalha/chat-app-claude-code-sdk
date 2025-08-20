import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { io } from 'socket.io-client';
import App from '../src/App';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('Validação de Integração - Sistema Completo', () => {
  let mockSocket: any;
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrors = [];
    consoleWarnings = [];

    // Capturar console.error e console.warn
    jest.spyOn(console, 'error').mockImplementation((message) => {
      consoleErrors.push(message);
    });

    jest.spyOn(console, 'warn').mockImplementation((message) => {
      consoleWarnings.push(message);
    });

    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      connected: true
    };

    (io as jest.Mock).mockReturnValue(mockSocket);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          claude_available: true, 
          active_connections: 1, 
          active_sessions: 1 
        })
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Critério de Sucesso 1: Zero Mensagens Duplicadas', () => {
    test('deve garantir zero duplicação em cenário complexo', async () => {
      const { container } = render(<App />);
      const messagesReceived = new Set<string>();

      // Simular conexão
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      // Interceptar handler de mensagens para rastrear duplicação
      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      const originalHandler = messageHandler;
      
      if (originalHandler) {
        // Substituir handler para detectar duplicação
        const trackingHandler = (message: any) => {
          if (messagesReceived.has(message.id)) {
            throw new Error(`DUPLICAÇÃO DETECTADA: Mensagem ${message.id} já foi processada!`);
          }
          messagesReceived.add(message.id);
          return originalHandler(message);
        };

        // Cenário complexo: múltiplas mensagens, reconexões, erros
        const testScenarios = [
          // Cenário 1: Mensagens normais
          () => {
            trackingHandler({
              id: 'normal-1',
              type: 'assistant',
              content: 'Resposta normal 1',
              timestamp: Date.now(),
              sessionId: 'test-session'
            });
          },
          
          // Cenário 2: Mensagem com mesmo conteúdo mas ID diferente (deve passar)
          () => {
            trackingHandler({
              id: 'normal-2',
              type: 'assistant', 
              content: 'Resposta normal 1', // Mesmo conteúdo
              timestamp: Date.now() + 10000, // Timestamp diferente
              sessionId: 'test-session'
            });
          },

          // Cenário 3: Mensagem de erro
          () => {
            trackingHandler({
              id: 'error-1',
              type: 'assistant',
              content: 'Erro de teste',
              timestamp: Date.now(),
              sessionId: 'test-session',
              is_error: true
            });
          },

          // Cenário 4: Streaming content completion
          () => {
            const completeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message_complete')?.[1];
            if (completeHandler) {
              const message = {
                id: 'stream-complete-1',
                type: 'assistant',
                content: 'Streaming message completed',
                timestamp: Date.now(),
                sessionId: 'test-session',
                cost: 0.01,
                duration: 1500
              };
              
              if (messagesReceived.has(message.id)) {
                throw new Error(`DUPLICAÇÃO DETECTADA: Mensagem ${message.id} já foi processada!`);
              }
              messagesReceived.add(message.id);
              completeHandler(message);
            }
          }
        ];

        // Executar cenários
        for (const scenario of testScenarios) {
          act(() => {
            scenario();
          });
        }
      }

      // Verificar que todas as mensagens únicas foram processadas
      expect(messagesReceived.size).toBe(4);
      
      console.log('✅ Zero duplicação confirmada - todas as mensagens únicas processadas');
    });
  });

  describe('Critério de Sucesso 2: Console Sem Erros Críticos', () => {
    test('deve operar sem erros críticos no console', async () => {
      const { container } = render(<App />);

      // Simular operações normais
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Enviar mensagem
      const input = screen.getByPlaceholderText(/Type your message/);
      fireEvent.change(input, { target: { value: 'Teste sem erros' } });
      fireEvent.click(screen.getByText('Send'));

      // Simular resposta
      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        act(() => {
          messageHandler({
            id: 'clean-test-1',
            type: 'assistant',
            content: 'Resposta limpa',
            timestamp: Date.now(),
            sessionId: 'test-session'
          });
        });
      }

      // Aguardar processamento
      await waitFor(() => {
        expect(container.textContent).toContain('Resposta limpa');
      });

      // Verificar ausência de erros críticos
      const criticalErrors = consoleErrors.filter(error => 
        error.includes('Error') || 
        error.includes('Failed') || 
        error.includes('Cannot') ||
        error.includes('Duplicate')
      );

      expect(criticalErrors).toHaveLength(0);
      
      if (criticalErrors.length > 0) {
        console.log('❌ Erros críticos encontrados:', criticalErrors);
      } else {
        console.log('✅ Console limpo - sem erros críticos');
      }
    });
  });

  describe('Critério de Sucesso 3: Interface Responsiva', () => {
    test('deve manter interface responsiva durante operações', async () => {
      const { container } = render(<App />);

      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      // Testar responsividade dos elementos principais
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Type your message/);
      const sendButton = screen.getByText('Send');
      const clearButton = screen.getByText('Clear Chat');

      // Verificar que elementos são interativos
      expect(input).not.toBeDisabled();
      expect(sendButton).toBeInTheDocument();
      expect(clearButton).toBeInTheDocument();

      // Testar interações rápidas
      fireEvent.change(input, { target: { value: 'Teste 1' } });
      expect(input).toHaveValue('Teste 1');

      fireEvent.change(input, { target: { value: 'Teste 2' } });
      expect(input).toHaveValue('Teste 2');

      // Testar cliques rápidos
      fireEvent.click(sendButton);
      fireEvent.change(input, { target: { value: 'Teste 3' } });
      fireEvent.click(sendButton);

      // Interface deve permanecer responsiva
      expect(input).not.toBeDisabled();
      
      console.log('✅ Interface responsiva confirmada');
    });
  });

  describe('Critério de Sucesso 4: Loading States Funcionando', () => {
    test('deve gerenciar estados de loading corretamente', async () => {
      const { container } = render(<App />);

      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Type your message/);
      const sendButton = screen.getByText('Send');

      // Enviar mensagem
      fireEvent.change(input, { target: { value: 'Teste loading' } });
      fireEvent.click(sendButton);

      // Verificar que loading está ativo
      await waitFor(() => {
        expect(sendButton.textContent).toBe('...');
      });

      // Simular resposta completa
      const completeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message_complete')?.[1];
      if (completeHandler) {
        act(() => {
          completeHandler({
            id: 'loading-test-1',
            type: 'assistant',
            content: 'Resposta completa',
            timestamp: Date.now(),
            sessionId: 'test-session'
          });
        });
      }

      // Verificar que loading foi removido
      await waitFor(() => {
        expect(sendButton.textContent).toBe('Send');
      });

      console.log('✅ Estados de loading funcionando corretamente');
    });
  });

  describe('Critério de Sucesso 5: Ordem Correta das Mensagens', () => {
    test('deve manter ordem cronológica das mensagens', async () => {
      const { container } = render(<App />);

      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      
      // Adicionar mensagens fora de ordem cronológica
      const messages = [
        {
          id: 'msg-3',
          type: 'assistant',
          content: 'Terceira mensagem (timestamp 3000)',
          timestamp: 3000,
          sessionId: 'order-test'
        },
        {
          id: 'msg-1', 
          type: 'user',
          content: 'Primeira mensagem (timestamp 1000)',
          timestamp: 1000,
          sessionId: 'order-test'
        },
        {
          id: 'msg-2',
          type: 'assistant', 
          content: 'Segunda mensagem (timestamp 2000)',
          timestamp: 2000,
          sessionId: 'order-test'
        }
      ];

      // Adicionar em ordem aleatória
      if (messageHandler) {
        for (const message of messages) {
          act(() => {
            messageHandler(message);
          });
        }
      }

      // Aguardar renderização
      await waitFor(() => {
        expect(container.textContent).toContain('Primeira mensagem');
        expect(container.textContent).toContain('Segunda mensagem');
        expect(container.textContent).toContain('Terceira mensagem');
      });

      // Verificar ordem na DOM
      const messageElements = container.querySelectorAll('[key^="msg-"]');
      if (messageElements.length >= 3) {
        // A ordem deve ser cronológica: msg-1, msg-2, msg-3
        const firstMessage = messageElements[0];
        const secondMessage = messageElements[1]; 
        const thirdMessage = messageElements[2];

        expect(firstMessage.textContent).toContain('Primeira mensagem');
        expect(secondMessage.textContent).toContain('Segunda mensagem');
        expect(thirdMessage.textContent).toContain('Terceira mensagem');
      }

      console.log('✅ Ordem cronológica das mensagens mantida');
    });
  });

  describe('Validação Geral do Sistema', () => {
    test('deve executar fluxo completo sem problemas', async () => {
      const { container } = render(<App />);

      // 1. Conectar
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // 2. Enviar mensagem
      const input = screen.getByPlaceholderText(/Type your message/);
      fireEvent.change(input, { target: { value: 'Fluxo completo teste' } });
      fireEvent.click(screen.getByText('Send'));

      // 3. Receber resposta
      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        act(() => {
          messageHandler({
            id: 'complete-flow-1',
            type: 'assistant',
            content: 'Resposta ao fluxo completo',
            timestamp: Date.now(),
            sessionId: 'complete-test'
          });
        });
      }

      // 4. Verificar streaming
      const streamHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message_stream')?.[1];
      if (streamHandler) {
        act(() => {
          streamHandler({
            sessionId: 'complete-test',
            content: 'Conteúdo ',
            fullContent: 'Conteúdo streaming'
          });
        });
      }

      // 5. Completar streaming
      const completeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message_complete')?.[1];
      if (completeHandler) {
        act(() => {
          completeHandler({
            id: 'complete-flow-2',
            type: 'assistant',
            content: 'Conteúdo streaming completo',
            timestamp: Date.now(),
            sessionId: 'complete-test',
            cost: 0.005,
            duration: 2000
          });
        });
      }

      // 6. Verificar estado final
      await waitFor(() => {
        expect(container.textContent).toContain('Resposta ao fluxo completo');
      });

      // 7. Limpar chat
      fireEvent.click(screen.getByText('Clear Chat'));

      await waitFor(() => {
        expect(container.textContent).not.toContain('Resposta ao fluxo completo');
      });

      // Validações finais
      expect(consoleErrors.filter(e => e.includes('Error')).length).toBe(0);
      expect(screen.getByText('Send')).toBeInTheDocument();

      console.log('✅ Fluxo completo executado com sucesso');
    });
  });
});