import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './Servers.css';

const Servers = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    port: 22,
    username: '',
    password: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await axios.get('/api/servers');
      if (response.data.success) {
        setServers(response.data.servers);
      }
    } catch (error) {
      toast.error('Erro ao carregar servidores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingServer) {
        // Atualizar servidor
        await axios.put(`/api/servers/${editingServer.id}`, formData);
        toast.success('Servidor atualizado com sucesso!');
      } else {
        // Criar servidor
        await axios.post('/api/servers', formData);
        toast.success('Servidor adicionado com sucesso!');
      }
      
      setShowModal(false);
      setEditingServer(null);
      setFormData({ name: '', ip: '', port: 22, username: '', password: '' });
      fetchServers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao salvar servidor');
    }
  };

  const handleEdit = (server) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      ip: server.ip,
      port: server.port,
      username: server.username,
      password: server.password
    });
    setShowModal(true);
  };

  const handleDelete = async (serverId) => {
    if (!window.confirm('Tem certeza que deseja deletar este servidor?')) {
      return;
    }

    try {
      await axios.delete(`/api/servers/${serverId}`);
      toast.success('Servidor deletado com sucesso!');
      fetchServers();
    } catch (error) {
      toast.error('Erro ao deletar servidor');
    }
  };

  const handleTest = async (serverId) => {
    try {
      const response = await axios.post(`/api/servers/${serverId}/test`);
      if (response.data.success) {
        toast.success('Conexão testada com sucesso!');
      } else {
        toast.error('Falha na conexão com o servidor');
      }
    } catch (error) {
      toast.error('Erro ao testar conexão');
    }
  };

  const handleResources = async (serverId) => {
    try {
      const response = await axios.get(`/api/servers/${serverId}/resources`);
      if (response.data.success) {
        const { cpu, memory, disk } = response.data.resources;
        toast.info(`Recursos: CPU ${cpu}%, RAM ${memory}%, Disco ${disk}%`);
      }
    } catch (error) {
      toast.error('Erro ao obter recursos do servidor');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      ativo: { class: 'status-active', text: 'Ativo' },
      inativo: { class: 'status-inactive', text: 'Inativo' },
      erro: { class: 'status-error', text: 'Erro' }
    };
    return badges[status] || { class: 'status-unknown', text: status };
  };

  if (loading) {
    return (
      <div className="servers-loading">
        <div className="loading-spinner"></div>
        <p>Carregando servidores...</p>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="servers">
        <div className="access-denied">
          <h1>🚫 Acesso Negado</h1>
          <p>Apenas administradores podem gerenciar servidores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="servers">
      <div className="servers-header">
        <h1>🖥️ Gerenciar Servidores</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          ➕ Adicionar Servidor
        </button>
      </div>

      <div className="servers-content">
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>IP</th>
                  <th>Porta</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => (
                  <tr key={server.id}>
                    <td>{server.name}</td>
                    <td>{server.ip}</td>
                    <td>{server.port}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(server.status).class}`}>
                        {getStatusBadge(server.status).text}
                      </span>
                    </td>
                    <td>{new Date(server.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-info"
                          onClick={() => handleTest(server.id)}
                          title="Testar Conexão"
                        >
                          🔍
                        </button>
                        <button 
                          className="btn btn-sm btn-warning"
                          onClick={() => handleResources(server.id)}
                          title="Ver Recursos"
                        >
                          📊
                        </button>
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleEdit(server)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(server.id)}
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

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingServer ? 'Editar Servidor' : 'Adicionar Servidor'}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome do Servidor</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">IP do Servidor</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.ip}
                  onChange={(e) => setFormData({...formData, ip: e.target.value})}
                  placeholder="192.168.1.100"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Porta SSH</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.port}
                  onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
                  min="1"
                  max="65535"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="root"
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
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingServer ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Servers;
