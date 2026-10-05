//REQUISIÇÕES DE TABELA USUARIOS
const express = require("express");
const router = express.Router();

const path = require("path");
const fs = require("fs"); // biblioteca do node para ler e gravar arquivos
const crypto = require("crypto"); // biblioteca do node usada para transformar a senha em hash

const arquivo = path.join(__dirname, "../db/users.json"); // caminho da tabela users (o "banco de dados")

// le a tabela users direto do arquivo, assim sempre pega a versão mais nova
function lerUsers() {
    return JSON.parse(fs.readFileSync(arquivo, "utf-8")); // o arquivo vem como texto, o JSON.parse transforma em lista
}

// grava a tabela users no arquivo, assim a alteração não se perde quando o servidor reinicia
function salvarUsers(users) {
    fs.writeFileSync(arquivo, JSON.stringify(users, null, 2)); // JSON.stringify transforma a lista em texto
}

/**
 * @swagger
 * tags:
 *   name: Clientes 
 *   description: Cadastro de clientes/usuários do sistema - Danilo
 *   
 *
 * components:
 *   schemas:
 *     Client:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         name:
 *           type: string
 *           example: Joao Pedro Almeida
 *         email:
 *           type: string
 *           example: joao.almeida@technova.com
 *         role:
 *           type: string
 *           enum: [ADMIN, RECEPTION, CLIENT]
 *           example: CLIENT
 *         cpf_cnpj:
 *           type: string
 *           example: 333.444.555-66
 *         company_id:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2026-01-12T11:00:00Z
 *     ClientInput:
 *       type: object
 *       required:
 *         - name
 *         - email
 *       properties:
 *         name:
 *           type: string
 *           example: Maria Souza
 *         email:
 *           type: string
 *           example: maria.souza@email.com
 *         password:
 *           type: string
 *           description: Senha em texto. É guardada como hash no campo password_hash.
 *           example: senha123
 *         role:
 *           type: string
 *           enum: [ADMIN, RECEPTION, CLIENT]
 *           example: CLIENT
 *         cpf_cnpj:
 *           type: string
 *           example: 123.456.789-00
 *         company_id:
 *           type: integer
 *           nullable: true
 *           example: 1
 */

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Retorna todos os clientes
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista completa de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 */
//reotorna toda a tabela de clientes
router.get("/clients", function(req, res){ //req (request,requisição) pega o res (response, resposta), tudo da biblioteca express
    const users = lerUsers(); // le a tabela users do arquivo
    res.json(users); // resposta (res) em json sobre a tabela users
});



