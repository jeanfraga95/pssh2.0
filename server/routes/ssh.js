const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

// Listar acessos SSH
router.get('/', authenticateToken, (req, res) => {
  const { id: userId, role } = req.user;
  let query = `
    SELECT sa.*, s.name as server_name, s.ip as server_ip, 
           u.username as user_username, u.email as user_email
    FROM ssh_access sa
    JOIN servers s ON sa.server_id = s.id
    JOIN users u ON sa.user_id = u.id
    WHERE 1=1
  `;
  let params = [];

  // Filtros baseados no role
  if (role === 'admin') {
    // Admin vê todos
  } else if (role === 'revenda') {
    query += " AND (sa.created_by = ? OR u.parent_id = ?)";
    params.push(userId, userId);
  } else if (role === 'sub_revenda') {
    query += " AND (sa.created_by = ? OR u.parent_id = ?)";
    params.push(userId, userId);
  } else {
    // Cliente só vê seus próprios acessos
    query += " AND sa.user_id = ?";
    params.push(userId);
  }

  query += " ORDER BY sa.created_at DESC";

  db.all(query, params, (err, accesses) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      accesses
    });
  });
});

// Criar acesso SSH
router.post('/', authenticateToken, [
  body('username').notEmpty().withMessage('Username é obrigatório'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('server_id').isInt().withMessage('Servidor é obrigatório'),
  body('user_id').isInt().withMessage('Usuário é obrigatório'),
  body('expires_at').isISO8601().withMessage('Data de expiração inválida'),
  body('max_connections').optional().isInt({ min: 1 }).withMessage('Limite de conexões inválido')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { username, password, server_id, user_id, expires_at, max_connections = 1 } = req.body;
  const { id: created_by, role } = req.user;

  // Verificar permissões
  if (role === 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Clientes não podem criar acessos SSH' 
    });
  }

  // Verificar se o usuário alvo pertence à hierarquia
  if (role === 'sub_revenda') {
    db.get(
      "SELECT parent_id FROM users WHERE id = ?",
      [user_id],
      (err, user) => {
        if (err || !user || user.parent_id !== created_by) {
          return res.status(403).json({ 
            success: false, 
            message: 'Sem permissão para criar acesso para este usuário' 
          });
        }
        createSSHAccess();
      }
    );
  } else {
    createSSHAccess();
  }

  function createSSHAccess() {
    db.run(
      `INSERT INTO ssh_access 
       (username, password, server_id, user_id, created_by, expires_at, max_connections) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, password, server_id, user_id, created_by, expires_at, max_connections],
      function(err) {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
          });
        }

        const accessId = this.lastID;

        // Criar usuário no servidor
        createUserOnServer(server_id, username, password, expires_at, max_connections)
          .then(() => {
            res.json({
              success: true,
              message: 'Acesso SSH criado com sucesso',
              accessId
            });
          })
          .catch((error) => {
            console.error('Erro ao criar usuário no servidor:', error);
            res.json({
              success: true,
              message: 'Acesso SSH criado, mas falha ao criar no servidor',
              accessId,
              warning: error.message
            });
          });
      }
    );
  }
});

// Criar teste SSH (2 horas)
router.post('/test', authenticateToken, [
  body('server_id').isInt().withMessage('Servidor é obrigatório')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { server_id } = req.body;
  const { role } = req.user;

  if (role === 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Clientes não podem criar testes SSH' 
    });
  }

  // Gerar credenciais aleatórias
  const username = 'test_' + crypto.randomBytes(4).toString('hex');
  const password = crypto.randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

  db.run(
    `INSERT INTO ssh_tests (username, password, server_id, expires_at) 
     VALUES (?, ?, ?, ?)`,
    [username, password, server_id, expiresAt],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      const testId = this.lastID;

      // Criar usuário no servidor
      createUserOnServer(server_id, username, password, expiresAt, 1)
        .then(() => {
          res.json({
            success: true,
            message: 'Teste SSH criado com sucesso',
            test: {
              id: testId,
              username,
              password,
              expires_at: expiresAt,
              server_id
            }
          });
        })
        .catch((error) => {
          console.error('Erro ao criar usuário de teste no servidor:', error);
          res.json({
            success: true,
            message: 'Teste SSH criado, mas falha ao criar no servidor',
            test: {
              id: testId,
              username,
              password,
              expires_at: expiresAt,
              server_id
            },
            warning: error.message
          });
        });
    }
  );
});

// Renovar acesso SSH
router.put('/:id/renew', authenticateToken, [
  body('days').isInt({ min: 1 }).withMessage('Dias deve ser um número positivo')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id: accessId } = req.params;
  const { days } = req.body;
  const { id: userId, role } = req.user;

  // Verificar permissões
  db.get(
    "SELECT * FROM ssh_access WHERE id = ?",
    [accessId],
    (err, access) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!access) {
        return res.status(404).json({ 
          success: false, 
          message: 'Acesso SSH não encontrado' 
        });
      }

      // Verificar permissões
      if (role === 'cliente' && access.user_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para renovar este acesso' 
        });
      }

      if (role === 'sub_revenda' && access.created_by !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para renovar este acesso' 
        });
      }

      // Calcular nova data de expiração
      const currentExpiry = new Date(access.expires_at);
      const newExpiry = new Date(currentExpiry.getTime() + (days * 24 * 60 * 60 * 1000));

      db.run(
        "UPDATE ssh_access SET expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [newExpiry.toISOString(), accessId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Erro interno do servidor' 
            });
          }

          // Renovar no servidor
          renewUserOnServer(access.server_id, access.username, newExpiry)
            .then(() => {
              res.json({
                success: true,
                message: 'Acesso SSH renovado com sucesso',
                new_expires_at: newExpiry
              });
            })
            .catch((error) => {
              console.error('Erro ao renovar usuário no servidor:', error);
              res.json({
                success: true,
                message: 'Acesso SSH renovado, mas falha ao renovar no servidor',
                new_expires_at: newExpiry,
                warning: error.message
              });
            });
        }
      );
    }
  );
});

// Suspender acesso SSH
router.put('/:id/suspend', authenticateToken, (req, res) => {
  const { id: accessId } = req.params;
  const { id: userId, role } = req.user;

  db.get(
    "SELECT * FROM ssh_access WHERE id = ?",
    [accessId],
    (err, access) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!access) {
        return res.status(404).json({ 
          success: false, 
          message: 'Acesso SSH não encontrado' 
        });
      }

      // Verificar permissões
      if (role === 'cliente' && access.user_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para suspender este acesso' 
        });
      }

      if (role === 'sub_revenda' && access.created_by !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para suspender este acesso' 
        });
      }

      db.run(
        "UPDATE ssh_access SET status = 'suspenso', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [accessId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Erro interno do servidor' 
            });
          }

          // Suspender no servidor
          suspendUserOnServer(access.server_id, access.username)
            .then(() => {
              res.json({
                success: true,
                message: 'Acesso SSH suspenso com sucesso'
              });
            })
            .catch((error) => {
              console.error('Erro ao suspender usuário no servidor:', error);
              res.json({
                success: true,
                message: 'Acesso SSH suspenso, mas falha ao suspender no servidor',
                warning: error.message
              });
            });
        }
      );
    }
  );
});

// Reativar acesso SSH
router.put('/:id/activate', authenticateToken, (req, res) => {
  const { id: accessId } = req.params;
  const { id: userId, role } = req.user;

  db.get(
    "SELECT * FROM ssh_access WHERE id = ?",
    [accessId],
    (err, access) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!access) {
        return res.status(404).json({ 
          success: false, 
          message: 'Acesso SSH não encontrado' 
        });
      }

      // Verificar permissões
      if (role === 'cliente' && access.user_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para reativar este acesso' 
        });
      }

      if (role === 'sub_revenda' && access.created_by !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para reativar este acesso' 
        });
      }

      db.run(
        "UPDATE ssh_access SET status = 'ativo', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [accessId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Erro interno do servidor' 
            });
          }

          // Reativar no servidor
          activateUserOnServer(access.server_id, access.username, access.password, access.expires_at)
            .then(() => {
              res.json({
                success: true,
                message: 'Acesso SSH reativado com sucesso'
              });
            })
            .catch((error) => {
              console.error('Erro ao reativar usuário no servidor:', error);
              res.json({
                success: true,
                message: 'Acesso SSH reativado, mas falha ao reativar no servidor',
                warning: error.message
              });
            });
        }
      );
    }
  );
});

// Deletar acesso SSH
router.delete('/:id', authenticateToken, (req, res) => {
  const { id: accessId } = req.params;
  const { id: userId, role } = req.user;

  db.get(
    "SELECT * FROM ssh_access WHERE id = ?",
    [accessId],
    (err, access) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!access) {
        return res.status(404).json({ 
          success: false, 
          message: 'Acesso SSH não encontrado' 
        });
      }

      // Verificar permissões
      if (role === 'cliente' && access.user_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para deletar este acesso' 
        });
      }

      if (role === 'sub_revenda' && access.created_by !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para deletar este acesso' 
        });
      }

      db.run(
        "DELETE FROM ssh_access WHERE id = ?",
        [accessId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Erro interno do servidor' 
            });
          }

          // Deletar do servidor
          deleteUserOnServer(access.server_id, access.username)
            .then(() => {
              res.json({
                success: true,
                message: 'Acesso SSH deletado com sucesso'
              });
            })
            .catch((error) => {
              console.error('Erro ao deletar usuário no servidor:', error);
              res.json({
                success: true,
                message: 'Acesso SSH deletado, mas falha ao deletar no servidor',
                warning: error.message
              });
            });
        }
      );
    }
  );
});

// Funções auxiliares para comunicação com servidores
async function createUserOnServer(serverId, username, password, expiresAt, maxConnections) {
  const server = await getServerById(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const response = await axios.post(`http://${server.ip}:6969`, {
    comando: `./painelssjf createssh ${username} ${password} ${Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24))} ${maxConnections}`
  }, {
    headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' }
  });

  if (!response.data.includes('CRIADOCOMSUCESSO')) {
    throw new Error('Falha ao criar usuário no servidor');
  }
}

