const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/database');

const router = express.Router();

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de acesso necessário' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'painelssh_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Login
router.post('/login', [
  body('username').notEmpty().withMessage('Username é obrigatório'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ? AND status = 'ativo'",
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Credenciais inválidas' 
        });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ 
          success: false, 
          message: 'Credenciais inválidas' 
        });
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          parent_id: user.parent_id 
        },
        process.env.JWT_SECRET || 'painelssh_secret',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          parent_id: user.parent_id
        }
      });
    }
  );
});

// Registrar novo usuário (apenas admin e revenda podem criar)
router.post('/register', authenticateToken, [
  body('username').notEmpty().withMessage('Username é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('role').isIn(['revenda', 'sub_revenda', 'cliente']).withMessage('Role inválida')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { username, email, password, role } = req.body;
  const { role: userRole, id: userId } = req.user;

  // Verificar permissões
  if (userRole === 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Sem permissão para criar usuários' 
    });
  }

  if (userRole === 'sub_revenda' && role !== 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Sub-revenda só pode criar clientes' 
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const parentId = userRole === 'admin' ? null : userId;

  db.run(
    "INSERT INTO users (username, email, password, role, parent_id) VALUES (?, ?, ?, ?, ?)",
    [username, email, hashedPassword, role, parentId],
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

      res.json({
        success: true,
        message: 'Usuário criado com sucesso',
        userId: this.lastID
      });
    }
  );
});

// Verificar token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Logout (opcional - token será invalidado no frontend)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
});

module.exports = { router, authenticateToken };
