const express = require('express');
const { authenticateToken } = require('./auth');
const { db } = require('../database/database');
const axios = require('axios');

const router = express.Router();

// Listar usuários online
router.get('/online', authenticateToken, (req, res) => {
  const { id: userId, role } = req.user;

  let query = `
    SELECT os.*, sa.username, sa.password, s.name as server_name, s.ip as server_ip,
           u.username as user_username, u.email as user_email
    FROM online_sessions os
    JOIN ssh_access sa ON os.ssh_access_id = sa.id
    JOIN servers s ON sa.server_id = s.id
    JOIN users u ON sa.user_id = u.id
    WHERE 1=1
  `;
  let params = [];

  // Filtros baseados no role
  if (role === 'cliente') {
    query += " AND sa.user_id = ?";
    params.push(userId);
  } else if (role === 'sub_revenda') {
    query += " AND (sa.created_by = ? OR u.parent_id = ?)";
    params.push(userId, userId);
  } else if (role === 'revenda') {
    query += " AND (sa.created_by = ? OR u.parent_id = ?)";
    params.push(userId, userId);
  }

  query += " ORDER BY os.connected_at DESC";

  db.all(query, params, (err, sessions) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      sessions
    });
  });
});

// Obter estatísticas gerais
router.get('/stats', authenticateToken, (req, res) => {
  const { id: userId, role } = req.user;

  // Contar usuários online
  let onlineQuery = "SELECT COUNT(*) as count FROM online_sessions";
  let onlineParams = [];

  if (role === 'cliente') {
    onlineQuery = `
      SELECT COUNT(*) as count FROM online_sessions os
      JOIN ssh_access sa ON os.ssh_access_id = sa.id
      WHERE sa.user_id = ?
    `;
    onlineParams = [userId];
  } else if (role === 'sub_revenda') {
    onlineQuery = `
      SELECT COUNT(*) as count FROM online_sessions os
      JOIN ssh_access sa ON os.ssh_access_id = sa.id
      JOIN users u ON sa.user_id = u.id
      WHERE sa.created_by = ? OR u.parent_id = ?
    `;
    onlineParams = [userId, userId];
  } else if (role === 'revenda') {
    onlineQuery = `
      SELECT COUNT(*) as count FROM online_sessions os
      JOIN ssh_access sa ON os.ssh_access_id = sa.id
      JOIN users u ON sa.user_id = u.id
      WHERE sa.created_by = ? OR u.parent_id = ?
    `;
    onlineParams = [userId, userId];
  }

  db.get(onlineQuery, onlineParams, (err, onlineResult) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }

    // Contar acessos SSH
    let sshQuery = "SELECT COUNT(*) as count FROM ssh_access";
    let sshParams = [];

    if (role === 'cliente') {
      sshQuery = "SELECT COUNT(*) as count FROM ssh_access WHERE user_id = ?";
      sshParams = [userId];
    } else if (role === 'sub_revenda') {
      sshQuery = `
        SELECT COUNT(*) as count FROM ssh_access sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.created_by = ? OR u.parent_id = ?
      `;
      sshParams = [userId, userId];
    } else if (role === 'revenda') {
      sshQuery = `
        SELECT COUNT(*) as count FROM ssh_access sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.created_by = ? OR u.parent_id = ?
      `;
      sshParams = [userId, userId];
    }

    db.get(sshQuery, sshParams, (err, sshResult) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      // Contar usuários
      let usersQuery = "SELECT COUNT(*) as count FROM users";
      let usersParams = [];

      if (role === 'cliente') {
        usersQuery = "SELECT COUNT(*) as count FROM users WHERE id = ?";
        usersParams = [userId];
      } else if (role === 'sub_revenda') {
        usersQuery = "SELECT COUNT(*) as count FROM users WHERE parent_id = ? OR id = ?";
        usersParams = [userId, userId];
      } else if (role === 'revenda') {
        usersQuery = "SELECT COUNT(*) as count FROM users WHERE parent_id = ? OR id = ?";
        usersParams = [userId, userId];
      }

      db.get(usersQuery, usersParams, (err, usersResult) => {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
          });
        }

        res.json({
          success: true,
          stats: {
            online_users: onlineResult.count,
            total_ssh_access: sshResult.count,
            total_users: usersResult.count
          }
        });
      });
    });
  });
});

