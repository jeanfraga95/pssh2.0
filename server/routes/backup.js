const express = require('express');
const { authenticateToken } = require('./auth');
const { db } = require('../database/database');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const router = express.Router();

let bot = null;

// Inicializar bot do Telegram
function initTelegramBot() {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('✅ Bot do Telegram inicializado');
  }
}

// Configurar backup automático (a cada 8 horas)
cron.schedule('0 */8 * * *', () => {
  performBackup();
});

// Realizar backup
router.post('/create', authenticateToken, (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode criar backups' 
    });
  }

  performBackup()
    .then((backupPath) => {
      res.json({
        success: true,
        message: 'Backup criado com sucesso',
        backup_path: backupPath
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: 'Erro ao criar backup',
        error: error.message
      });
    });
});

// Restaurar backup
router.post('/restore', authenticateToken, [
  require('express-validator').body('backup_file').notEmpty().withMessage('Arquivo de backup é obrigatório')
], (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode restaurar backups' 
    });
  }

  const { backup_file } = req.body;

  restoreBackup(backup_file)
    .then(() => {
      res.json({
        success: true,
        message: 'Backup restaurado com sucesso'
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: 'Erro ao restaurar backup',
        error: error.message
      });
    });
});

// Listar backups
router.get('/list', authenticateToken, (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode listar backups' 
    });
  }

  const backupDir = path.join(__dirname, '../backups');
  
  if (!fs.existsSync(backupDir)) {
    return res.json({
      success: true,
      backups: []
    });
  }

  fs.readdir(backupDir, (err, files) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar backups'
      });
    }

    const backups = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created_at: stats.birthtime
        };
      })
      .sort((a, b) => b.created_at - a.created_at);

    res.json({
      success: true,
      backups
    });
  });
});

// Configurar bot do Telegram
router.post('/telegram-config', authenticateToken, [
  require('express-validator').body('bot_token').notEmpty().withMessage('Bot Token é obrigatório'),
  require('express-validator').body('chat_id').notEmpty().withMessage('Chat ID é obrigatório')
], (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode configurar Telegram' 
    });
  }

  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { bot_token, chat_id } = req.body;

  // Salvar configurações
  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ['telegram_bot_token', bot_token],
    (err) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      db.run(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ['telegram_chat_id', chat_id],
        (err) => {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Erro interno do servidor' 
            });
          }

          // Testar bot
          testTelegramBot(bot_token, chat_id)
            .then(() => {
              res.json({
                success: true,
                message: 'Configurações do Telegram salvas e testadas com sucesso'
              });
            })
            .catch((error) => {
              res.status(400).json({
                success: false,
                message: 'Erro ao testar bot do Telegram',
                error: error.message
              });
            });
        }
      );
    }
  );
});

// Obter configurações do Telegram
router.get('/telegram-config', authenticateToken, (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode ver configurações' 
    });
  }

  db.all(
    "SELECT key, value FROM settings WHERE key LIKE 'telegram_%'",
    (err, settings) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      const config = {};
      settings.forEach(setting => {
        config[setting.key.replace('telegram_', '')] = setting.value;
      });

      res.json({
        success: true,
        config
      });
    }
  );
});

// Funções auxiliares
async function performBackup() {
  return new Promise((resolve, reject) => {
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {}
    };

    // Backup de usuários
    db.all("SELECT * FROM users", (err, users) => {
      if (err) {
        reject(err);
        return;
      }
      backupData.data.users = users;

      // Backup de servidores
      db.all("SELECT id, name, ip, port, status, created_at FROM servers", (err, servers) => {
        if (err) {
          reject(err);
          return;
        }
        backupData.data.servers = servers;

        // Backup de acessos SSH
        db.all("SELECT * FROM ssh_access", (err, ssh_access) => {
          if (err) {
            reject(err);
            return;
          }
          backupData.data.ssh_access = ssh_access;

          // Backup de pagamentos
          db.all("SELECT * FROM payments", (err, payments) => {
            if (err) {
              reject(err);
              return;
            }
            backupData.data.payments = payments;

            // Backup de configurações
            db.all("SELECT * FROM settings", (err, settings) => {
              if (err) {
                reject(err);
                return;
              }
              backupData.data.settings = settings;

              // Salvar arquivo de backup
              const backupDir = path.join(__dirname, '../backups');
              if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
              }

              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const backupPath = path.join(backupDir, `backup-${timestamp}.json`);

              fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                // Enviar para Telegram
                sendBackupToTelegram(backupPath)
                  .then(() => {
                    console.log('✅ Backup criado e enviado para Telegram');
                    resolve(backupPath);
                  })
                  .catch((error) => {
                    console.error('Erro ao enviar backup para Telegram:', error);
                    resolve(backupPath); // Resolve mesmo com erro no Telegram
                  });
              });
            });
          });
        });
      });
    });
  });
}

