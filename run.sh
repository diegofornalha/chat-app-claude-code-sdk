#!/bin/bash

# Script para executar o Chat App com Claude Code SDK
# Este script inicia tanto o backend quanto o frontend simultaneamente

echo "🚀 Iniciando Chat App com Claude Code SDK..."
echo ""

# Função para verificar se as dependências estão instaladas
check_dependencies() {
    local dir=$1
    local name=$2
    
    if [ ! -d "$dir/node_modules" ]; then
        echo "📦 Instalando dependências do $name..."
        cd "$dir"
        npm install
        cd - > /dev/null
        echo "✅ Dependências do $name instaladas!"
        echo ""
    fi
}

# Função para cleanup ao encerrar
cleanup() {
    echo ""
    echo "🛑 Encerrando aplicação..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Configura o trap para cleanup ao receber sinais de interrupção
trap cleanup INT TERM

# Verifica e instala dependências se necessário
check_dependencies "backend" "Backend"
check_dependencies "frontend" "Frontend"

# Inicia o Backend
echo "🔧 Iniciando Backend na porta 8080..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Aguarda um pouco para o backend iniciar
sleep 2

# Inicia o Frontend
echo "🎨 Iniciando Frontend na porta 3000..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✨ Chat App iniciado com sucesso!"
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend: http://localhost:8080"
echo ""
echo "Pressione Ctrl+C para encerrar ambos os serviços"

# Mantém o script rodando
wait $BACKEND_PID $FRONTEND_PID