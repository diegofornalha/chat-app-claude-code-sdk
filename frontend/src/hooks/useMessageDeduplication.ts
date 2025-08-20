import { useRef, useCallback } from 'react';
import { Message } from '../types/index';

interface DeduplicationEntry {
  id: string;
  contentHash: string;
  timestamp: number;
}

/**
 * Hook para gerenciar deduplicação robusta de mensagens
 * Usa hash de conteúdo + timestamp para evitar duplicações
 */
export const useMessageDeduplication = () => {
  // Map para armazenar entradas de deduplicação com informações detalhadas
  const deduplicationMap = useRef<Map<string, DeduplicationEntry>>(new Map());
  
  // Cache secundário por hash de conteúdo para detectar duplicatas com IDs diferentes
  const contentHashMap = useRef<Map<string, Set<string>>>(new Map());
  
  // Janela de tempo para considerar mensagens como duplicatas (5 segundos)
  const DEDUP_WINDOW_MS = 5000;
  
  // Tamanho máximo do cache
  const MAX_CACHE_SIZE = 2000;
  
  /**
   * Gera hash simples do conteúdo da mensagem
   */
  const generateContentHash = (message: Message): string => {
    const content = `${message.type}_${message.content}_${message.agent || 'default'}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  };
  
  /**
   * Limpa entradas antigas do cache
   */
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const entriesToRemove: string[] = [];
    
    // Identificar entradas antigas
    deduplicationMap.current.forEach((entry, id) => {
      if (now - entry.timestamp > DEDUP_WINDOW_MS * 2) {
        entriesToRemove.push(id);
      }
    });
    
    // Remover entradas antigas
    entriesToRemove.forEach(id => {
      const entry = deduplicationMap.current.get(id);
      if (entry) {
        deduplicationMap.current.delete(id);
        
        // Limpar do mapa de hash de conteúdo
        const hashSet = contentHashMap.current.get(entry.contentHash);
        if (hashSet) {
          hashSet.delete(id);
          if (hashSet.size === 0) {
            contentHashMap.current.delete(entry.contentHash);
          }
        }
      }
    });
    
    // Se ainda estiver muito grande, remover os mais antigos
    if (deduplicationMap.current.size > MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(deduplicationMap.current.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, sortedEntries.length - MAX_CACHE_SIZE / 2);
      toRemove.forEach(([id, entry]) => {
        deduplicationMap.current.delete(id);
        
        const hashSet = contentHashMap.current.get(entry.contentHash);
        if (hashSet) {
          hashSet.delete(id);
          if (hashSet.size === 0) {
            contentHashMap.current.delete(entry.contentHash);
          }
        }
      });
    }
  }, []);
  
  /**
   * Verifica se uma mensagem é duplicada
   */
  const isDuplicate = useCallback((message: Message): boolean => {
    const now = Date.now();
    
    // Verificar por ID
    const existingEntry = deduplicationMap.current.get(message.id);
    if (existingEntry) {
      // Se a mensagem já existe e foi recebida recentemente, é duplicata
      if (now - existingEntry.timestamp < DEDUP_WINDOW_MS) {
        console.log('⚠️ [DEDUP] Duplicata detectada por ID:', message.id);
        return true;
      }
    }
    
    // Verificar por hash de conteúdo
    const contentHash = generateContentHash(message);
    const idsWithSameContent = contentHashMap.current.get(contentHash);
    
    if (idsWithSameContent && idsWithSameContent.size > 0) {
      // Verificar se alguma das mensagens com mesmo conteúdo foi recebida recentemente
      const idsArray = Array.from(idsWithSameContent);
      for (let i = 0; i < idsArray.length; i++) {
        const id = idsArray[i];
        const entry = deduplicationMap.current.get(id);
        if (entry && now - entry.timestamp < DEDUP_WINDOW_MS) {
          console.log('⚠️ [DEDUP] Duplicata detectada por conteúdo:', {
            newId: message.id,
            existingId: id,
            contentHash
          });
          return true;
        }
      }
    }
    
    return false;
  }, []);
  
  /**
   * Registra uma mensagem como processada
   */
  const registerMessage = useCallback((message: Message): void => {
    const contentHash = generateContentHash(message);
    const entry: DeduplicationEntry = {
      id: message.id,
      contentHash,
      timestamp: Date.now()
    };
    
    // Adicionar ao mapa principal
    deduplicationMap.current.set(message.id, entry);
    
    // Adicionar ao mapa de hash de conteúdo
    if (!contentHashMap.current.has(contentHash)) {
      contentHashMap.current.set(contentHash, new Set());
    }
    contentHashMap.current.get(contentHash)!.add(message.id);
    
    // Limpar cache periodicamente
    if (deduplicationMap.current.size % 100 === 0) {
      cleanupCache();
    }
    
    console.log('✅ [DEDUP] Mensagem registrada:', {
      id: message.id,
      contentHash,
      cacheSize: deduplicationMap.current.size
    });
  }, [cleanupCache]);
  
  /**
   * Limpa todo o cache de deduplicação
   */
  const clearCache = useCallback(() => {
    deduplicationMap.current.clear();
    contentHashMap.current.clear();
    console.log('🧹 [DEDUP] Cache limpo completamente');
  }, []);
  
  /**
   * Processa uma mensagem com deduplicação
   * Retorna true se a mensagem deve ser adicionada, false se é duplicata
   */
  const processMessage = useCallback((message: Message): boolean => {
    if (isDuplicate(message)) {
      return false;
    }
    
    registerMessage(message);
    return true;
  }, [isDuplicate, registerMessage]);
  
  return {
    processMessage,
    isDuplicate,
    registerMessage,
    clearCache,
    cleanupCache
  };
};