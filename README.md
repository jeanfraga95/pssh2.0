# 🔐 Painel SSH - Sistema Administrativo Multi-nível

Sistema completo de gerenciamento de acessos SSH com múltiplos níveis de usuários, cobrança automática e monitoramento em tempo real.

## 🚀 Características Principais

### 👥 Sistema Multi-nível
- **Admin**: Acesso total ao sistema
- **Revenda**: Pode criar clientes e sub-revendas
- **Sub-revenda**: Pode criar apenas clientes
- **Cliente**: Acesso limitado aos próprios dados

### 🔐 Gerenciamento SSH
- Criação, suspensão, reativação e exclusão de usuários SSH
- Controle de validade e limite de conexões
- Testes SSH de 2 horas com exclusão automática
- Suporte a múltiplos servidores VPS

### 💳 Sistema de Pagamentos
- Integração com Mercado Pago (PIX + Cartão)
- Renovação automática após pagamento
- Relatórios de vendas e pagamentos

### 📊 Monitoramento
- Usuários online em tempo real
- Estatísticas do sistema
- Monitoramento de recursos dos servidores (CPU, RAM, Disco)
- Controle de sessões ativas

### 💾 Backup Automático
- Backup automático a cada 8 horas
- Envio para Telegram Bot
- Restauração de backups
- Inclui todos os dados do sistema

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** com Express
- **SQLite** para banco de dados
- **JWT** para autenticação
- **bcryptjs** para criptografia de senhas
- **Mercado Pago API** para pagamentos
- **Telegram Bot API** para notificações

### Frontend
- **React 18** com hooks
- **React Router** para navegação
- **Axios** para requisições HTTP
- **React Toastify** para notificações
- **Styled Components** para estilização

### Agentes
- **Go** para agentes dos servidores VPS
- **Python** para scripts auxiliares
- **Bash** para comandos SSH

## 📦 Instalação

### Pré-requisitos
- Ubuntu 20.04+ ou Debian 10+
- Acesso root ou sudo
- Conexão com internet

### Instalação Automática
```bash
# Baixar o projeto
git clone <repository-url>
cd painelssh

# Executar instalador
sudo chmod +x install.sh
sudo ./install.sh
```

O instalador irá:
1. ✅ Verificar e instalar dependências do sistema
2. ✅ Instalar Node.js (versão 18+)
3. ✅ Instalar Go (versão 1.21+)
4. ✅ Instalar dependências do projeto
5. ✅ Compilar agentes Go
6. ✅ Configurar banco de dados
7. ✅ Criar serviço systemd
8. ✅ Configurar firewall
9. ✅ Iniciar serviços

### Acesso Inicial
- **Frontend**: http://seu-ip:3000
- **Backend**: http://seu-ip:3001
- **Credenciais padrão**: admin / admin123

## 🔧 Configuração

### 1. Mercado Pago
1. Acesse o painel como admin
2. Vá em "Pagamentos" → "Configurar Mercado Pago"
3. Insira seu Access Token e Public Key

### 2. Telegram Bot
1. Crie um bot com @BotFather
2. Acesse "Backup" → "Configurar Telegram"
3. Insira o token do bot e chat ID

### 3. Servidores VPS
1. Acesse "Servidores" → "Adicionar Servidor"
2. Insira IP, porta, usuário e senha
3. O sistema instalará automaticamente o agente

## 📁 Estrutura do Projeto

```
painelssh/
├── server/                 # Backend Node.js
│   ├── routes/            # Rotas da API
│   ├── database/          # Configuração do banco
│   └── index.js           # Servidor principal
├── client/                # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── contexts/      # Contextos React
│   │   └── App.js         # Aplicação principal
│   └── public/            # Arquivos estáticos
├── agents/               # Agentes para servidores
│   ├── go/               # Agente em Go
│   └── python/           # Scripts Python
├── install.sh            # Instalador automático
└── README.md             # Este arquivo
```

## 🔐 Segurança

- **Autenticação JWT** com expiração
- **Rate limiting** para prevenir ataques
- **Criptografia de senhas** com bcrypt
- **Validação de dados** em todas as rotas
- **CORS** configurado adequadamente
- **Helmet** para headers de segurança

## 📊 Monitoramento

### Recursos do Servidor
- CPU, RAM e uso de disco
- Comandos remotos via SSH
- Liberação de portas (iptables)
- Reinicialização de servidores

### Usuários Online
- Lista de sessões ativas
- IP de origem
- Tempo de conexão
- Desconexão forçada

## 🔄 Backup e Restauração

### Backup Automático
- Executado a cada 8 horas
- Enviado para Telegram
- Inclui todos os dados do sistema

### Restauração
- Interface web para restaurar backups
- Substitui todos os dados atuais
- Confirmação obrigatória

## 🚀 Comandos Úteis

```bash
# Status do serviço
sudo systemctl status painelssh

# Reiniciar serviço
sudo systemctl restart painelssh

# Parar serviço
sudo systemctl stop painelssh

# Iniciar serviço
sudo systemctl start painelssh

# Ver logs
journalctl -u painelssh -f

# Backup manual
cd /caminho/do/projeto
node -e "require('./server/routes/backup').performBackup()"
```

## 🐛 Solução de Problemas

### Serviço não inicia
```bash
# Verificar logs
journalctl -u painelssh -f

# Verificar dependências
node --version
npm --version
```

### Banco de dados
```bash
# Verificar arquivo do banco
ls -la server/database/

# Recriar banco (CUIDADO: apaga todos os dados)
rm server/database/painelssh.db
sudo systemctl restart painelssh
```

### Firewall
```bash
# Verificar status
sudo ufw status

# Liberar portas
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw allow 6969
```

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📞 Suporte

Para suporte técnico ou dúvidas:
- Abra uma issue no GitHub
- Consulte a documentação
- Verifique os logs do sistema

---

**Desenvolvido com ❤️ para gerenciamento profissional de SSH**
