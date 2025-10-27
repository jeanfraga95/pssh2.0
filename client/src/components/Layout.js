import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/users', label: 'Usuários', icon: '👥', roles: ['admin', 'revenda', 'sub_revenda'] },
    { path: '/servers', label: 'Servidores', icon: '🖥️', roles: ['admin'] },
    { path: '/ssh', label: 'Acessos SSH', icon: '🔐' },
    { path: '/payments', label: 'Pagamentos', icon: '💳' },
    { path: '/backup', label: 'Backup', icon: '💾', roles: ['admin'] },
    { path: '/monitor', label: 'Monitor', icon: '📈' }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role);
  });

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      revenda: 'Revenda',
      sub_revenda: 'Sub-revenda',
      cliente: 'Cliente'
    };
    return labels[role] || role;
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>🔐 Painel SSH</h2>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ✕
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{getRoleLabel(user?.role)}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            🚪 Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="header">
          <button 
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <h1>Painel SSH Administrativo</h1>
        </header>
        
        <main className="content">
          {children}
        </main>
      </div>

      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
