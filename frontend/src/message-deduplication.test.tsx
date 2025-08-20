import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { io } from 'socket.io-client';
import App from '../src/App';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('Validação de Remoção do Sistema de Fila - Deduplicação', () => {
  let mockSocket: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock socket
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      connected: true
    };

    (io as jest.Mock).mockReturnValue(mockSocket);

    // Mock fetch for health check
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

  describe('Teste Funcional Crítico 1: Mensagem Simples Sem Duplicação', () => {
    test('deve enviar mensagem simples e não duplicar', async () => {
      const { container } = render(<App />);

      // Simular conexão do socket
      const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      // Aguardar renderização
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Type your message/);
      const sendButton = screen.getByText('Send');

      // Enviar mensagem de teste
      fireEvent.change(input, { target: { value: 'Teste mensagem única' } });
      fireEvent.click(sendButton);

      // Verificar que emit foi chamado apenas uma vez
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
      expect(mockSocket.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        content: 'Teste mensagem única',
        messageId: expect.any(String)
      }));

      // Simular resposta do servidor
      const messageHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      if (messageHandler) {
        act(() => {
          messageHandler({
            id: 'test-msg-1',
            type: 'assistant',
            content: 'Resposta do Claude',
            timestamp: Date.now(),
            sessionId: 'test-session'
          });
        });
      }

      // Verificar que apenas uma mensagem aparece na interface
      await waitFor(() => {
        const messages = container.querySelectorAll('[data-testid="message"]');
        expect(messages).toHaveLength(1);
      });
    });
  });

  describe('Teste Funcional Crítico 2: Múltiplas Mensagens Rápidas', () => {
    test('deve enviar 5 mensagens seguidas sem duplicação', async () => {
      const { container } = render(<App />);

      // Simular conexão
      const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Type your message/);
      const sendButton = screen.getByText('Send');

      // Enviar 5 mensagens rapidamente
      for (let i = 1; i <= 5; i++) {
        fireEvent.change(input, { target: { value: `Mensagem rápida ${i}` } });
        fireEvent.click(sendButton);
        
        // Pequeno delay para simular rapidez mas não simultaneidade
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Verificar que emit foi chamado exatamente 5 vezes
      expect(mockSocket.emit).toHaveBeenCalledTimes(5);

      // Verificar que cada mensagem tem ID único
      const emitCalls = mockSocket.emit.mock.calls.filter((call: any) => call[0] === 'message');
      const messageIds = emitCalls.map((call: any) => call[1].messageId);
      const uniqueIds = new Set(messageIds);
      
      expect(uniqueIds.size).toBe(5); // Todos os IDs devem ser únicos
    });
  });

  describe('Teste Funcional Crítico 3: Desconexão/Reconexão WebSocket', () => {
    test('deve manter estado consistente após desconexão e reconexão', async () => {
      const { container } = render(<App />);

      // Simular conexão inicial
      const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Simular desconexão
      const disconnectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'disconnect')?.[1];
      if (disconnectHandler) {
        act(() => {
          disconnectHandler();
        });
      }

      // Verificar que mostra desconectado
      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // Simular reconexão
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      // Verificar que reconectou
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Verificar que o socket foi reinicializado
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('Teste Funcional Crítico 4: Tratamento de Erro de Rede', () => {
    test('deve tratar adequadamente erros de rede', async () => {
      const { container } = render(<App />);

      // Simular conexão
      const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      // Simular erro de rede
      const errorHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      if (errorHandler) {
        act(() => {
          errorHandler({
            error: 'Network error: Connection timeout',
            sessionId: 'test-session',
            timestamp: Date.now()
          });
        });
      }

      // Verificar que o erro foi tratado adequadamente
      await waitFor(() => {
        expect(container.textContent).toContain('Network error');
      });

      // Verificar que o loading foi resetado
      await waitFor(() => {
        const sendButton = screen.getByText('Send');
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('Teste Funcional Crítico 5: Mudança de Sessão', () => {
    test('deve limpar corretamente ao mudar de sessão', async () => {
      const { container } = render(<App />);

      // Simular conexão
      const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')?.[1];
      if (connectHandler) {
        act(() => {
          connectHandler();
        });
      }

      // Adicionar uma mensagem
      const messageHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      if (messageHandler) {
        act(() => {
          messageHandler({
            id: 'test-msg-1',
            type: 'assistant',
            content: 'Mensagem da sessão anterior',
            timestamp: Date.now(),
            sessionId: 'old-session'
          });
        });
      }

      // Verificar que mensagem apareceu
      await waitFor(() => {
        expect(container.textContent).toContain('Mensagem da sessão anterior');
      });

      // Simular mudança de sessão (Clear Chat)
      const clearButton = screen.getByText('Clear Chat');
      fireEvent.click(clearButton);

      // Verificar que mensagens foram limpas
      await waitFor(() => {
        expect(container.textContent).not.toContain('Mensagem da sessão anterior');
      });

      // Verificar que emit foi chamado para criar nova sessão
      expect(mockSocket.emit).toHaveBeenCalledWith('create_session');
    });
  });
});