// Desconectar sessão
router.post('/disconnect/:sessionId', authenticateToken, (req, res) => {
  const { sessionId } = req.params;
  const { id: userId, role } = req.user;

  // Verificar permissões
  db.get(
    `SELECT os.*, sa.user_id, sa.created_by, u.parent_id
     FROM online_sessions os
     JOIN ssh_access sa ON os.ssh_access_id = sa.id
     JOIN users u ON sa.user_id = u.id
     WHERE os.id = ?`,
    [sessionId],
    (err, session) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!session) {
        return res.status(404).json({ 
          success: false, 
          message: 'Sessão não encontrada' 
        });
      }

      // Verificar permissões
      if (role === 'cliente' && session.user_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para desconectar esta sessão' 
        });
      }

      if (role === 'sub_revenda' && session.created_by !== userId && session.parent_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para desconectar esta sessão' 
        });
      }

      if (role === 'revenda' && session.created_by !== userId && session.parent_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para desconectar esta sessão' 
        });
      }

      // Desconectar no servidor
      disconnectUserOnServer(session.server_id, session.username)
        .then(() => {
          // Remover da base de dados
          db.run(
            "DELETE FROM online_sessions WHERE id = ?",
            [sessionId],
            function(err) {
              if (err) {
                return res.status(500).json({ 
                  success: false, 
                  message: 'Erro interno do servidor' 
                });
              }

              res.json({
                success: true,
                message: 'Sessão desconectada com sucesso'
              });
            }
          );
        })
        .catch((error) => {
          console.error('Erro ao desconectar usuário no servidor:', error);
          res.json({
            success: true,
            message: 'Sessão desconectada, mas falha ao desconectar no servidor',
            warning: error.message
          });
        });
    }
  );
});

// Atualizar sessões online (chamado periodicamente)
router.post('/update-sessions', authenticateToken, (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode atualizar sessões' 
    });
  }

  updateOnlineSessions()
    .then(() => {
      res.json({
        success: true,
        message: 'Sessões atualizadas com sucesso'
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar sessões',
        error: error.message
      });
    });
});

// Monitorar recursos do servidor
router.get('/server-resources/:serverId', authenticateToken, (req, res) => {
  const { serverId } = req.params;
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode monitorar recursos' 
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
            message: 'Erro ao obter recursos do servidor',
            error: error.message
          });
        });
    }
  );
});

// Funções auxiliares
async function updateOnlineSessions() {
  return new Promise((resolve, reject) => {
    // Limpar sessões antigas
    db.run(
      "DELETE FROM online_sessions WHERE connected_at < datetime('now', '-1 hour')",
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Obter todos os servidores
        db.all("SELECT * FROM servers WHERE status = 'ativo'", (err, servers) => {
          if (err) {
            reject(err);
            return;
          }

          const updatePromises = servers.map(server => updateServerSessions(server));
          
          Promise.all(updatePromises)
            .then(() => {
              resolve();
            })
            .catch((error) => {
              reject(error);
            });
        });
      }
    );
  });
}

async function updateServerSessions(server) {
  try {
    const response = await axios.post(`http://${server.ip}:6969`, {
      comando: './painelssjf verificar_online'
    }, {
      headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' },
      timeout: 10000
    });

    if (response.data) {
      const onlineUsers = response.data.split('\n').filter(line => line.trim());
      
      // Limpar sessões antigas deste servidor
      db.run(
        "DELETE FROM online_sessions WHERE ssh_access_id IN (SELECT id FROM ssh_access WHERE server_id = ?)",
        [server.id]
      );

      // Adicionar novas sessões
      for (const userLine of onlineUsers) {
        const parts = userLine.split(' ');
        if (parts.length >= 2) {
          const username = parts[0];
          const ip = parts[1];

          // Encontrar acesso SSH correspondente
          db.get(
            "SELECT id FROM ssh_access WHERE username = ? AND server_id = ?",
            [username, server.id],
            (err, sshAccess) => {
              if (!err && sshAccess) {
                db.run(
                  "INSERT INTO online_sessions (ssh_access_id, ip_address) VALUES (?, ?)",
                  [sshAccess.id, ip]
                );
              }
            }
          );
        }
      }
    }
  } catch (error) {
    console.error(`Erro ao atualizar sessões do servidor ${server.name}:`, error.message);
  }
}

async function getServerResources(server) {
  return new Promise((resolve, reject) => {
    const axios = require('axios');
    
    axios.post(`http://${server.ip}:6969`, {
      comando: 'echo "CPU:" && top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d\'%\' -f1 && echo "MEM:" && free | grep Mem | awk \'{printf "%.1f", $3/$2 * 100.0}\' && echo "DISK:" && df -h / | awk \'NR==2{printf "%s", $5}\' | cut -d\'%\' -f1'
    }, {
      headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' },
      timeout: 10000
    })
    .then(response => {
      const lines = response.data.trim().split('\n');
      resolve({
        cpu: parseFloat(lines[0]) || 0,
        memory: parseFloat(lines[1]) || 0,
        disk: parseFloat(lines[2]) || 0,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      reject(error);
    });
  });
}

async function disconnectUserOnServer(serverId, username) {
  const server = await getServerById(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const response = await axios.post(`http://${server.ip}:6969`, {
    comando: `pkill -u ${username}`
  }, {
    headers: { 'Senha': '3aLhq41VVMxRiLBqjxEOCQ' }
  });

  return response.data;
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
