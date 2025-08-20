/**
 * Sistema robusto de deduplicação de mensagens
 * Previne duplicação usando múltiplas estratégias
 */

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  agent?: string;
  sessionId?: string;
  is_error?: boolean;
  cost?: number;
  duration?: number;
  turns?: number;
}

export interface DeduplicationEntry {
  id: string;
  contentHash: string;
  timestamp: number;
  addedAt: number;
}

export class MessageDeduplicator {
  private deduplicationMap: Map<string, DeduplicationEntry>;
  private maxEntries: number;
  private timeWindow: number;
  
  constructor(maxEntries = 2000, timeWindow = 2000) {
    this.deduplicationMap = new Map();
    this.maxEntries = maxEntries;
    this.timeWindow = timeWindow;
  }
  
  /**
   * Gera hash do conteúdo da mensagem para detecção de duplicatas
   */
  private generateContentHash(message: Message): string {
    const content = `${message.type}_${message.content}_${message.agent || 'default'}`;
    // Usar btoa para criar hash simples (pode ser substituído por crypto se necessário)
    try {
      return btoa(content).substring(0, 16);
    } catch {
      // Fallback para caracteres especiais
      return content.split('').reduce((hash, char) => {
        const chr = char.charCodeAt(0);
        return ((hash << 5) - hash) + chr;
      }, 0).toString(36);
    }
  }
  
  /**
   * Verifica se uma mensagem é duplicata
   */
  isDuplicate(message: Message): boolean {
    const now = Date.now();
    const contentHash = this.generateContentHash(message);
    
    // Verificar por ID
    if (this.deduplicationMap.has(message.id)) {
      const existing = this.deduplicationMap.get(message.id)!;
      
      // Se a mensagem chegou dentro da janela de tempo, é duplicata
      if (now - existing.addedAt < this.timeWindow) {
        console.log('⚠️ [DEDUP] Duplicata por ID detectada:', message.id);
        return true;
      }
    }
    
    // Verificar por conteúdo similar dentro de janela de tempo
    const entries = Array.from(this.deduplicationMap.entries());
    for (let i = 0; i < entries.length; i++) {
      const [id, data] = entries[i];
      if (data.contentHash === contentHash && 
          Math.abs(message.timestamp - data.timestamp) < 1000) {
        console.log('⚠️ [DEDUP] Duplicata por conteúdo detectada:', message.id);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Adiciona mensagem ao cache de deduplicação
   */
  addMessage(message: Message): void {
    const now = Date.now();
    const contentHash = this.generateContentHash(message);
    
    // Adicionar ao mapa
    this.deduplicationMap.set(message.id, {
      id: message.id,
      contentHash,
      timestamp: message.timestamp,
      addedAt: now
    });
    
    // Limpar entradas antigas se necessário
    this.cleanup();
  }
  
  /**
   * Processa mensagem e retorna se deve ser adicionada
   */
  processMessage(message: Message): boolean {
    if (this.isDuplicate(message)) {
      return false;
    }
    
    this.addMessage(message);
    return true;
  }
  
  /**
   * Limpa entradas antigas do cache
   */
  private cleanup(): void {
    if (this.deduplicationMap.size > this.maxEntries) {
      const entries = Array.from(this.deduplicationMap.entries());
      const toKeep = entries.slice(-Math.floor(this.maxEntries * 0.75));
      this.deduplicationMap = new Map(toKeep);
      console.log('🧹 [DEDUP] Cache limpo, mantendo', toKeep.length, 'entradas');
    }
  }
  
  /**
   * Limpa todo o cache (útil ao mudar de sessão)
   */
  clear(): void {
    this.deduplicationMap.clear();
    console.log('🔄 [DEDUP] Cache completamente limpo');
  }
  
  /**
   * Retorna estatísticas do cache
   */
  getStats(): { size: number; maxSize: number; utilizationPercent: number } {
    return {
      size: this.deduplicationMap.size,
      maxSize: this.maxEntries,
      utilizationPercent: (this.deduplicationMap.size / this.maxEntries) * 100
    };
  }
}

/**
 * Hook React para usar o deduplicador
 */
export function useMessageDeduplicator(maxEntries = 2000, timeWindow = 2000) {
  const deduplicatorRef = React.useRef<MessageDeduplicator | null>(null);
  
  if (!deduplicatorRef.current) {
    deduplicatorRef.current = new MessageDeduplicator(maxEntries, timeWindow);
  }
  
  return deduplicatorRef.current;
}

// Re-export para facilitar importação
import React from 'react';