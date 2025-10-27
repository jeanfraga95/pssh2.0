import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './Payments.css';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configData, setConfigData] = useState({
    access_token: '',
    public_key: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchPayments();
    if (user?.role === 'admin') {
      fetchConfig();
    }
  }, [user]);

  const fetchPayments = async () => {
    try {
      const response = await axios.get('/api/payments');
      if (response.data.success) {
        setPayments(response.data.payments);
      }
    } catch (error) {
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/payments/config');
      if (response.data.success) {
        setConfigData(response.data.config);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações');
    }
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post('/api/payments/config', configData);
      toast.success('Configurações do Mercado Pago salvas com sucesso!');
      setShowConfigModal(false);
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
  };

  const createPayment = async (amount, description) => {
    try {
      const response = await axios.post('/api/payments/preference', {
        amount,
        description
      });
      
      if (response.data.success) {
        // Redirecionar para o Mercado Pago
        window.open(response.data.init_point, '_blank');
        toast.success('Redirecionando para pagamento...');
      }
    } catch (error) {
      toast.error('Erro ao criar pagamento');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'status-pending', text: 'Pendente' },
      approved: { class: 'status-approved', text: 'Aprovado' },
      rejected: { class: 'status-rejected', text: 'Rejeitado' },
      cancelled: { class: 'status-cancelled', text: 'Cancelado' }
    };
    return badges[status] || { class: 'status-unknown', text: status };
  };

  if (loading) {
    return (
      <div className="payments-loading">
        <div className="loading-spinner"></div>
        <p>Carregando pagamentos...</p>
      </div>
    );
  }

  return (
    <div className="payments">
      <div className="payments-header">
        <h1>💳 Gerenciar Pagamentos</h1>
        <div className="payments-actions">
          {user?.role === 'admin' && (
            <button 
              className="btn btn-secondary"
              onClick={() => setShowConfigModal(true)}
            >
              ⚙️ Configurar Mercado Pago
            </button>
          )}
          <button 
            className="btn btn-success"
            onClick={() => createPayment(30, 'Renovação SSH - 30 dias')}
          >
            💰 Pagar Renovação (R$ 30,00)
          </button>
        </div>
      </div>

      <div className="payments-content">
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuário</th>
                  <th>Valor</th>
                  <th>Método</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>#{payment.id}</td>
                    <td>{payment.username}</td>
                    <td>R$ {payment.amount.toFixed(2)}</td>
                    <td>{payment.payment_method}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(payment.status).class}`}>
                        {getStatusBadge(payment.status).text}
                      </span>
                    </td>
                    <td>{new Date(payment.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <button 
                        className="btn btn-sm btn-info"
                        onClick={() => window.open(`https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${payment.payment_id}`, '_blank')}
                        title="Ver no Mercado Pago"
                      >
                        🔍
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de configuração */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configurar Mercado Pago</h3>
              <button 
                className="modal-close"
                onClick={() => setShowConfigModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleConfigSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Access Token</label>
                <input
                  type="text"
                  className="form-control"
                  value={configData.access_token}
                  onChange={(e) => setConfigData({...configData, access_token: e.target.value})}
                  placeholder="APP_USR-..."
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Public Key</label>
                <input
                  type="text"
                  className="form-control"
                  value={configData.public_key}
                  onChange={(e) => setConfigData({...configData, public_key: e.target.value})}
                  placeholder="APP_USR-..."
                  required
                />
              </div>
              
              <div className="alert alert-info">
                <strong>ℹ️ Informação:</strong> Obtenha suas credenciais no painel do Mercado Pago.
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowConfigModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Configurações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
