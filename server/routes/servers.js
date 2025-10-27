const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');
const axios = require('axios');
const { Client } = require('ssh2');

const router = express.Router();

// Listar servidores
router.get('/', authenticateToken, (req, res) => {
  const { role } = req.user;

  if (role === 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para acessar servidores' 
    });
  }

  db.all(
    "SELECT id, name, ip, port, status, created_at FROM servers ORDER BY created_at DESC",
    (err, servers) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      res.json({
        success: true,
        servers
      });
    }
  );
});

// Obter servidor específico
router.get('/:id', authenticateToken, (req, res) => {
  const { role } = req.user;
  const serverId = req.params.id;

  if (role === 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para acessar servidores' 
    });
  }

  db.get(
    "SELECT id, name, ip, port, status, created_at FROM servers WHERE id = ?",
    [serverId],
    (err, server) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!server) {
        return res.status(404).json({ 
          success: false, 
          message: 'Servidor não encontrado' 
        });
      }

      res.json({
        success: true,
        server
      });
    }
  );
});

// Adicionar servidor (apenas admin)
router.post('/', authenticateToken, [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('ip').isIP().withMessage('IP inválido'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Porta inválida'),
  body('username').notEmpty().withMessage('Username é obrigatório'),
  body('password').notEmpty().withMessage('Senha é obrigatória')
], (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode adicionar servidores' 
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { name, ip, port, username, password } = req.body;

  db.run(
    "INSERT INTO servers (name, ip, port, username, password) VALUES (?, ?, ?, ?, ?)",
    [name, ip, port, username, password],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      const serverId = this.lastID;

      // Instalar agente no servidor
      installAgent(ip, port, username, password, serverId)
        .then(() => {
          res.json({
            success: true,
            message: 'Servidor adicionado e agente instalado com sucesso',
            serverId
          });
        })
        .catch((error) => {
          console.error('Erro ao instalar agente:', error);
          res.json({
            success: true,
            message: 'Servidor adicionado, mas falha ao instalar agente',
            serverId,
            warning: error.message
          });
        });
    }
  );
});

// Atualizar servidor
router.put('/:id', authenticateToken, [
  body('name').optional().notEmpty().withMessage('Nome não pode estar vazio'),
  body('ip').optional().isIP().withMessage('IP inválido'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Porta inválida'),
  body('status').optional().isIn(['ativo', 'inativo', 'erro']).withMessage('Status inválido')
], (req, res) => {
  const { role } = req.user;
  const serverId = req.params.id;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode editar servidores' 
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { name, ip, port, status } = req.body;

  let updateFields = [];
  let params = [];

  if (name) {
    updateFields.push('name = ?');
    params.push(name);
  }
  if (ip) {
    updateFields.push('ip = ?');
    params.push(ip);
  }
  if (port) {
    updateFields.push('port = ?');
    params.push(port);
  }
  if (status) {
    updateFields.push('status = ?');
    params.push(status);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Nenhum campo para atualizar' 
    });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(serverId);

  db.run(
    `UPDATE servers SET ${updateFields.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Servidor não encontrado' 
        });
      }

      res.json({
        success: true,
        message: 'Servidor atualizado com sucesso'
      });
    }
  );
});

// Deletar servidor
router.delete('/:id', authenticateToken, (req, res) => {
  const { role } = req.user;
  const serverId = req.params.id;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode deletar servidores' 
    });
  }

  db.run(
    "DELETE FROM servers WHERE id = ?",
    [serverId],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Servidor não encontrado' 
        });
      }

      res.json({
        success: true,
        message: 'Servidor deletado com sucesso'
      });
    }
  );
});

// Testar conexão com servidor
router.post('/:id/test', authenticateToken, (req, res) => {
  const { role } = req.user;
  const serverId = req.params.id;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode testar servidores' 
    });
  }

  db.get(
    "SELECT * FROM servers WHERE id = ?",
    [serverId],
    (err, server) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!server) {
        return res.status(404).json({ 
          success: false, 
          message: 'Servidor não encontrado' 
        });
      }

      testServerConnection(server)
        .then((result) => {
          res.json({
            success: true,
            message: 'Conexão testada com sucesso',
            result
          });
        })
        .catch((error) => {
          res.status(500).json({
            success: false,
            message: 'Falha na conexão',
            error: error.message
          });
        });
    }
  );
});

// Monitorar recursos do servidor
router.get('/:id/resources', authenticateToken, (req, res) => {
  const { role } = req.user;
  const serverId = req.params.id;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para monitorar recursos' 
    });
  }

  db.get(
    "SELECT * FROM servers WHERE id = ?",
    [serverId],
    (err, server) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!server) {
        return res.status(404).json({ 
          success: false, 
          message: 'Servidor não encontrado' 
        });
      }

      getServerResources(server)
        .then((resources) => {
          res.json({
            success: true,
            resources
          });
        })
        .catch((error) => {
          res.status(500).json({
            success: false,
            message: 'Erro ao obter recursos',
            error: error.message
          });
        });
    }
  );
});

// Executar comando no servidor
router.post('/:id/command', authenticateToken, [
  body('command').notEmpty().withMessage('Comando é obrigatório')
], (req, res) => {
  const { role } = req.user;
  const serverId = req.params.id;
  const { command } = req.body;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode executar comandos' 
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  db.get(
    "SELECT * FROM servers WHERE id = ?",
    [serverId],
    (err, server) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!server) {
        return res.status(404).json({ 
          success: false, 
          message: 'Servidor não encontrado' 
        });
      }

      executeCommand(server, command)
        .then((result) => {
          res.json({
            success: true,
            result
          });
        })
        .catch((error) => {
          res.status(500).json({
            success: false,
            message: 'Erro ao executar comando',
            error: error.message
          });
        });
    }
  );
});

// Funções auxiliares
async function installAgent(ip, port, username, password, serverId) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      // Criar diretório e enviar arquivos do agente
      const commands = [
        'mkdir -p /root/painelssjf',
        'cd /root/painelssjf'
      ];

      conn.exec(commands.join(' && '), (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        stream.on('close', () => {
          conn.end();
          resolve();
        });

        stream.stderr.on('data', (data) => {
          console.error('Erro SSH:', data.toString());
        });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host: ip,
      port: port,
      username: username,
      password: password
    });
  });
}

async function testServerConnection(server) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      conn.exec('echo "Conexão SSH funcionando"', (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.on('close', () => {
          conn.end();
          resolve({ status: 'success', output });
        });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host: server.ip,
      port: server.port,
      username: server.username,
      password: server.password
    });
  });
}

async function getServerResources(server) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      const commands = [
        'echo "CPU:" && top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d\'%\' -f1',
        'echo "MEM:" && free | grep Mem | awk \'{printf "%.1f", $3/$2 * 100.0}\'',
        'echo "DISK:" && df -h / | awk \'NR==2{printf "%s", $5}\' | cut -d\'%\' -f1'
      ].join(' && ');

      conn.exec(commands, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.on('close', () => {
          conn.end();
          const lines = output.trim().split('\n');
          resolve({
            cpu: parseFloat(lines[0]) || 0,
            memory: parseFloat(lines[1]) || 0,
            disk: parseFloat(lines[2]) || 0
          });
        });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host: server.ip,
      port: server.port,
      username: server.username,
      password: server.password
    });
  });
}

async function executeCommand(server, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        let output = '';
        let error = '';

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          error += data.toString();
        });

        stream.on('close', (code) => {
          conn.end();
          resolve({
            output,
            error,
            exitCode: code
          });
        });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host: server.ip,
      port: server.port,
      username: server.username,
      password: server.password
    });
  });
}

module.exports = router;
