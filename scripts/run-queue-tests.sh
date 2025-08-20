#!/bin/bash

# Script para executar testes do sistema de filas de mensagens
# Uso: ./scripts/run-queue-tests.sh [opções]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações padrão
BACKEND_PORT=8080
FRONTEND_PORT=3000
TEST_TIMEOUT=60
VERBOSE=false
SKIP_SETUP=false
GENERATE_REPORT=true

# Função para mostrar uso
show_usage() {
    cat << EOF
Uso: $0 [OPÇÕES]

OPÇÕES:
    -h, --help              Mostra esta ajuda
    -v, --verbose           Modo verboso
    -s, --skip-setup       Pula verificação e setup inicial
    -t, --timeout SECONDS  Timeout para testes (padrão: 60s)
    -p, --port PORT        Porta do backend (padrão: 8080)
    -f, --frontend-port PORT Porta do frontend (padrão: 3000)
    --no-report            Não gera relatório final
    --quick                Executa apenas testes rápidos

EXEMPLOS:
    $0                      # Execução padrão
    $0 -v                   # Modo verboso
    $0 -t 120               # Timeout de 2 minutos
    $0 --quick              # Testes rápidos apenas
    $0 --skip-setup         # Pula setup inicial

EOF
}

# Parse de argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -s|--skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        -t|--timeout)
            TEST_TIMEOUT="$2"
            shift 2
            ;;
        -p|--port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        -f|--frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        --no-report)
            GENERATE_REPORT=false
            shift
            ;;
        --quick)
            TEST_TIMEOUT=30
            SKIP_SETUP=true
            shift
            ;;
        *)
            echo -e "${RED}Opção desconhecida: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Função para log colorido
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)
            echo -e "${BLUE}[${timestamp}] [INFO]${NC} $message"
            ;;
        SUCCESS)
            echo -e "${GREEN}[${timestamp}] [SUCCESS]${NC} $message"
            ;;
        WARNING)
            echo -e "${YELLOW}[${timestamp}] [WARNING]${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}[${timestamp}] [ERROR]${NC} $message"
            ;;
        *)
            echo -e "[${timestamp}] $message"
            ;;
    esac
}

# Função para verificar se uma porta está aberta
check_port() {
    local port=$1
    local host=${2:-localhost}
    
    if command -v nc >/dev/null 2>&1; then
        nc -z "$host" "$port" 2>/dev/null
    elif command -v telnet >/dev/null 2>&1; then
        timeout 3 telnet "$host" "$port" >/dev/null 2>&1
    else
        # Fallback usando /dev/tcp se disponível
        timeout 3 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null
    fi
}

# Função para verificar dependências
check_dependencies() {
    log INFO "Verificando dependências..."
    
    # Verificar Node.js
    if ! command -v node >/dev/null 2>&1; then
        log ERROR "Node.js não encontrado. Instale o Node.js primeiro."
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    log INFO "Node.js versão: $node_version"
    
    # Verificar npm
    if ! command -v npm >/dev/null 2>&1; then
        log ERROR "npm não encontrado."
        exit 1
    fi
    
    # Verificar se estamos no diretório correto
    if [[ ! -f "package.json" ]]; then
        log ERROR "package.json não encontrado. Execute este script do diretório raiz do projeto."
        exit 1
    fi
    
    log SUCCESS "Dependências verificadas com sucesso"
}

