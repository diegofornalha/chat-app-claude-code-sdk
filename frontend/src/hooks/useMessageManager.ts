import { useState, useCallback, useRef } from 'react';
import { Message } from '../types/index';
import { useMessageDeduplication } from './useMessageDeduplication';

interface MessageManagerOptions {
  onMessageAdded?: (message: Message) => void;
  onMessagesCleared?: () => void;
  maxMessages?: number;
}

/**
 * Hook centralizado para gerenciar todas as operações de mensagens
 * Garante deduplicação e ordem consistente
 */
export const useMessageManager = (options: MessageManagerOptions = {}) => {
  const { onMessageAdded, onMessagesCleared, maxMessages = 1000 } = options;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const { processMessage, clearCache } = useMessageDeduplication();
  
  // Referência para a última mensagem processada
  const lastProcessedRef = useRef<string | null>(null);
  
  // Lock para evitar condições de corrida
  const processingLock = useRef(false);
  
  /**
   * Adiciona uma mensagem com deduplicação e ordenação
   */
  const addMessage = useCallback((message: Message & { sessionId?: string }) => {
    // Usar lock para evitar processamento simultâneo
    if (processingLock.current) {
      console.log('🔒 [MESSAGE_MANAGER] Aguardando lock...');
      setTimeout(() => addMessage(message), 10);
      return;
    }
    
    processingLock.current = true;
    
    try {
      // Verificar deduplicação
      if (!processMessage(message)) {
        console.log('⚠️ [MESSAGE_MANAGER] Mensagem duplicada ignorada:', message.id);
        return;
      }
      
      // Adicionar mensagem ao estado
      setMessages(prev => {
        // Verificação dupla no estado
        const exists = prev.some(m => m.id === message.id);
        if (exists) {
          console.log('⚠️ [MESSAGE_MANAGER] Mensagem já existe no estado:', message.id);
          return prev;
        }
        
        // Adicionar e ordenar por timestamp
        const newMessages = [...prev, message].sort((a, b) => a.timestamp - b.timestamp);
        
        // Limitar número de mensagens
        if (newMessages.length > maxMessages) {
          return newMessages.slice(-maxMessages);
        }
        
        console.log('✅ [MESSAGE_MANAGER] Mensagem adicionada:', {
          id: message.id,
          type: message.type,
          totalMessages: newMessages.length
        });
        
        // Callback quando mensagem é adicionada
        if (onMessageAdded) {
          onMessageAdded(message);
        }
        
        lastProcessedRef.current = message.id;
        return newMessages;
      });
    } finally {
      processingLock.current = false;
    }
  }, [processMessage, maxMessages, onMessageAdded]);
  
  /**
   * Adiciona múltiplas mensagens de uma vez (útil para carregar histórico)
   */
  const addMessages = useCallback((newMessages: Message[]) => {
    console.log('📦 [MESSAGE_MANAGER] Adicionando múltiplas mensagens:', newMessages.length);
    
    // Processar mensagens em ordem
    const validMessages = newMessages.filter(msg => processMessage(msg));
    
    if (validMessages.length === 0) {
      console.log('⚠️ [MESSAGE_MANAGER] Todas as mensagens eram duplicatas');
      return;
    }
    
    setMessages(prev => {
      // Filtrar duplicatas existentes
      const existingIds = new Set(prev.map(m => m.id));
      const uniqueMessages = validMessages.filter(m => !existingIds.has(m.id));
      
      if (uniqueMessages.length === 0) {
        return prev;
      }
      
      // Combinar e ordenar
      const combined = [...prev, ...uniqueMessages].sort((a, b) => a.timestamp - b.timestamp);
      
      // Limitar número de mensagens
      if (combined.length > maxMessages) {
        return combined.slice(-maxMessages);
      }
      
      console.log('✅ [MESSAGE_MANAGER] Mensagens adicionadas:', {
        added: uniqueMessages.length,
        total: combined.length
      });
      
      return combined;
    });
  }, [processMessage, maxMessages]);
  
  /**
   * Atualiza uma mensagem existente
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
    
    console.log('📝 [MESSAGE_MANAGER] Mensagem atualizada:', messageId);
  }, []);
  
  /**
   * Remove uma mensagem
   */
  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    console.log('🗑️ [MESSAGE_MANAGER] Mensagem removida:', messageId);
  }, []);
  
  /**
   * Limpa todas as mensagens
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    clearCache();
    lastProcessedRef.current = null;
    
    console.log('🧹 [MESSAGE_MANAGER] Todas as mensagens limpas');
    
    if (onMessagesCleared) {
      onMessagesCleared();
    }
  }, [clearCache, onMessagesCleared]);
  
  /**
   * Substitui todas as mensagens (útil para carregar sessão)
   */
  const setAllMessages = useCallback((newMessages: Message[]) => {
    console.log('🔄 [MESSAGE_MANAGER] Substituindo todas as mensagens:', newMessages.length);
    
    // Limpar cache de deduplicação
    clearCache();
    
    // Registrar todas as novas mensagens no cache
    newMessages.forEach(msg => processMessage(msg));
    
    // Ordenar por timestamp
    const sorted = [...newMessages].sort((a, b) => a.timestamp - b.timestamp);
    
    // Limitar número de mensagens
    if (sorted.length > maxMessages) {
      setMessages(sorted.slice(-maxMessages));
    } else {
      setMessages(sorted);
    }
  }, [clearCache, processMessage, maxMessages]);
  
  /**
   * Retorna a última mensagem
   */
  const getLastMessage = useCallback((): Message | null => {
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }, [messages]);
  
  /**
   * Retorna mensagens filtradas por tipo
   */
  const getMessagesByType = useCallback((type: 'user' | 'assistant') => {
    return messages.filter(msg => msg.type === type);
  }, [messages]);
  
  return {
    messages,
    addMessage,
    addMessages,
    updateMessage,
    removeMessage,
    clearMessages,
    setAllMessages,
    getLastMessage,
    getMessagesByType,
    messageCount: messages.length
  };
};