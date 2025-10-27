#!/bin/bash

# Painel SSH - Instalador Automático
# Versão: 1.0.0

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_message() {
    echo -e "${2}${1}${NC}"
}

print_header() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "    🔐 PAINEL SSH - INSTALADOR AUTOMÁTICO"
    echo "=================================================="
    echo -e "${NC}"
}

# Verificar se está rodando como root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_message "❌ Este script deve ser executado como root (sudo)" $RED
        exit 1
    fi
}

# Verificar sistema operacional
check_os() {
    if [[ ! -f /etc/os-release ]]; then
        print_message "❌ Sistema operacional não suportado" $RED
        exit 1
    fi
    
    . /etc/os-release
    
    if [[ "$ID" != "ubuntu" ]] && [[ "$ID" != "debian" ]]; then
        print_message "❌ Sistema operacional não suportado. Use Ubuntu ou Debian" $RED
        exit 1
    fi
    
    print_message "✅ Sistema operacional: $PRETTY_NAME" $GREEN
}

# Atualizar sistema
update_system() {
    print_message "🔄 Atualizando sistema..." $YELLOW
    apt update -y
    apt upgrade -y
    print_message "✅ Sistema atualizado" $GREEN
}

# Instalar dependências do sistema
install_system_deps() {
    print_message "📦 Instalando dependências do sistema..." $YELLOW
    
    apt install -y \
        curl \
        wget \
        git \
        unzip \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        nodejs \
        npm \
        sqlite3 \
        jq \
        perl \
        openssl \
        cron \
        systemd \
        ufw \
        iptables
    
    print_message "✅ Dependências do sistema instaladas" $GREEN
}

# Verificar e instalar Node.js (versão específica)
install_nodejs() {
    print_message "🟢 Verificando Node.js..." $YELLOW
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        print_message "Node.js encontrado: v$NODE_VERSION" $BLUE
        
        # Verificar se a versão é adequada (>= 16.0.0)
        if ! node -e "process.exit(parseInt(process.version.slice(1).split('.')[0]) >= 16 ? 0 : 1)" 2>/dev/null; then
            print_message "⚠️  Versão do Node.js muito antiga. Instalando versão mais recente..." $YELLOW
            install_nodejs_latest
        else
            print_message "✅ Node.js versão adequada" $GREEN
        fi
    else
        print_message "Node.js não encontrado. Instalando..." $YELLOW
        install_nodejs_latest
    fi
}

install_nodejs_latest() {
    # Instalar Node.js via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    
    NODE_VERSION=$(node --version)
    print_message "✅ Node.js instalado: $NODE_VERSION" $GREEN
}

# Verificar e instalar Go
install_golang() {
    print_message "🔵 Verificando Go..." $YELLOW
    
    if command -v go &> /dev/null; then
        GO_VERSION=$(go version | cut -d' ' -f3 | cut -d'o' -f2)
        print_message "Go encontrado: $GO_VERSION" $BLUE
        
        # Verificar se a versão é adequada (>= 1.19)
        if ! go version | grep -q "go1.19\|go1.2[0-9]\|go1.3[0-9]"; then
            print_message "⚠️  Versão do Go muito antiga. Instalando versão mais recente..." $YELLOW
            install_golang_latest
        else
            print_message "✅ Go versão adequada" $GREEN
        fi
    else
        print_message "Go não encontrado. Instalando..." $YELLOW
        install_golang_latest
    fi
}

install_golang_latest() {
    # Baixar e instalar Go
    GO_VERSION="1.21.5"
    wget https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz
    tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz
    rm go${GO_VERSION}.linux-amd64.tar.gz
    
    # Adicionar Go ao PATH
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
    
    print_message "✅ Go instalado: v$GO_VERSION" $GREEN
}

# Instalar dependências do projeto
install_project_deps() {
    print_message "📦 Instalando dependências do projeto..." $YELLOW
    
    # Backend dependencies
    if [[ -f "package.json" ]]; then
        npm install
        print_message "✅ Dependências do backend instaladas" $GREEN
    fi
    
    # Frontend dependencies
    if [[ -d "client" ]] && [[ -f "client/package.json" ]]; then
        cd client
        npm install
        cd ..
        print_message "✅ Dependências do frontend instaladas" $GREEN
    fi
}

# Compilar agentes Go
compile_agents() {
    print_message "🔨 Compilando agentes Go..." $YELLOW
    
    if [[ -d "agents/go" ]]; then
        cd agents/go
        go mod tidy
        go build -o painelssjf-agent main.go
        chmod +x painelssjf-agent
        cd ../..
        print_message "✅ Agente Go compilado" $GREEN
    fi
}

# Configurar banco de dados
setup_database() {
    print_message "🗄️  Configurando banco de dados..." $YELLOW
    
    if [[ -f "server/database/database.js" ]]; then
        # O banco será criado automaticamente na primeira execução
        print_message "✅ Banco de dados configurado" $GREEN
    fi
}