# Função para verificar se os serviços estão rodando
check_services() {
    log INFO "Verificando serviços..."
    
    # Verificar backend
    if check_port $BACKEND_PORT; then
        log SUCCESS "Backend rodando na porta $BACKEND_PORT"
    else
        log WARNING "Backend não está rodando na porta $BACKEND_PORT"
        log INFO "Tentando iniciar o backend..."
        
        # Tentar iniciar o backend
        if [[ -f "backend/package.json" ]]; then
            cd backend
            npm start &
            BACKEND_PID=$!
            cd ..
            
            # Aguardar o backend iniciar
            local attempts=0
            while ! check_port $BACKEND_PORT && [[ $attempts -lt 30 ]]; do
                sleep 1
                ((attempts++))
            done
            
            if check_port $BACKEND_PORT; then
                log SUCCESS "Backend iniciado com sucesso"
            else
                log ERROR "Falha ao iniciar o backend"
                exit 1
            fi
        else
            log ERROR "Arquivo backend/package.json não encontrado"
            exit 1
        fi
    fi
    
    # Verificar frontend (opcional)
    if check_port $FRONTEND_PORT; then
        log SUCCESS "Frontend rodando na porta $FRONTEND_PORT"
    else
        log WARNING "Frontend não está rodando na porta $FRONTEND_PORT (opcional)"
    fi
}

# Função para instalar dependências se necessário
install_dependencies() {
    log INFO "Verificando dependências do Node.js..."
    
    # Backend
    if [[ -d "backend" && -f "backend/package.json" ]]; then
        cd backend
        if [[ ! -d "node_modules" ]]; then
            log INFO "Instalando dependências do backend..."
            npm install
        fi
        cd ..
    fi
    
    # Script de teste
    if [[ ! -d "node_modules" ]]; then
        log INFO "Instalando dependências do projeto..."
        npm install
    fi
}

# Função para executar pré-verificações
run_pre_checks() {
    log INFO "Executando pré-verificações..."
    
    # Verificar se o script de teste existe
    if [[ ! -f "scripts/test-message-queue.js" ]]; then
        log ERROR "Script de teste não encontrado: scripts/test-message-queue.js"
        exit 1
    fi
    
    # Verificar se o arquivo de amostras existe
    if [[ ! -f "scripts/test-message-samples.json" ]]; then
        log WARNING "Arquivo de amostras não encontrado: scripts/test-message-samples.json"
    fi
    
    # Verificar permissões
    if [[ ! -x "scripts/test-message-queue.js" ]]; then
        log INFO "Tornando o script de teste executável..."
        chmod +x scripts/test-message-queue.js
    fi
    
    log SUCCESS "Pré-verificações concluídas"
}

# Função para executar os testes
run_tests() {
    log INFO "Iniciando execução dos testes..."
    
    local test_start_time=$(date +%s)
    
    # Criar diretório para logs se não existir
    mkdir -p logs
    
    local log_file="logs/test-queue-$(date +%Y%m%d-%H%M%S).log"
    
    # Definir variáveis de ambiente para o teste
    export TEST_BACKEND_PORT=$BACKEND_PORT
    export TEST_FRONTEND_PORT=$FRONTEND_PORT
    export TEST_TIMEOUT=$TEST_TIMEOUT
    export TEST_VERBOSE=$VERBOSE
    
    # Executar o script de teste
    if $VERBOSE; then
        log INFO "Executando testes em modo verboso..."
        node scripts/test-message-queue.js 2>&1 | tee "$log_file"
        local test_exit_code=${PIPESTATUS[0]}
    else
        log INFO "Executando testes..."
        node scripts/test-message-queue.js > "$log_file" 2>&1
        local test_exit_code=$?
        
        # Mostrar apenas o resumo final
        if [[ $test_exit_code -eq 0 ]]; then
            tail -20 "$log_file"
        else
            echo -e "${RED}Testes falharam. Log completo:${NC}"
            cat "$log_file"
        fi
    fi
    
    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - test_start_time))
    
    if [[ $test_exit_code -eq 0 ]]; then
        log SUCCESS "Testes concluídos com sucesso em ${test_duration}s"
        log INFO "Log salvo em: $log_file"
    else
        log ERROR "Testes falharam após ${test_duration}s"
        log INFO "Log de erro salvo em: $log_file"
        return $test_exit_code
    fi
}

