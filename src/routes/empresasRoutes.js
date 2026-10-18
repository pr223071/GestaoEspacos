// =====================================================================
// ROTAS DE EMPRESAS - Paulo
//
// Cadastro das empresas (pessoa jurídica) que pedem reservas.
// Os dados ficam na tabela "companies" do PostgreSQL (schema sgec).
//
// Rotas:
//   GET    /empresas              -> lista todas
//   GET    /empresas/nome/:nome   -> busca pela razão social ou nome fantasia
//   GET    /empresas/data/:data   -> busca pela data de cadastro
//   GET    /empresas/:id          -> busca uma pelo id
//   POST   /empresas              -> cadastra
//   PUT    /empresas/:id          -> atualiza (só os campos enviados)
//   DELETE /empresas/:id          -> remove
//
// Respostas usadas:
//   200 = deu certo | 201 = criado | 400 = dado errado enviado pelo usuário
//   404 = não encontrado | 409 = conflito (ex.: CNPJ repetido) | 500 = erro no servidor
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");                          // conexão com o banco 
const { responderErro, semAcento } = require("../utils/banco");    // tratamento de erros do banco e busca sem acento
const { cpfValido, cnpjValido } = require("../utils/documentos");  // validação de CPF e CNPJ

// o Router agrupa as rotas deste arquivo; no index.js ele é ligado ao caminho "/empresas"
const router = express.Router();

// colunas devolvidas pela API (tabela sgec.companies)
// fica numa constante para não repetir a lista em todas as consultas
const COLUNAS = "id::int AS id, corporate_name, trade_name, cnpj, phone, legal_rep_name, legal_rep_cpf, created_at";

// no banco o CNPJ e o CPF ficam só com números sem pontuacao
// assim o usuário pode digitar com ou sem pontuação e o banco sempre guarda do mesmo jeito
// /\D/g  pega tudo que NÃO é número e troca por vazio 
const somenteNumeros = valor => (valor === undefined || valor === null) ? valor : String(valor).replace(/\D/g, "");


/**
 * @swagger
 * tags:
 *   name: Empresas
 *   description: Cadastro de empresas - Paulo
 *
 * components:
 *   schemas:
 *     Empresa:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         corporate_name:
 *           type: string
 *           description: Razão social
 *           example: TechNova Solucoes Digitais Ltda
 *         trade_name:
 *           type: string
 *           description: Nome fantasia
 *           example: TechNova
 *         cnpj:
 *           type: string
 *           description: Somente números
 *           example: "12345678000195"
 *         phone:
 *           type: string
 *           example: (48) 3433-1001
 *         legal_rep_name:
 *           type: string
 *           description: Nome do responsável legal
 *           example: Carlos Pereira
 *         legal_rep_cpf:
 *           type: string
 *           description: CPF do responsável legal (somente números)
 *           example: "11122233396"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2026-01-10T10:00:00Z
 *     EmpresaInput:
 *       type: object
 *       required:
 *         - corporate_name
 *         - cnpj
 *         - legal_rep_name
 *         - legal_rep_cpf
 *       properties:
 *         corporate_name:
 *           type: string
 *           description: Razão social
 *           example: Nova Empresa Comercio Ltda
 *         trade_name:
 *           type: string
 *           description: Nome fantasia
 *           example: Nova Empresa
 *         cnpj:
 *           type: string
 *           description: Pode ser enviado com ou sem pontuação
 *           example: 67.890.123/0001-16
 *         phone:
 *           type: string
 *           example: (48) 99999-0000
 *         legal_rep_name:
 *           type: string
 *           description: Nome do responsável legal
 *           example: Joana Silva
 *         legal_rep_cpf:
 *           type: string
 *           description: Pode ser enviado com ou sem pontuação
 *           example: 123.456.789-09
 *     Erro:
 *       type: object
 *       properties:
 *         erro:
 *           type: string
 *           example: Empresa não encontrada
 */


/**
 * @swagger
 * /empresas:
 *   get:
 *     summary: Lista todas as empresas
 *     tags: [Empresas]
 *     responses:
 *       200:
 *         description: Lista de empresas ordenada por id
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Empresa'
 */