/**
 * @swagger
 * /clients/nome/{nome}:
 *   get:
 *     summary: Busca clientes pelo nome
 *     description: Busca parcial, ignorando maiúsculas e minúsculas.
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: silva
 *     responses:
 *       200:
 *         description: Clientes encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 *       404:
 *         description: Nenhum cliente encontrado com esse nome
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//procura clientes pelo nome (essa rota precisa ficar antes da "/clients/:id")
router.get("/clients/nome/:nome", function(req, res) {
    const nome = req.params.nome.toLowerCase(); // o nome que veio na url, em letra minuscula
    const users = lerUsers();
    const clients = users.filter(cli => cli.name.toLowerCase().includes(nome)); // filtra todos os clients que tem esse texto no nome

    if(clients.length === 0) return res.status(404).json({ erro: "Nenhum usuário encontrado com esse nome" }); // lista vazia, retornar 404

    res.json(clients); // retorna a lista de clients encontrados
});



/**
 * @swagger
 * /clients/data/{data}:
 *   get:
 *     summary: Busca clientes pela data de cadastro
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-01-12
 *     responses:
 *       200:
 *         description: Clientes cadastrados nessa data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 *       404:
 *         description: Nenhum cliente cadastrado nessa data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//procura clientes pela data de cadastro
router.get("/clients/data/:data", function(req, res) {
    const { data } = req.params; // a data que veio na url, exemplo: 2026-01-12
    const users = lerUsers();
    const clients = users.filter(cli => cli.created_at.startsWith(data)); // "2026-01-12T11:00:00Z" começa com "2026-01-12"

    if(clients.length === 0) return res.status(404).json({ erro: "Nenhum usuário cadastrado nessa data" });

    res.json(clients);
});



/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Busca um cliente pelo id
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       404:
 *         description: Cliente não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//procura um cadastro de cliente pelo id
router.get("/clients/:id", function(req, res) {
    const { id } = req.params; //params são os paramnetros da requisção, nesse caso, é o id
    const users = lerUsers();
    const client = users.find(cli => cli.id === Number(id)); // procure o client na tabela users q for igual a id e coloque na variael client e transfora em numero em vez de sting

    if(!client) return res.status(404).json({ erro: "Usuário não encontrado" }); // Caso n tenha o cliente, retornar 404

    res.json(client); //retorna client em json
});




/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Adiciona um cliente
 *     description: Grava o novo cliente na tabela users. O id e a data de cadastro são gerados pelo servidor.
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClientInput'
 *     responses:
 *       201:
 *         description: Cliente cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       400:
 *         description: Nome ou e-mail não informados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//adiciona um cliente
router.post("/clients", function(req, res) {//mesmo ele usando o mesmo diretorio de retorno da tabela, ele entregaum resultado diferente por contado do "post" um verbo diferente
    const { name, email, password, role, cpf_cnpj, company_id } = req.body; //quais as "colunas" podem ser adicionadas e salva

    if(!name || !email) return res.status(400).json({ erro: "Nome e e-mail são obrigatórios" }); // sem nome ou sem email, retornar 400

    const users = lerUsers();
    const novoId = users.length ? Math.max(...users.map(cli => cli.id)) + 1 : 1; // pega o maior id da tabela e soma 1

    const client = {
        id: novoId,
        name,
        email,
        password_hash: crypto.createHash("sha256").update(password || "").digest("hex"), // a senha não é guardada como texto, vira um hash
        role: role || "CLIENT", // se não mandar o role, fica como CLIENT
        cpf_cnpj: cpf_cnpj || "",
        company_id: company_id || null, // id da empresa do cliente (null = sem empresa)
        created_at: new Date().toISOString() // data e hora de agora
    };

    users.push(client); // coloca o novo client na tabela
    salvarUsers(users); // grava a tabela no arquivo

    res.status(201).json(client); // retorna oq foi salvo em json, com o status 201 (criado)
});


/**
 * @swagger
 * /clients/{id}:
 *   put:
 *     summary: Atualiza os dados de um cliente
 *     description: Só os campos enviados são alterados.
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClientInput'
 *     responses:
 *       200:
 *         description: Cliente atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       404:
 *         description: Cliente não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//atualiza um cliente
router.put("/clients/:id", function(req, res) {
    const { id } = req.params;
    const users = lerUsers();
    const client = users.find(cli => cli.id === Number(id));

    if(!client) return res.status(404).json({ erro: "Usuário não encontrado" });

    const { name, email, password, role, cpf_cnpj, company_id } = req.body; //pegua os dados que o usuario manda

    // só troca o que foi mandado
    if(name) client.name = name; //e define ele como client.name
    if(email) client.email = email;
    if(password) client.password_hash = crypto.createHash("sha256").update(password).digest("hex");
    if(role) client.role = role;
    if(cpf_cnpj !== undefined) client.cpf_cnpj = cpf_cnpj;
    if(company_id !== undefined) client.company_id = company_id;

    salvarUsers(users); // grava a tabela no arquivo

    res.json(client); // responde o cliente atualizado
});



/**
 * @swagger
 * /clients/{id}:
 *   delete:
 *     summary: Remove um cliente
 *     description: Apaga o cliente da tabela users e retorna a lista dos clientes restantes.
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 9
 *     responses:
 *       200:
 *         description: Lista de clientes restantes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 *       404:
 *         description: Cliente não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//deeleta um cliente
router.delete("/clients/:id", function(req, res) {
    const { id } = req.params;
    const users = lerUsers();
    const client = users.find(cli => cli.id === Number(id));

    if(!client) return res.status(404).json({ erro: "Usuário não encontrado" });

    const clientsFiltered = users.filter(client => client.id != Number(id)); // ele filtra os clients, e todos que forem diferentes do id que eu passei serão retornados na lista

    salvarUsers(clientsFiltered); // grava a lista sem o client, agora o delete apaga de verdade

    res.json(clientsFiltered);
});



module.exports = router;
