import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './Users.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'cliente',
    parent_id: null
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Atualizar usuário
        await axios.put(`/api/users/${editingUser.id}`, formData);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        // Criar usuário
        await axios.post('/api/auth/register', formData);
        toast.success('Usuário criado com sucesso!');
      }
      
      setShowModal(false);
      setEditingUser(null);
      setFormData({ username: '', email: '', password: '', role: 'cliente', parent_id: null });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao salvar usuário');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      parent_id: user.parent_id
    });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário?')) {
      return;
    }

    try {
      await axios.delete(`/api/users/${userId}`);
      toast.success('Usuário deletado com sucesso!');
      fetchUsers();
    } catch (error) {
      toast.error('Erro ao deletar usuário');
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      revenda: 'Revenda',
      sub_revenda: 'Sub-revenda',
      cliente: 'Cliente'
    };
    return labels[role] || role;
  };

  const getStatusBadge = (status) => {
    const badges = {
      ativo: { class: 'status-active', text: 'Ativo' },
      suspenso: { class: 'status-suspended', text: 'Suspenso' },
      expirado: { class: 'status-expired', text: 'Expirado' }
    };
    return badges[status] || { class: 'status-unknown', text: status };
  };

  if (loading) {
    return (
      <div className="users-loading">
        <div className="loading-spinner"></div>
        <p>Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div className="users">
      <div className="users-header">
        <h1>👥 Gerenciar Usuários</h1>
        {user?.role !== 'cliente' && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            ➕ Novo Usuário
          </button>
        )}
      </div>

      <div className="users-content">
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((userItem) => (
                  <tr key={userItem.id}>
                    <td>{userItem.username}</td>
                    <td>{userItem.email}</td>
                    <td>
                      <span className="role-badge role-{userItem.role}">
                        {getRoleLabel(userItem.role)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(userItem.status).class}`}>
                        {getStatusBadge(userItem.status).text}
                      </span>
                    </td>
                    <td>{new Date(userItem.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleEdit(userItem)}
                        >
                          ✏️
                        </button>
                        {user?.role === 'admin' && userItem.role !== 'admin' && (
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(userItem.id)}
                          >
                            🗑️
                          </button>
                        )}
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
              <h3>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Senha {editingUser && '(deixe em branco para manter)'}</label>
                <input
                  type="password"
                  className="form-control"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required={!editingUser}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-control"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  required
                >
                  <option value="cliente">Cliente</option>
                  {user?.role === 'admin' && <option value="revenda">Revenda</option>}
                  {user?.role === 'admin' && <option value="sub_revenda">Sub-revenda</option>}
                </select>
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
                  {editingUser ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
