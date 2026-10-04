const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const arquivo = path.join(__dirname, "..", "db", "empresas.json"); // caminho da "tabela" de empresas
const arquivoUsuarios = path.join(__dirname, "..", "db", "usuarios.json");

// le a tabela direto do arquivo, assim sempre pega a versão mais nova
function lerEmpresas() {
    return JSON.parse(fs.readFileSync(arquivo, "utf-8"));
}

// grava a tabela no arquivo (as alterações não se perdem quando o servidor reinicia)
function salvarEmpresas(empresas) {
    fs.writeFileSync(arquivo, JSON.stringify(empresas, null, 2));
}


/**
 * @swagger
 * tags:
 *   name: Empresas
 *   description: Cadastro de empresas
 *
 * components:
 *   schemas:
 *     Empresa:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: TechNova Solucoes Digitais Ltda
 *         cnpj:
 *           type: string
 *           example: 12.345.678/0001-90
 *         email:
 *           type: string
 *           example: contato@technova.com
 *         phone:
 *           type: string
 *           example: (48) 3433-1001
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2026-01-10T10:00:00Z
 *     EmpresaInput:
 *       type: object
 *       required:
 *         - name
 *         - cnpj
 *       properties:
 *         name:
 *           type: string
 *           example: Nova Empresa Ltda
 *         cnpj:
 *           type: string
 *           example: 67.890.123/0001-45
 *         email:
 *           type: string
 *           example: contato@novaempresa.com
 *         phone:
 *           type: string
 *           example: (48) 99999-0000
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
router.get("/", function (req, res) {
    const empresas = lerEmpresas().sort((a, b) => a.id - b.id);
    res.json(empresas);
});


/**
 * @swagger
 * /empresas/nome/{nome}:
 *   get:
 *     summary: Busca empresas pelo nome (busca parcial, ignora maiúsculas)
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
router.get("/nome/:nome", function (req, res) {
    const nome = req.params.nome.toLowerCase();
    const encontradas = lerEmpresas().filter(emp => emp.name.toLowerCase().includes(nome));

    if (encontradas.length === 0) return res.status(404).json({ erro: "Nenhuma empresa encontrada com esse nome" });

    res.json(encontradas);
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
 *       404:
 *         description: Nenhuma empresa cadastrada nessa data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/data/:data", function (req, res) {
    const { data } = req.params;
    const encontradas = lerEmpresas().filter(emp => emp.created_at.startsWith(data)); // "2026-01-10T10:00:00Z" começa com "2026-01-10"

    if (encontradas.length === 0) return res.status(404).json({ erro: "Nenhuma empresa cadastrada nessa data" });

    res.json(encontradas);
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
router.get("/:id", function (req, res) {
    const empresa = lerEmpresas().find(emp => emp.id === Number(req.params.id));

    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

    res.json(empresa);
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
 *         description: Nome ou CNPJ não informados
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
router.post("/", function (req, res) {
    const { name, cnpj, email, phone } = req.body;

    if (!name || !cnpj) return res.status(400).json({ erro: "Nome e CNPJ são obrigatórios" });

    const empresas = lerEmpresas();
    if (empresas.some(emp => emp.cnpj === cnpj)) return res.status(409).json({ erro: "Já existe uma empresa com esse CNPJ" });

    const novoId = empresas.length ? Math.max(...empresas.map(emp => emp.id)) + 1 : 1; // pega o maior id e soma 1
    const novaEmpresa = {
        id: novoId,
        name,
        cnpj,
        email: email || "",
        phone: phone || "",
        created_at: new Date().toISOString()
    };

    empresas.push(novaEmpresa);
    salvarEmpresas(empresas);

    res.status(201).json(novaEmpresa);
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
router.put("/:id", function (req, res) {
    const empresas = lerEmpresas();
    const empresa = empresas.find(emp => emp.id === Number(req.params.id));

    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

    const { name, cnpj, email, phone } = req.body;

    if (cnpj && empresas.some(emp => emp.cnpj === cnpj && emp.id !== empresa.id)) {
        return res.status(409).json({ erro: "CNPJ já usado por outra empresa" });
    }

    // só troca o que veio preenchido
    if (name) empresa.name = name;
    if (cnpj) empresa.cnpj = cnpj;
    if (email !== undefined) empresa.email = email;
    if (phone !== undefined) empresa.phone = phone;

    salvarEmpresas(empresas);

    res.json(empresa);
});


/**
 * @swagger
 * /empresas/{id}:
 *   delete:
 *     summary: Remove uma empresa
 *     description: Os usuários vinculados a ela ficam sem empresa (company_id = null).
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
 */
router.delete("/:id", function (req, res) {
    const empresas = lerEmpresas();
    const empresa = empresas.find(emp => emp.id === Number(req.params.id));

    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

    salvarEmpresas(empresas.filter(emp => emp.id !== empresa.id)); // salva a tabela sem a empresa apagada

    // os usuários dessa empresa ficam sem empresa (em vez de apontar para uma que não existe mais)
    const usuarios = JSON.parse(fs.readFileSync(arquivoUsuarios, "utf-8"));
    usuarios.filter(u => u.company_id === empresa.id).forEach(u => { u.company_id = null; });
    fs.writeFileSync(arquivoUsuarios, JSON.stringify(usuarios, null, 2));

    res.json(empresa);
});


module.exports = router;
