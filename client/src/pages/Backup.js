import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './Backup.css';

const Backup = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configData, setConfigData] = useState({
    bot_token: '',
    chat_id: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchBackups();
    if (user?.role === 'admin') {
      fetchConfig();
    }
  }, [user]);

  const fetchBackups = async () => {
    try {
      const response = await axios.get('/api/backup/list');
      if (response.data.success) {
        setBackups(response.data.backups);
      }
    } catch (error) {
      toast.error('Erro ao carregar backups');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/backup/telegram-config');
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
      await axios.post('/api/backup/telegram-config', configData);
      toast.success('Configurações do Telegram salvas com sucesso!');
      setShowConfigModal(false);
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
  };

  const createBackup = async () => {
    try {
      const response = await axios.post('/api/backup/create');
      if (response.data.success) {
        toast.success('Backup criado com sucesso!');
        fetchBackups();
      }
    } catch (error) {
      toast.error('Erro ao criar backup');
    }
  };

  const restoreBackup = async (backupFile) => {
    if (!window.confirm('Tem certeza que deseja restaurar este backup? Esta ação irá substituir todos os dados atuais.')) {
      return;
    }

    try {
      await axios.post('/api/backup/restore', { backup_file: backupFile });
      toast.success('Backup restaurado com sucesso!');
      fetchBackups();
    } catch (error) {
      toast.error('Erro ao restaurar backup');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="backup-loading">
        <div className="loading-spinner"></div>
        <p>Carregando backups...</p>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="backup">
        <div className="access-denied">
          <h1>🚫 Acesso Negado</h1>
          <p>Apenas administradores podem gerenciar backups.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backup">
      <div className="backup-header">
        <h1>💾 Gerenciar Backups</h1>
        <div className="backup-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowConfigModal(true)}
          >
            ⚙️ Configurar Telegram
          </button>
          <button 
            className="btn btn-primary"
            onClick={createBackup}
          >
            🔄 Criar Backup
          </button>
        </div>
      </div>

      <div className="backup-content">
        <div className="backup-info">
          <div className="info-card">
            <h3>📊 Informações do Sistema</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Backup Automático:</span>
                <span className="value">A cada 8 horas</span>
              </div>
              <div className="info-item">
                <span className="label">Último Backup:</span>
                <span className="value">
                  {backups.length > 0 
                    ? new Date(backups[0].created_at).toLocaleString('pt-BR')
                    : 'Nenhum backup encontrado'
                  }
                </span>
              </div>
              <div className="info-item">
                <span className="label">Total de Backups:</span>
                <span className="value">{backups.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="backups-list">
          <h3>📁 Lista de Backups</h3>
          <div className="card">
            {backups.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum backup encontrado</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Arquivo</th>
                      <th>Tamanho</th>
                      <th>Criado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <tr key={backup.filename}>
                        <td>{backup.filename}</td>
                        <td>{formatFileSize(backup.size)}</td>
                        <td>{new Date(backup.created_at).toLocaleString('pt-BR')}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => restoreBackup(backup.filename)}
                              title="Restaurar Backup"
                            >
                              🔄
                            </button>
                            <button 
                              className="btn btn-sm btn-info"
                              onClick={() => window.open(`/api/backup/download/${backup.filename}`, '_blank')}
                              title="Download"
                            >
                              📥
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de configuração */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configurar Telegram Bot</h3>
              <button 
                className="modal-close"
                onClick={() => setShowConfigModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleConfigSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Bot Token</label>
                <input
                  type="text"
                  className="form-control"
                  value={configData.bot_token}
                  onChange={(e) => setConfigData({...configData, bot_token: e.target.value})}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Chat ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={configData.chat_id}
                  onChange={(e) => setConfigData({...configData, chat_id: e.target.value})}
                  placeholder="123456789"
                  required
                />
              </div>
              
              <div className="alert alert-info">
                <strong>ℹ️ Informação:</strong> 
                <ul>
                  <li>Crie um bot no @BotFather do Telegram</li>
                  <li>Obtenha o token do bot</li>
                  <li>Envie uma mensagem para o bot e obtenha o Chat ID</li>
                </ul>
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

export default Backup;