async function renewUserOnServer(serverId, username, newExpiry) {
  const server = await getServerById(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const days = Math.ceil((new Date(newExpiry) - new Date()) / (1000 * 60 * 60 * 24));
  
  const response = await axios.post(`http://${server.ip}:6969`, {
    comando: `./painelssjf timedata ${username} ${days}`
  }, {
    headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' }
  });

  if (!response.data.includes('CRIADOCOMSUCESSO')) {
    throw new Error('Falha ao renovar usuário no servidor');
  }
}

async function suspendUserOnServer(serverId, username) {
  const server = await getServerById(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const response = await axios.post(`http://${server.ip}:6969`, {
    comando: `./painelssjf removessh ${username}`
  }, {
    headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' }
  });

  if (!response.data.includes('90Cbp1PK1ExPingu')) {
    throw new Error('Falha ao suspender usuário no servidor');
  }
}

async function activateUserOnServer(serverId, username, password, expiresAt) {
  const server = await getServerById(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const days = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
  
  const response = await axios.post(`http://${server.ip}:6969`, {
    comando: `./painelssjf createssh ${username} ${password} ${days} 1`
  }, {
    headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' }
  });

  if (!response.data.includes('CRIADOCOMSUCESSO')) {
    throw new Error('Falha ao reativar usuário no servidor');
  }
}

async function deleteUserOnServer(serverId, username) {
  const server = await getServerById(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const response = await axios.post(`http://${server.ip}:6969`, {
    comando: `./painelssjf removessh ${username}`
  }, {
    headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' }
  });

  if (!response.data.includes('90Cbp1PK1ExPingu')) {
    throw new Error('Falha ao deletar usuário no servidor');
  }
}

function getServerById(serverId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM servers WHERE id = ?",
      [serverId],
      (err, server) => {
        if (err) reject(err);
        else resolve(server);
      }
    );
  });
}

module.exports = router;
