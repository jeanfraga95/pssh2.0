import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './Monitor.css';

const Monitor = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    online_users: 0,
    total_ssh_access: 0,
    total_users: 0
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
    // Atualizar dados a cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsResponse, statsResponse] = await Promise.all([
        axios.get('/api/monitor/online'),
        axios.get('/api/monitor/stats')
      ]);
      
      if (sessionsResponse.data.success) {
        setSessions(sessionsResponse.data.sessions);
      }
      
      if (statsResponse.data.success) {
        setStats(statsResponse.data.stats);
      }
    } catch (error) {
      toast.error('Erro ao carregar dados de monitoramento');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (sessionId) => {
    if (!window.confirm('Tem certeza que deseja desconectar esta sessão?')) {
      return;
    }

    try {
      await axios.post(`/api/monitor/disconnect/${sessionId}`);
      toast.success('Sessão desconectada com sucesso!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao desconectar sessão');
    }
  };

  const formatDuration = (connectedAt) => {
    const now = new Date();
    const connected = new Date(connectedAt);
    const diff = now - connected;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="monitor-loading">
        <div className="loading-spinner"></div>
        <p>Carregando monitoramento...</p>
      </div>
    );
  }

  return (
    <div className="monitor">
      <div className="monitor-header">
        <h1>📈 Monitor do Sistema</h1>
        <button 
          className="btn btn-primary"
          onClick={fetchData}
        >
          🔄 Atualizar
        </button>
      </div>

      <div className="monitor-content">
        {/* Estatísticas gerais */}
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

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{sessions.length}</h3>
              <p>Sessões Ativas</p>
            </div>
          </div>
        </div>

        {/* Sessões online */}
        <div className="sessions-section">
          <h3>🟢 Sessões Online</h3>
          <div className="card">
            {sessions.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma sessão ativa no momento</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Username SSH</th>
                      <th>Servidor</th>
                      <th>IP de Origem</th>
                      <th>Conectado há</th>
                      <th>Usuário</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <span className="username-badge">
                            {session.username}
                          </span>
                        </td>
                        <td>
                          <span className="server-info">
                            {session.server_name}
                            <br />
                            <small>{session.server_ip}</small>
                          </span>
                        </td>
                        <td>
                          <span className="ip-address">
                            {session.ip_address}
                          </span>
                        </td>
                        <td>
                          <span className="duration">
                            {formatDuration(session.connected_at)}
                          </span>
                        </td>
                        <td>
                          <span className="user-info">
                            {session.user_username}
                            <br />
                            <small>{session.user_email}</small>
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDisconnect(session.id)}
                            title="Desconectar Sessão"
                          >
                            🔌
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Informações do sistema */}
        <div className="system-info">
          <h3>ℹ️ Informações do Sistema</h3>
          <div className="info-grid">
            <div className="info-card">
              <h4>🔄 Atualização Automática</h4>
              <p>Os dados são atualizados automaticamente a cada 30 segundos</p>
            </div>
            
            <div className="info-card">
              <h4>📊 Estatísticas</h4>
              <p>Monitoramento em tempo real de usuários e sessões</p>
            </div>
            
            <div className="info-card">
              <h4>🔌 Controle de Sessões</h4>
              <p>Desconecte sessões ativas quando necessário</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitor;
