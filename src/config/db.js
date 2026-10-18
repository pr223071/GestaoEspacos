const { Pool } = require('pg');
require('dotenv').config();

// Todas as rotas usam a mesma configuração de conexão.
const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'sgec',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    // O db do projeto é sgec
    options: '-c search_path=sgec,public',
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
    console.error('Erro de conexao com o banco:', err.message);
});

async function testarConexao() {
    const result = await pool.query('SELECT current_database() AS banco, current_schema() AS schema');
    return result.rows[0];
}

module.exports = { pool, testarConexao };
