#!/bin/bash

# Script para limpar processos MCP duplicados e restart limpo
# Autor: Kingston Enhanced
# Data: 2025-08-19

echo "🔍 Verificando processos MCP rodando..."
echo "==========================================="

# Listar processos antes de matar
echo "Processos MCP atuais:"
ps aux | grep -E "(mcp-neo4j|claude-flow.*mcp|ruv-swarm.*mcp)" | grep -v grep

# Contar quantos processos existem
COUNT=$(ps aux | grep -E "(mcp-neo4j|claude-flow.*mcp|ruv-swarm.*mcp)" | grep -v grep | wc -l)
echo "Total de processos MCP encontrados: $COUNT"

if [ $COUNT -gt 0 ]; then
    echo ""
    echo "⚠️  Matando processos MCP duplicados..."
    
    # Matar processos MCP
    pkill -f "mcp-neo4j-agent-memory" 2>/dev/null
    pkill -f "claude-flow.*mcp" 2>/dev/null
    pkill -f "ruv-swarm.*mcp" 2>/dev/null
    
    echo "✅ Processos eliminados"
    
    # Aguardar processos terminarem
    echo "⏳ Aguardando 3 segundos..."
    sleep 3
else
    echo "✅ Nenhum processo MCP duplicado encontrado"
fi

echo ""
echo "🔍 Verificando Neo4j..."
echo "==========================================="

# Verificar se Neo4j está rodando
if lsof -i :7687 > /dev/null 2>&1; then
    echo "✅ Neo4j está rodando na porta 7687"
else
    echo "❌ Neo4j NÃO está rodando!"
    echo "Por favor, inicie o Neo4j com: neo4j start"
    exit 1
fi

echo ""
echo "🚀 Pronto para iniciar MCP limpo!"
echo "==========================================="
echo "Para iniciar o MCP manualmente, use:"
echo "node /Users/2a/.claude/mcp-neo4j-agent-memory/build/index.js"
echo ""
echo "Ou deixe o backend do chat iniciar automaticamente."