# Configurar variáveis de ambiente
setup_env() {
    print_message "⚙️  Configurando variáveis de ambiente..." $YELLOW
    
    if [[ ! -f ".env" ]]; then
        cat > .env << EOF
# Configurações do Painel SSH
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:3001

# JWT Secret (altere em produção)
JWT_SECRET=painelssh_secret_key_$(openssl rand -hex 32)

# Mercado Pago (configure após a instalação)
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=

# Telegram Bot (configure após a instalação)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF
        print_message "✅ Arquivo .env criado" $GREEN
    else
        print_message "⚠️  Arquivo .env já existe" $YELLOW
    fi
}

# Criar usuário do sistema
create_system_user() {
    print_message "👤 Configurando usuário do sistema..." $YELLOW
    
    if ! id "painelssh" &>/dev/null; then
        useradd -m -s /bin/bash painelssh
        usermod -aG sudo painelssh
        print_message "✅ Usuário 'painelssh' criado" $GREEN
    else
        print_message "⚠️  Usuário 'painelssh' já existe" $YELLOW
    fi
}

# Configurar firewall
setup_firewall() {
    print_message "🔥 Configurando firewall..." $YELLOW
    
    # Permitir portas necessárias
    ufw allow 22/tcp    # SSH
    ufw allow 3000/tcp  # Frontend (desenvolvimento)
    ufw allow 3001/tcp  # Backend
    ufw allow 6969/tcp  # Agente SSH
    
    # Habilitar firewall se não estiver ativo
    if ! ufw status | grep -q "Status: active"; then
        echo "y" | ufw enable
    fi
    
    print_message "✅ Firewall configurado" $GREEN
}

# Criar serviço systemd
create_systemd_service() {
    print_message "🔧 Criando serviço systemd..." $YELLOW
    
    cat > /etc/systemd/system/painelssh.service << EOF
[Unit]
Description=Painel SSH Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable painelssh
    print_message "✅ Serviço systemd criado" $GREEN
}

# Iniciar serviços
start_services() {
    print_message "🚀 Iniciando serviços..." $YELLOW
    
    # Iniciar serviço principal
    systemctl start painelssh
    
    # Verificar status
    if systemctl is-active --quiet painelssh; then
        print_message "✅ Serviço principal iniciado" $GREEN
    else
        print_message "❌ Erro ao iniciar serviço principal" $RED
        systemctl status painelssh
        exit 1
    fi
}

# Configurar cron para backup
setup_cron() {
    print_message "⏰ Configurando tarefas agendadas..." $YELLOW
    
    # Backup automático a cada 8 horas
    (crontab -l 2>/dev/null; echo "0 */8 * * * cd $(pwd) && node -e \"require('./server/routes/backup').performBackup()\"") | crontab -
    
    # Limpeza de logs antigos
    (crontab -l 2>/dev/null; echo "0 2 * * * find /var/log -name '*.log' -mtime +7 -delete") | crontab -
    
    print_message "✅ Tarefas agendadas configuradas" $GREEN
}

# Mostrar informações finais
show_final_info() {
    print_message "" $NC
    print_message "🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!" $GREEN
    print_message "" $NC
    print_message "📋 INFORMAÇÕES DE ACESSO:" $BLUE
    print_message "🌐 Frontend: http://$(hostname -I | awk '{print $1}'):3000" $NC
    print_message "🔧 Backend: http://$(hostname -I | awk '{print $1}'):3001" $NC
    print_message "" $NC
    print_message "👤 CREDENCIAIS PADRÃO:" $BLUE
    print_message "Username: admin" $NC
    print_message "Senha: admin123" $NC
    print_message "" $NC
    print_message "⚙️  CONFIGURAÇÕES ADICIONAIS:" $BLUE
    print_message "1. Configure as credenciais do Mercado Pago no painel" $NC
    print_message "2. Configure o bot do Telegram no painel" $NC
    print_message "3. Adicione seus servidores VPS no painel" $NC
    print_message "" $NC
    print_message "🔧 COMANDOS ÚTEIS:" $BLUE
    print_message "sudo systemctl status painelssh    # Status do serviço" $NC
    print_message "sudo systemctl restart painelssh  # Reiniciar serviço" $NC
    print_message "sudo systemctl stop painelssh     # Parar serviço" $NC
    print_message "sudo systemctl start painelssh    # Iniciar serviço" $NC
    print_message "" $NC
    print_message "📁 LOCALIZAÇÃO DOS ARQUIVOS:" $BLUE
    print_message "Diretório: $(pwd)" $NC
    print_message "Logs: journalctl -u painelssh -f" $NC
    print_message "" $NC
}

# Função principal
main() {
    print_header
    
    print_message "🚀 Iniciando instalação do Painel SSH..." $GREEN
    
    check_root
    check_os
    update_system
    install_system_deps
    install_nodejs
    install_golang
    install_project_deps
    compile_agents
    setup_database
    setup_env
    create_system_user
    setup_firewall
    create_systemd_service
    start_services
    setup_cron
    
    show_final_info
}

# Executar instalação
main "$@"