# Função para gerar relatório final
generate_report() {
    if ! $GENERATE_REPORT; then
        return 0
    fi
    
    log INFO "Gerando relatório final..."
    
    local report_file="logs/test-report-$(date +%Y%m%d-%H%M%S).html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Testes - Sistema de Filas</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Relatório de Testes - Sistema de Filas de Mensagens</h1>
        <p><strong>Data:</strong> $(date)</p>
        <p><strong>Duração Total:</strong> ${test_duration:-0}s</p>
        <p><strong>Porta Backend:</strong> $BACKEND_PORT</p>
        <p><strong>Porta Frontend:</strong> $FRONTEND_PORT</p>
    </div>

    <div class="section">
        <h2>📋 Resumo Executivo</h2>
        <p>Este relatório contém os resultados dos testes automatizados do sistema de filas de mensagens.</p>
        <p>Os testes cobrem funcionalidades como:</p>
        <ul>
            <li>Criação e gerenciamento de filas</li>
            <li>Processamento FIFO</li>
            <li>Mensagens prioritárias</li>
            <li>Cancelamento de mensagens</li>
            <li>Tratamento de erros</li>
            <li>Integração frontend/backend</li>
            <li>Processamento concorrente</li>
        </ul>
    </div>

    <div class="section">
        <h2>🔧 Configuração dos Testes</h2>
        <table>
            <tr><th>Parâmetro</th><th>Valor</th></tr>
            <tr><td>Backend Port</td><td>$BACKEND_PORT</td></tr>
            <tr><td>Frontend Port</td><td>$FRONTEND_PORT</td></tr>
            <tr><td>Timeout</td><td>${TEST_TIMEOUT}s</td></tr>
            <tr><td>Modo Verboso</td><td>$VERBOSE</td></tr>
            <tr><td>Skip Setup</td><td>$SKIP_SETUP</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>📝 Log Completo</h2>
        <p>Para ver o log completo dos testes, consulte: <code>$(find logs -name "test-queue-*.log" | tail -1)</code></p>
    </div>

    <div class="section">
        <h2>🎯 Próximos Passos</h2>
        <ul>
            <li>Revisar testes que falharam (se houver)</li>
            <li>Verificar performance do sistema</li>
            <li>Implementar melhorias identificadas</li>
            <li>Executar testes em ambiente de produção</li>
        </ul>
    </div>
</body>
</html>
EOF
    
    log SUCCESS "Relatório HTML gerado: $report_file"
}

# Função para limpeza
cleanup() {
    log INFO "Executando limpeza..."
    
    # Parar backend se foi iniciado pelo script
    if [[ -n "$BACKEND_PID" ]]; then
        log INFO "Parando backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    
    log INFO "Limpeza concluída"
}

# Trap para limpeza em caso de interrupção
trap cleanup EXIT INT TERM

# Função principal
main() {
    echo -e "${BLUE}"
    cat << "EOF"
 ╔═══════════════════════════════════════════════════════════╗
 ║           🧪 TESTE DO SISTEMA DE FILAS DE MENSAGENS        ║
 ║                                                           ║
 ║   Script automatizado para validação completa do         ║
 ║   sistema de filas de mensagens do Claude Code SDK       ║
 ╚═══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    log INFO "Iniciando execução dos testes..."
    
    if ! $SKIP_SETUP; then
        check_dependencies
        install_dependencies
        check_services
        run_pre_checks
    else
        log INFO "Pulando setup inicial (--skip-setup)"
    fi
    
    if run_tests; then
        generate_report
        log SUCCESS "✅ Todos os testes foram executados com sucesso!"
        echo
        echo -e "${GREEN}🎉 TESTES CONCLUÍDOS COM SUCESSO! 🎉${NC}"
        echo
        exit 0
    else
        log ERROR "❌ Alguns testes falharam!"
        echo
        echo -e "${RED}💥 TESTES FALHARAM! 💥${NC}"
        echo
        exit 1
    fi
}

# Executar função principal
main "$@"