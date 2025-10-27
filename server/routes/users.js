const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Listar usuários (com filtros por role e hierarquia)
router.get('/', authenticateToken, (req, res) => {
  const { role, id, parent_id } = req.user;
  let query = "SELECT id, username, email, role, status, created_at FROM users WHERE 1=1";
  let params = [];

  // Filtros baseados no role do usuário
  if (role === 'admin') {
    // Admin vê todos
  } else if (role === 'revenda') {
    query += " AND (parent_id = ? OR id = ?)";
    params.push(id, id);
  } else if (role === 'sub_revenda') {
    query += " AND (parent_id = ? OR id = ?)";
    params.push(id, id);
  } else {
    // Cliente só vê a si mesmo
    query += " AND id = ?";
    params.push(id);
  }

  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      users
    });
  });
});

// Obter usuário específico
router.get('/:id', authenticateToken, (req, res) => {
  const { id: userId, role } = req.user;
  const targetId = req.params.id;

  // Verificar permissões
  if (role === 'cliente' && userId != targetId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para acessar este usuário' 
    });
  }

  db.get(
    "SELECT id, username, email, role, status, created_at FROM users WHERE id = ?",
    [targetId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuário não encontrado' 
        });
      }

      res.json({
        success: true,
        user
      });
    }
  );
});

// Atualizar usuário
router.put('/:id', authenticateToken, [
  body('username').optional().notEmpty().withMessage('Username não pode estar vazio'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('status').optional().isIn(['ativo', 'suspenso', 'expirado']).withMessage('Status inválido')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id: userId, role } = req.user;
  const targetId = req.params.id;
  const { username, email, status } = req.body;

  // Verificar permissões
  if (role === 'cliente' && userId != targetId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para editar este usuário' 
    });
  }

  let updateFields = [];
  let params = [];

  if (username) {
    updateFields.push('username = ?');
    params.push(username);
  }
  if (email) {
    updateFields.push('email = ?');
    params.push(email);
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
  params.push(targetId);

  db.run(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ 
            success: false, 
            message: 'Username ou email já existe' 
          });
        }
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuário não encontrado' 
        });
      }

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso'
      });
    }
  );
});

// Alterar senha
router.put('/:id/password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Senha atual é obrigatória'),
  body('newPassword').isLength({ min: 6 }).withMessage('Nova senha deve ter pelo menos 6 caracteres')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id: userId, role } = req.user;
  const targetId = req.params.id;
  const { currentPassword, newPassword } = req.body;

  // Verificar permissões
  if (role === 'cliente' && userId != targetId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para alterar senha deste usuário' 
    });
  }

  // Verificar senha atual
  db.get(
    "SELECT password FROM users WHERE id = ?",
    [targetId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuário não encontrado' 
        });
      }

      if (!bcrypt.compareSync(currentPassword, user.password)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Senha atual incorreta' 
        });
      }

      // Atualizar senha
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      db.run(
        "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [hashedPassword, targetId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Erro interno do servidor' 
            });
          }

          res.json({
            success: true,
            message: 'Senha alterada com sucesso'
          });
        }
      );
    }
  );
});

// Deletar usuário
router.delete('/:id', authenticateToken, (req, res) => {
  const { id: userId, role } = req.user;
  const targetId = req.params.id;

  // Verificar permissões
  if (role === 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para deletar usuários' 
    });
  }

  if (role === 'sub_revenda') {
    // Sub-revenda só pode deletar seus próprios clientes
    db.get(
      "SELECT parent_id FROM users WHERE id = ?",
      [targetId],
      (err, user) => {
        if (err || !user || user.parent_id !== userId) {
          return res.status(403).json({ 
            success: false, 
            message: 'Sem permissão para deletar este usuário' 
          });
        }
        deleteUser();
      }
    );
  } else {
    deleteUser();
  }

  function deleteUser() {
    db.run(
      "DELETE FROM users WHERE id = ?",
      [targetId],
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
            message: 'Usuário não encontrado' 
          });
        }

        res.json({
          success: true,
          message: 'Usuário deletado com sucesso'
        });
      }
    );
  }
});

module.exports = router;
