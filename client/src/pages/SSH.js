import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './SSH.css';

const SSH = () => {
  const [accesses, setAccesses] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    server_id: '',
    user_id: '',
    expires_at: '',
    max_connections: 1
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accessResponse, serversResponse] = await Promise.all([
        axios.get('/api/ssh'),
        user?.role === 'admin' ? axios.get('/api/servers') : Promise.resolve({ data: { servers: [] } })
      ]);
      
      if (accessResponse.data.success) {
        setAccesses(accessResponse.data.accesses);
      }
      
      if (serversResponse.data.success) {
        setServers(serversResponse.data.servers);
      }
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post('/api/ssh', formData);
      toast.success('Acesso SSH criado com sucesso!');
      setShowModal(false);
      setFormData({ username: '', password: '', server_id: '', user_id: '', expires_at: '', max_connections: 1 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao criar acesso SSH');
    }
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await axios.post('/api/ssh/test', {
        server_id: formData.server_id
      });
      
      if (response.data.success) {
        toast.success('Teste SSH criado com sucesso!');
        toast.info(`Credenciais: ${response.data.test.username} / ${response.data.test.password}`);
        setShowTestModal(false);
        setFormData({ server_id: '' });
      }
    } catch (error) {
      toast.error('Erro ao criar teste SSH');
    }
  };

  const handleRenew = async (accessId, days = 30) => {
    try {
      await axios.put(`/api/ssh/${accessId}/renew`, { days });
      toast.success('Acesso SSH renovado com sucesso!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao renovar acesso SSH');
    }
  };

  const handleSuspend = async (accessId) => {
    try {
      await axios.put(`/api/ssh/${accessId}/suspend`);
      toast.success('Acesso SSH suspenso com sucesso!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao suspender acesso SSH');
    }
  };

  const handleActivate = async (accessId) => {
    try {
      await axios.put(`/api/ssh/${accessId}/activate`);
      toast.success('Acesso SSH reativado com sucesso!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao reativar acesso SSH');
    }
  };

  const handleDelete = async (accessId) => {
    if (!window.confirm('Tem certeza que deseja deletar este acesso SSH?')) {
      return;
    }

    try {
      await axios.delete(`/api/ssh/${accessId}`);
      toast.success('Acesso SSH deletado com sucesso!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao deletar acesso SSH');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      ativo: { class: 'status-active', text: 'Ativo' },
      suspenso: { class: 'status-suspended', text: 'Suspenso' },
      expirado: { class: 'status-expired', text: 'Expirado' }
    };
    return badges[status] || { class: 'status-unknown', text: status };
  };

  const isExpired = (expiresAt) => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="ssh-loading">
        <div className="loading-spinner"></div>
        <p>Carregando acessos SSH...</p>
      </div>
    );
  }

  return (
    <div className="ssh">
      <div className="ssh-header">
        <h1>🔐 Gerenciar Acessos SSH</h1>
        <div className="ssh-actions">
          {user?.role !== 'cliente' && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
            >
              ➕ Novo Acesso
            </button>
          )}
          <button 
            className="btn btn-success"
            onClick={() => setShowTestModal(true)}
          >
            🧪 Teste SSH (2h)
          </button>
        </div>
      </div>

      <div className="ssh-content">
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Servidor</th>
                  <th>Usuário</th>
                  <th>Expira em</th>
                  <th>Status</th>
                  <th>Conexões</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {accesses.map((access) => (
                  <tr key={access.id}>
                    <td>{access.username}</td>
                    <td>{access.server_name} ({access.server_ip})</td>
                    <td>{access.user_username}</td>
                    <td>
                      <span className={isExpired(access.expires_at) ? 'text-danger' : ''}>
                        {new Date(access.expires_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(access.status).class}`}>
                        {getStatusBadge(access.status).text}
                      </span>
                    </td>
                    <td>{access.current_connections}/{access.max_connections}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => handleRenew(access.id)}
                          title="Renovar 30 dias"
                        >
                          🔄
                        </button>
                        {access.status === 'ativo' ? (
                          <button 
                            className="btn btn-sm btn-warning"
                            onClick={() => handleSuspend(access.id)}
                            title="Suspender"
                          >
                            ⏸️
                          </button>
                        ) : (
                          <button 
                            className="btn btn-sm btn-success"
                            onClick={() => handleActivate(access.id)}
                            title="Reativar"
                          >
                            ▶️
                          </button>
                        )}
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(access.id)}
                          title="Deletar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de criação */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Acesso SSH</h3>
              <button 
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Username SSH</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Senha</label>
                <input
                  type="password"
                  className="form-control"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Servidor</label>
                <select
                  className="form-control"
                  value={formData.server_id}
                  onChange={(e) => setFormData({...formData, server_id: e.target.value})}
                  required
                >
                  <option value="">Selecione um servidor</option>
                  {servers.map(server => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.ip})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Expira em</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Limite de Conexões</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.max_connections}
                  onChange={(e) => setFormData({...formData, max_connections: parseInt(e.target.value)})}
                  min="1"
                  required
                />
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de teste */}
      {showTestModal && (
        <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Teste SSH (2 horas)</h3>
              <button 
                className="modal-close"
                onClick={() => setShowTestModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleTestSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Servidor</label>
                <select
                  className="form-control"
                  value={formData.server_id}
                  onChange={(e) => setFormData({...formData, server_id: e.target.value})}
                  required
                >
                  <option value="">Selecione um servidor</option>
                  {servers.map(server => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.ip})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="alert alert-info">
                <strong>ℹ️ Informação:</strong> O teste SSH será válido por 2 horas e será excluído automaticamente após o período.
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowTestModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success">
                  Criar Teste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SSH;
