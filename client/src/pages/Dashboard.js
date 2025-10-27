import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    online_users: 0,
    total_ssh_access: 0,
    total_users: 0
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/monitor/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Bem-vindo, {user?.username}! ({getRoleLabel(user?.role)})</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.total_users}</h3>
            <p>Total de Usuários</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔐</div>
          <div className="stat-content">
            <h3>{stats.total_ssh_access}</h3>
            <p>Acessos SSH</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <h3>{stats.online_users}</h3>
            <p>Usuários Online</p>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="stat-card">
            <div className="stat-icon">🖥️</div>
            <div className="stat-content">
              <h3>-</h3>
              <p>Servidores</p>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-content">
        <div className="content-grid">
          <div className="content-card">
            <h3>📊 Resumo do Sistema</h3>
            <div className="summary">
              <div className="summary-item">
                <span className="label">Sistema:</span>
                <span className="value">Painel SSH v1.0</span>
              </div>
              <div className="summary-item">
                <span className="label">Status:</span>
                <span className="value status-active">Ativo</span>
              </div>
              <div className="summary-item">
                <span className="label">Última atualização:</span>
                <span className="value">{new Date().toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>

          <div className="content-card">
            <h3>🚀 Ações Rápidas</h3>
            <div className="quick-actions">
              {user?.role !== 'cliente' && (
                <button className="action-btn">
                  ➕ Criar Usuário
                </button>
              )}
              <button className="action-btn">
                🔐 Gerenciar SSH
              </button>
              {user?.role === 'admin' && (
                <button className="action-btn">
                  🖥️ Adicionar Servidor
                </button>
              )}
              <button className="action-btn">
                💳 Ver Pagamentos
              </button>
            </div>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="admin-panel">
            <h3>⚙️ Painel Administrativo</h3>
            <div className="admin-actions">
              <button className="admin-btn">
                🔧 Configurações
              </button>
              <button className="admin-btn">
                💾 Backup
              </button>
              <button className="admin-btn">
                📈 Monitor
              </button>
              <button className="admin-btn">
                🔐 Segurança
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
