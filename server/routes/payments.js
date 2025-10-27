const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');
const mercadopago = require('mercadopago');

const router = express.Router();

// Configurar Mercado Pago
mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});

// Listar pagamentos
router.get('/', authenticateToken, (req, res) => {
  const { id: userId, role } = req.user;
  let query = `
    SELECT p.*, u.username, u.email, sa.username as ssh_username
    FROM payments p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN ssh_access sa ON p.ssh_access_id = sa.id
    WHERE 1=1
  `;
  let params = [];

  // Filtros baseados no role
  if (role === 'cliente') {
    query += " AND p.user_id = ?";
    params.push(userId);
  } else if (role === 'sub_revenda') {
    query += " AND (p.user_id = ? OR u.parent_id = ?)";
    params.push(userId, userId);
  } else if (role === 'revenda') {
    query += " AND (p.user_id = ? OR u.parent_id = ?)";
    params.push(userId, userId);
  }

  query += " ORDER BY p.created_at DESC";

  db.all(query, params, (err, payments) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      payments
    });
  });
});

// Criar preferência de pagamento
router.post('/preference', authenticateToken, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valor deve ser maior que 0'),
  body('description').notEmpty().withMessage('Descrição é obrigatória'),
  body('ssh_access_id').optional().isInt().withMessage('ID do acesso SSH inválido')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { amount, description, ssh_access_id } = req.body;
  const { id: userId } = req.user;

  // Criar registro de pagamento
  db.run(
    "INSERT INTO payments (user_id, ssh_access_id, amount, payment_method, status) VALUES (?, ?, ?, 'mercadopago', 'pending')",
    [userId, ssh_access_id, amount],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      const paymentId = this.lastID;

      // Criar preferência no Mercado Pago
      const preference = {
        items: [
          {
            title: description,
            quantity: 1,
            unit_price: parseFloat(amount)
          }
        ],
        payer: {
          email: req.user.email || 'cliente@painelssh.com'
        },
        external_reference: paymentId.toString(),
        notification_url: `${process.env.BASE_URL || 'http://localhost:3001'}/api/payments/webhook`,
        back_urls: {
          success: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
          failure: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failure`,
          pending: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/pending`
        },
        auto_return: 'approved'
      };

      mercadopago.preferences.create(preference)
        .then((response) => {
          // Atualizar payment_id
          db.run(
            "UPDATE payments SET payment_id = ? WHERE id = ?",
            [response.body.id, paymentId],
            (err) => {
              if (err) {
                console.error('Erro ao atualizar payment_id:', err);
              }
            }
          );

          res.json({
            success: true,
            preference_id: response.body.id,
            init_point: response.body.init_point,
            sandbox_init_point: response.body.sandbox_init_point
          });
        })
        .catch((error) => {
          console.error('Erro ao criar preferência:', error);
          res.status(500).json({
            success: false,
            message: 'Erro ao criar preferência de pagamento'
          });
        });
    }
  );
});

// Webhook do Mercado Pago
router.post('/webhook', (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const paymentId = data.id;

    mercadopago.payment.findById(paymentId)
      .then((response) => {
        const payment = response.body;
        const externalReference = payment.external_reference;

        if (externalReference) {
          const status = payment.status === 'approved' ? 'approved' : 
                        payment.status === 'rejected' ? 'rejected' : 'pending';

          db.run(
            "UPDATE payments SET status = ? WHERE id = ?",
            [status, externalReference],
            function(err) {
              if (err) {
                console.error('Erro ao atualizar status do pagamento:', err);
              } else if (status === 'approved') {
                // Processar pagamento aprovado
                processApprovedPayment(externalReference);
              }
            }
          );
        }

        res.status(200).send('OK');
      })
      .catch((error) => {
        console.error('Erro ao processar webhook:', error);
        res.status(500).send('Error');
      });
  } else {
    res.status(200).send('OK');
  }
});

// Verificar status do pagamento
router.get('/:id/status', authenticateToken, (req, res) => {
  const { id: paymentId } = req.params;
  const { id: userId, role } = req.user;

  let query = "SELECT * FROM payments WHERE id = ?";
  let params = [paymentId];

  if (role === 'cliente') {
    query += " AND user_id = ?";
    params.push(userId);
  }

  db.get(query, params, (err, payment) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pagamento não encontrado' 
      });
    }

    res.json({
      success: true,
      payment
    });
  });
});

// Configurar credenciais do Mercado Pago (apenas admin)
router.post('/config', authenticateToken, [
  body('access_token').notEmpty().withMessage('Access Token é obrigatório'),
  body('public_key').notEmpty().withMessage('Public Key é obrigatório')
], (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode configurar credenciais' 
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

  const { access_token, public_key } = req.body;

  // Salvar configurações
  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ['mercadopago_access_token', access_token],
    (err) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      db.run(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ['mercadopago_public_key', public_key],
        (err) => {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Erro interno do servidor' 
            });
          }

          res.json({
            success: true,
            message: 'Credenciais do Mercado Pago configuradas com sucesso'
          });
        }
      );
    }
  );
});

// Obter configurações do Mercado Pago
router.get('/config', authenticateToken, (req, res) => {
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Apenas admin pode ver configurações' 
    });
  }

  db.all(
    "SELECT key, value FROM settings WHERE key LIKE 'mercadopago_%'",
    (err, settings) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor' 
        });
      }

      const config = {};
      settings.forEach(setting => {
        config[setting.key.replace('mercadopago_', '')] = setting.value;
      });

      res.json({
        success: true,
        config
      });
    }
  );
});

// Função para processar pagamento aprovado
function processApprovedPayment(paymentId) {
  db.get(
    "SELECT * FROM payments WHERE id = ? AND status = 'approved'",
    [paymentId],
    (err, payment) => {
      if (err || !payment) {
        console.error('Erro ao buscar pagamento aprovado:', err);
        return;
      }

      if (payment.ssh_access_id) {
        // Renovar acesso SSH por 30 dias
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);

        db.run(
          "UPDATE ssh_access SET expires_at = ?, status = 'ativo', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [newExpiry.toISOString(), payment.ssh_access_id],
          (err) => {
            if (err) {
              console.error('Erro ao renovar acesso SSH:', err);
            } else {
              console.log(`Acesso SSH ${payment.ssh_access_id} renovado por 30 dias`);
            }
          }
        );
      }
    }
  );
}

module.exports = router;
