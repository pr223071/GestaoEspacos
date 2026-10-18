require('dotenv').config();
const express = require('express');
const { testarConexao, pool } = require("../config/db");
const app = express();
const PORT = Number(process.env.PORT || 3080);

app.use(express.json());
app.use(require('../routes'));
app.get('/', (req, res) => res.redirect('/docs'));
app.use((req, res) => res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` }));

async function iniciar() {
    try {
        const banco = await testarConexao();
        console.log(`PostgreSQL conectado: banco=${banco.banco}, schema=${banco.schema}`);
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
            console.log(`Swagger em http://localhost:${PORT}/docs`);
        });
    } catch (err) {
        console.error('Não foi possível conectar ao PostgreSQL. Confira o arquivo .env e se o servidor está ativo.');
        console.error(err.message);
        process.exit(1);
    }
}

iniciar();
process.on('SIGINT', async () => { await pool.end(); process.exit(0); });
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