async function restoreBackup(backupFile) {
  return new Promise((resolve, reject) => {
    const backupPath = path.join(__dirname, '../backups', backupFile);
    
    if (!fs.existsSync(backupPath)) {
      reject(new Error('Arquivo de backup não encontrado'));
      return;
    }

    fs.readFile(backupPath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const backupData = JSON.parse(data);
        
        // Limpar dados existentes
        db.serialize(() => {
          db.run("DELETE FROM payments");
          db.run("DELETE FROM ssh_access");
          db.run("DELETE FROM servers");
          db.run("DELETE FROM users WHERE role != 'admin'");
          db.run("DELETE FROM settings");

          // Restaurar dados
          if (backupData.data.users) {
            backupData.data.users.forEach(user => {
              if (user.role !== 'admin') {
                db.run(
                  "INSERT INTO users (username, email, password, role, parent_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [user.username, user.email, user.password, user.role, user.parent_id, user.status, user.created_at]
                );
              }
            });
          }

          if (backupData.data.servers) {
            backupData.data.servers.forEach(server => {
              db.run(
                "INSERT INTO servers (name, ip, port, status, created_at) VALUES (?, ?, ?, ?, ?)",
                [server.name, server.ip, server.port, server.status, server.created_at]
              );
            });
          }

          if (backupData.data.ssh_access) {
            backupData.data.ssh_access.forEach(access => {
              db.run(
                "INSERT INTO ssh_access (username, password, server_id, user_id, created_by, expires_at, status, max_connections, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [access.username, access.password, access.server_id, access.user_id, access.created_by, access.expires_at, access.status, access.max_connections, access.created_at]
              );
            });
          }

          if (backupData.data.payments) {
            backupData.data.payments.forEach(payment => {
              db.run(
                "INSERT INTO payments (user_id, ssh_access_id, amount, payment_method, payment_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [payment.user_id, payment.ssh_access_id, payment.amount, payment.payment_method, payment.payment_id, payment.status, payment.created_at]
              );
            });
          }

          if (backupData.data.settings) {
            backupData.data.settings.forEach(setting => {
              db.run(
                "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                [setting.key, setting.value, setting.updated_at]
              );
            });
          }

          resolve();
        });
      } catch (error) {
        reject(new Error('Arquivo de backup inválido'));
      }
    });
  });
}

async function sendBackupToTelegram(backupPath) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT value FROM settings WHERE key = 'telegram_bot_token'",
      (err, tokenRows) => {
        if (err || !tokenRows.length) {
          reject(new Error('Bot token não configurado'));
          return;
        }

        db.all(
          "SELECT value FROM settings WHERE key = 'telegram_chat_id'",
          (err, chatRows) => {
            if (err || !chatRows.length) {
              reject(new Error('Chat ID não configurado'));
              return;
            }

            const bot = new TelegramBot(tokenRows[0].value, { polling: false });
            const chatId = chatRows[0].value;

            bot.sendDocument(chatId, backupPath, {
              caption: `🔄 Backup automático do Painel SSH\n📅 ${new Date().toLocaleString('pt-BR')}`
            })
              .then(() => {
                resolve();
              })
              .catch((error) => {
                reject(error);
              });
          }
        );
      }
    );
  });
}

async function testTelegramBot(botToken, chatId) {
  return new Promise((resolve, reject) => {
    const bot = new TelegramBot(botToken, { polling: false });
    
    bot.sendMessage(chatId, '🤖 Teste de configuração do bot do Painel SSH')
      .then(() => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

// Inicializar bot na inicialização do módulo
initTelegramBot();

module.exports = router;