// "async" + "await": a consulta ao banco demora um pouco, então o código espera a resposta
// sem travar o servidor (outras requisições continuam sendo atendidas enquanto isso)
router.get("/", async function (req, res) {
    // try/catch: se o banco der erro (ex.: fora do ar), cai no catch e responde com o erro certo
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} FROM companies ORDER BY id`);
        res.json(resultado.rows); // "rows" é a lista de linhas que o banco devolveu
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /empresas/nome/{nome}:
 *   get:
 *     summary: Busca empresas pelo nome (razão social ou nome fantasia)
 *     description: Busca parcial, ignorando maiúsculas/minúsculas e acentos.
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: tech
 *     responses:
 *       200:
 *         description: Empresas encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Empresa'
 *       404:
 *         description: Nenhuma empresa encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/nome/:nome", async function (req, res) {
    try {
        // compara sem maiúsculas/minúsculas e sem acentos 
        // os % no começo e no fim deixam a busca parcial
        // texto do usuário NÃO é colado dentro do SQL. Ele vai separado, no lugar do $1. Isso evita SQL Injection
        const resultado = await pool.query(
            `SELECT ${COLUNAS} FROM companies
              WHERE ${semAcento("corporate_name")} LIKE ${semAcento("$1")}
                 OR ${semAcento("trade_name")} LIKE ${semAcento("$1")}
              ORDER BY id`,
            ["%" + req.params.nome + "%"]
        );

        // lista vazia = nada encontrado -> 404
        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma empresa encontrada com esse nome" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /empresas/data/{data}:
 *   get:
 *     summary: Busca empresas pela data de cadastro
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-01-10
 *     responses:
 *       200:
 *         description: Empresas cadastradas nessa data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Empresa'
 *       400:
 *         description: Data inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Nenhuma empresa cadastrada nessa data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/data/:data", async function (req, res) {
    // confere o formato antes de ir ao banco
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.data)) return res.status(400).json({ erro: "Data inválida. Use o formato AAAA-MM-DD" });

    try {
        // o created_at guarda data E hora; aqui comparamos só a parte da data
        // convertendo antes para o fuso de Brasília (senão uma empresa cadastrada
        // às 22h apareceria no dia seguinte, porque o banco guarda em UTC)
        const resultado = await pool.query(
            `SELECT ${COLUNAS} FROM companies
              WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = $1
              ORDER BY id`,
            [req.params.data]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma empresa cadastrada nessa data" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /empresas/{id}:
 *   get:
 *     summary: Busca uma empresa pelo id
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Empresa encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 *       404:
 *         description: Empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// esta rota fica DEPOIS de /nome e /data: se viesse antes, "/empresas/nome" seria
// entendido como se "nome" fosse um id
router.get("/:id", async function (req, res) {
    try {
        // req.params.id vem da URL como texto ("1"); o Number() transforma em número
        const resultado = await pool.query(`SELECT ${COLUNAS} FROM companies WHERE id = $1`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Empresa não encontrada" });

        res.json(resultado.rows[0]); // [0] = só a primeira (e única) linha, já que o id é único
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /empresas:
 *   post:
 *     summary: Cadastra uma nova empresa
 *     tags: [Empresas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaInput'
 *     responses:
 *       201:
 *         description: Empresa cadastrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 *       400:
 *         description: Campos obrigatórios não informados ou CNPJ/CPF inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Já existe uma empresa com esse CNPJ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/", async function (req, res) {
    // pega os campos do corpo (JSON) da requisição
    const { corporate_name, trade_name, phone, legal_rep_name } = req.body;
    const cnpj = somenteNumeros(req.body.cnpj);
    const legal_rep_cpf = somenteNumeros(req.body.legal_rep_cpf);

    //  confere os dados ANTES de ir ao banco e devolve 400 com uma mensagem clara
    if (!corporate_name || !cnpj || !legal_rep_name || !legal_rep_cpf) {
        return res.status(400).json({ erro: "Razão social (corporate_name), CNPJ, responsável legal (legal_rep_name) e CPF do responsável (legal_rep_cpf) são obrigatórios" });
    }
    // confere os dígitos verificadores 2 últimos números são calculados a partir dos outros
    if (!cnpjValido(cnpj)) return res.status(400).json({ erro: "CNPJ inválido (confira os números e os dígitos verificadores)" });
    if (!cpfValido(legal_rep_cpf)) return res.status(400).json({ erro: "CPF do responsável inválido (confira os números e os dígitos verificadores)" });

    try {
        // grava no banco 
        // $1, $2... são substituídos pelos valores da lista, na mesma ordem 
        // RETURNING faz o INSERT já devolver a empresa criada
        const resultado = await pool.query(
            `INSERT INTO companies (corporate_name, trade_name, cnpj, phone, legal_rep_name, legal_rep_cpf)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${COLUNAS}`,
            [corporate_name, trade_name || corporate_name, cnpj, phone || null, legal_rep_name, legal_rep_cpf] // sem nome fantasia, usa a razão social
        );

        res.status(201).json(resultado.rows[0]); 
    } catch (err) {
    
        if (err.code === "23505") return res.status(409).json({ erro: "Já existe uma empresa com esse CNPJ" });
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /empresas/{id}:
 *   put:
 *     summary: Atualiza os dados de uma empresa
 *     description: Só os campos enviados são alterados.
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaInput'
 *     responses:
 *       200:
 *         description: Empresa atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 *       400:
 *         description: CNPJ ou CPF inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: CNPJ já usado por outra empresa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.put("/:id", async function (req, res) {
    const { corporate_name, trade_name, phone, legal_rep_name } = req.body;
    const cnpj = somenteNumeros(req.body.cnpj);
    const legal_rep_cpf = somenteNumeros(req.body.legal_rep_cpf);

    // no PUT os campos são opcionais: só valida o CNPJ/CPF se ele foi enviado
    if (cnpj && !cnpjValido(cnpj)) return res.status(400).json({ erro: "CNPJ inválido (confira os números e os dígitos verificadores)" });
    if (legal_rep_cpf && !cpfValido(legal_rep_cpf)) return res.status(400).json({ erro: "CPF do responsável inválido (confira os números e os dígitos verificadores)" });

    try {
        // ATUALIZAÇÃO PARCIAL: só troca o que veio preenchido.
        // coalesce $1, corporate_name = se $1  for null, mantém o valor antigo
        const resultado = await pool.query(
            `UPDATE companies SET
                 corporate_name = COALESCE($1, corporate_name),
                 trade_name     = COALESCE($2, trade_name),
                 cnpj           = COALESCE($3, cnpj),
                 phone          = CASE WHEN $4::boolean THEN $5 ELSE phone END,
                 legal_rep_name = COALESCE($6, legal_rep_name),
                 legal_rep_cpf  = COALESCE($7, legal_rep_cpf)
              WHERE id = $8
              RETURNING ${COLUNAS}`,
            [corporate_name || null, trade_name || null, cnpj || null,
             phone !== undefined, phone ?? null,                     // phone pode ser apagado enviando ""
             legal_rep_name || null, legal_rep_cpf || null, Number(req.params.id)]
        );

        // se nenhuma linha foi atualizada, é porque não existe empresa com esse id
        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Empresa não encontrada" });

        res.json(resultado.rows[0]);
    } catch (err) {
      
        if (err.code === "23505") return res.status(409).json({ erro: "CNPJ já usado por outra empresa" });
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /empresas/{id}:
 *   delete:
 *     summary: Remove uma empresa
 *     description: Os usuários vinculados a ela ficam sem empresa (company_id = null), o banco faz isso sozinho (ON DELETE SET NULL).
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *     responses:
 *       200:
 *         description: Empresa removida (retorna a empresa apagada)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 *       404:
 *         description: Empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Empresa tem clientes sem CPF que dependem dela
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete("/:id", async function (req, res) {
    try {
        // RETURNING devolve a empresa que foi apagada 
        // Os usuários dessa empresa ficam com company_id = null automaticamente:
        // a chave estrangeira foi criada com ON DELETE SET NULL no banco.
        const resultado = await pool.query(`DELETE FROM companies WHERE id = $1 RETURNING ${COLUNAS}`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Empresa não encontrada" });

        res.json(resultado.rows[0]);
    } catch (err) {
        // regra do banco: todo cliente precisa ter CPF OU empresa.
        // Se um cliente só é identificado por esta empresa, ao apagá-la ele ficaria
        // sem identificação; o banco recusa (código 23514) e respondemos 409.
        if (err.code === "23514") return res.status(409).json({ erro: "A empresa tem clientes sem CPF vinculados a ela. Cadastre o CPF deles ou remova-os antes" });
        responderErro(res, err);
    }
});


module.exports = router;
