const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'painelssh.db');
const db = new sqlite3.Database(dbPath);

// Inicializar banco de dados
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabela de usuários (admin, revenda, sub-revenda, cliente)
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'revenda', 'sub_revenda', 'cliente')),
          parent_id INTEGER,
          status TEXT DEFAULT 'ativo' CHECK(status IN ('ativo', 'suspenso', 'expirado')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES users (id)
        )
      `);

      // Tabela de servidores VPS
      db.run(`
        CREATE TABLE IF NOT EXISTS servers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          ip TEXT NOT NULL,
          port INTEGER DEFAULT 22,
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          status TEXT DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo', 'erro')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabela de acessos SSH
      db.run(`
        CREATE TABLE IF NOT EXISTS ssh_access (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          server_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_by INTEGER NOT NULL,
          expires_at DATETIME NOT NULL,
          status TEXT DEFAULT 'ativo' CHECK(status IN ('ativo', 'suspenso', 'expirado')),
          max_connections INTEGER DEFAULT 1,
          current_connections INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (server_id) REFERENCES servers (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (created_by) REFERENCES users (id)
        )
      `);

      // Tabela de sessões online
      db.run(`
        CREATE TABLE IF NOT EXISTS online_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ssh_access_id INTEGER NOT NULL,
          ip_address TEXT NOT NULL,
          connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (ssh_access_id) REFERENCES ssh_access (id)
        )
      `);

      // Tabela de pagamentos
      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          ssh_access_id INTEGER,
          amount DECIMAL(10,2) NOT NULL,
          payment_method TEXT NOT NULL,
          payment_id TEXT UNIQUE,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (ssh_access_id) REFERENCES ssh_access (id)
        )
      `);

      // Tabela de configurações
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabela de testes SSH (2 horas)
      db.run(`
        CREATE TABLE IF NOT EXISTS ssh_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          server_id INTEGER NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (server_id) REFERENCES servers (id)
        )
      `);

      // Inserir admin padrão se não existir
      db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          const adminPassword = bcrypt.hashSync('admin123', 10);
          db.run(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
            ['admin', 'admin@painelssh.com', adminPassword, 'admin'],
            (err) => {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Admin padrão criado: admin / admin123');
                resolve();
              }
            }
          );
        } else {
          resolve();
        }
      });
    });
  });
};

module.exports = { db, initDatabase };
