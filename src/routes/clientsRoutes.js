const express = require('express'); // importa o express
const { pool } = require("../config/db"); // cria uma intancia pra usar as funções do banco
const { responderErro } = require("../utils/banco");
// cria uma instância do roteador do Express
const router = express.Router();

//instacia da biblioteca bcryptjs para fazer o hash das senhas
const bcrypt = require('bcryptjs');



//sem password hash para nenhuma rota devolver a senha 
 const COLUNAS = "id, name, email, role, cpf, phone, company_id, is_active, created_at";



/**
 * @swagger
 * tags:
 *   - name: Clientes
 *     description: CRUD de clientes (tabela users)
 *
 * components:
 *   schemas:
 *     Cliente:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Maria Silva
 *         email:
 *           type: string
 *           example: maria@email.com
 *         password_hash:
 *           type: string
 *           example: "123456"
 *         role:
 *           type: string
 *           example: client
 *         cpf:
 *           type: string
 *           example: "12345678900"
 *         phone:
 *           type: string
 *           example: "48999999999"
 *         company_id:
 *           type: integer
 *           example: 1
 *         is_active:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-10-23T13:00:00.000Z"
 *
 *     ClienteInput:
 *       type: object
 *       required: [name, email, password, role, cpf, phone, company_id]
 *       properties:
 *         name:
 *           type: string
 *           example: Maria Silva
 *         email:
 *           type: string
 *           example: maria@email.com
 *         password:
 *           type: string
 *           example: "123456"
 *         role:
 *           type: string
 *           example: client
 *         cpf:
 *           type: string
 *           example: "12345678900"
 *         phone:
 *           type: string
 *           example: "48999999999"
 *         company_id:
 *           type: integer
 *           example: 1
 *
 *     ClienteUpdate:
 *       type: object
 *       description: Envie só os campos que quer alterar
 *       properties:
 *         name:
 *           type: string
 *           example: Maria Souza
 *         email:
 *           type: string
 *           example: novo@email.com
 *         password_hash:
 *           type: string
 *           example: "nova_senha"
 *         role:
 *           type: string
 *           example: client
 *         cpf:
 *           type: string
 *           example: "12345678900"
 *         phone:
 *           type: string
 *           example: "48988887777"
 *         company_id:
 *           type: integer
 *           example: 1
 *         is_active:
 *           type: boolean
 *           example: false
 *
 *     Erro:
 *       type: object
 *       properties:
 *         erro:
 *           type: string
 *           example: mensagem do erro
 *
 *   responses:
 *     ErroValidacao:
 *       description: Dados inválidos
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Erro'
 *     NaoEncontrado:
 *       description: Registro não encontrado
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Erro'
 *     Conflito:
 *       description: Registro duplicado
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Erro'
 *     ErroInterno:
 *       description: Erro interno no servidor
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Erro'
 */




/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Lista todos os clientes
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cliente'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//RETORNA TODOS OS CLIENTES DO BANCO DE DADOS

// "async" + "await": a consulta ao banco demora um pouco, então o código espera a resposta
// sem travar o servidor (outras requisições continuam sendo atendidas enquanto isso)
router.get("/clients", async function(req, res){ //req (request,requisição) pega o res (response, resposta), tudo da biblioteca express

try{//pool. é a instância do banco de dados, query é a função que faz a query no banco
    const resultado = await pool.query(`SELECT * FROM Users`); // faz a query no banco de dados
    
    //verifica se tem 0 clientes
    if(resultado.rowCount === 0){
        return res.status(404).json({ error: "nenhum cliente cadastrado"});
    }
    
    res.json(resultado.rows); // retorna o resultado da query em formato json

}
catch (error) {
    console.error("Erro ao buscar clientes:", error);//print no console do erro
    res.status(500).json({ error: "Erro ao buscar clientes" });//retorna um json com o status 500 e a mensagem de erro
}
});


/**
 * @swagger
 * /clients/name/{name}:
 *   get:
 *     summary: Pesquisa clientes pelo nome (busca parcial, ignora maiúsculas)
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: maria
 *     responses:
 *       200:
 *         description: Clientes encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cliente'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//PESQUISA PELO NOME DO CLIENTE
router.get("/clients/name/:name", async function (req,res){

// WHERE name = $1      -- igual, texto exato
// WHERE name LIKE $1   -- busca parcial, diferencia maiúscula de minúscula
// WHERE name ILIKE $1  -- busca parcial, ignora maiúscula/minúscula

    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} FROM users WHERE name ILIKE $1`, ["%"+ req.params.name +"%"]);
        
        //retorna o erro se n tiver linhas
        if (resultado.rowCount === 0){return res.status(404).json({ erro: "nenhum cliente encontrado"});}

        res.json(resultado.rows);
    }
catch (err){
 responderErro(res, err);
}
});






/**
 * @swagger
 * /clients/id/{id}:
 *   get:
 *     summary: Busca um cliente pelo id
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cliente'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
// PESQUISA UM CLIENTE EM ESPECIFICO
router.get("/clients/id/:id", async function (req, res){

    // As crases (`) são utilizadas para isierir variaveis dentro de strings
    //o $1 reserva o local onde o pg preenche com o primeiro item do array
    //"[Number(req.params.id)]" acessa o id vindo da url e NUmber transforma ele em INT
    try{

        // trsnforma o id em inteiro 
        const id = Number(req.params.id);
        //verifica se id é um inteiro ou se é um numero maior que 0, se não da erro 
        if(!Number.isInteger(id) || id < 0 ){return res.status(400).json({ erro: "informe um valor valido"})}
        
        const resultado = await pool.query(`SELECT ${COLUNAS} FROM users WHERE id = $1`, [Number(req.params.id)]);
    
        // se a quantidade de linhas for igual a 0, ele retorna o status 404 e a mensagem de erro em json
        if (resultado.rowCount === 0){
            return res.status(404).json({ erro: "cliente não encontrada"});
        }
        // se não, retorna o cliente prucarado
        res.json(resultado.rows);
    }
catch (err) {
    responderErro(res, err);
}

});


/**
 * @swagger
 * /clients/update/{id}:
 *   put:
 *     summary: Altera os dados de um cliente (só os campos enviados)
 *     description: Também serve para ativar/desativar o cliente com is_active. Email e cpf não podem pertencer a outro cliente.
 *     tags: [Clientes]
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
 *             $ref: '#/components/schemas/ClienteUpdate'
 *     responses:
 *       200:
 *         description: Cliente atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         $ref: '#/components/responses/Conflito'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//ALTERA OS DADOS DE UM CLIENTE
router.put("/clients/update/:id", async (req, res) => {

    try{

    // trsnforma o id em inteiro 
    const id = Number(req.params.id);

    //verifica se id é um inteiro ou se é um numero maior que 0, se não da erro 
    if(!Number.isInteger(id) || id <= 0 ){return res.status(400).json({ erro: "informe um valor valido"})}

    // só os campos que vierem no body são alterados, o resto continua igual
    const { name, email, password_hash, role, cpf, phone, company_id, is_active } = req.body;

    //se não vier nenhum campo, retorna erro
    if(name === undefined && email === undefined && password_hash === undefined && role === undefined &&
       cpf === undefined && phone === undefined && company_id === undefined && is_active === undefined){
        return res.status(400).json({ erro: "informe pelo menos um campo para alterar"});
    }

    // se mandar company_id, verifica se é valido
    let empresa = null;
    if(company_id !== undefined){
        empresa = Number(company_id);
        if(!Number.isInteger(empresa) || empresa <= 0){return res.status(400).json({ erro: "informe um company_id valido"})}
    }

    // se mandar is_active, tem que ser true ou false
    if(is_active !== undefined && typeof is_active !== "boolean"){return res.status(400).json({ erro: "is_active deve ser true ou false"})}

    // verifica se o email ou cpf já pertencem a OUTRO cliente (id <> $3 ignora o próprio cliente)
    if(email !== undefined || cpf !== undefined){
        const repetido = await pool.query(
            `SELECT email, cpf FROM users WHERE (email = $1 OR cpf = $2) AND id <> $3`,
            [email ?? null, cpf ?? null, id]
        );

        if(repetido.rowCount > 0){
            if(email !== undefined && repetido.rows.some(u => u.email === email)){return res.status(409).json({ erro: "email já cadastrado"})}
            return res.status(409).json({ erro: "cpf já cadastrado"});
        }
    }

    // COALESCE pega o primeiro valor que não for nulo:
    // se o campo não veio (null), mantém o valor que já estava no banco
    const resultado = await pool.query(
        `UPDATE users SET
            name = COALESCE($1, name),
            email = COALESCE($2, email),
            password_hash = COALESCE($3, password_hash),
            role = COALESCE($4, role),
            cpf = COALESCE($5, cpf),
            phone = COALESCE($6, phone),
            company_id = COALESCE($7, company_id),
            is_active = COALESCE($8, is_active)
         WHERE id = $9
         RETURNING ${COLUNAS}`,
        [name ?? null, email ?? null, password_hash ?? null, role ?? null, cpf ?? null, phone ?? null, empresa, is_active ?? null, id]
    );

    if(resultado.rowCount === 0){return res.status(404).json({ erro: "cliente não encontrado"})}

    //retorna o cliente atualizado
    res.json(resultado.rows[0]);
}

catch (err){
    responderErro(res, err);
}
});



/**
 * @swagger
 * /clients/delete/{id}:
 *   delete:
 *     summary: Deleta um cliente
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Cliente deletado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       400:
 *         description: Id inválido ou cliente com registros ligados a ele
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//DELETA UM USUARIO
//DELETA UM USUARIO
router.delete("/clients/delete/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: "informe um valor valido" });
        }

        // retorna só os campos seguros, sem o password_hash
        const resultado = await pool.query(
            `DELETE FROM users WHERE id = $1 RETURNING *`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ erro: "cliente não encontrado" });
        }

        res.json(resultado.rows[0]);
    }
    catch (err) {
        responderErro(res, err); // função que de fato foi importada
    }
});




/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Cria um cliente
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClienteInput'
 *     responses:
 *       201:
 *         description: Cliente criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       409:
 *         $ref: '#/components/responses/Conflito'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//CRIA UM CLIENTE NO BANCO DE DADOS

router.post("/clients", async function(req, res) {
    
    // o req.body vai pedir todos esses campos
    const { name, email, password, role, cpf, phone, company_id } = req.body
    
    //se algum vir nulo, retorna erro
    if(!name || !email || !password || !role || !cpf || !phone || !company_id){
        return res.status(400).json({ erro : "é nescessarios todos os campos preenchidos"});
    }


    // a senha tem que ser texto. Se alguém mandar um número no JSON (ex: 123456 sem aspas),
    // o bcrypt dá erro, então barramos antes.
    if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ erro: "a senha deve ter pelo menos 6 caracteres" });
    }



    try{
        // transforma o company_id em inteiro e verifica se é valido
        const empresa = Number(company_id);
        if(!Number.isInteger(empresa) || empresa <= 0){return res.status(400).json({ erro: "informe um company_id valido"})}


        //transofrma a password em hash
        const hash = await bcrypt.hash(password, 10);



        // insere o cliente e retorna o cliente criado
        // is_active e created_at ficam com o valor padrão do banco
        const resultado = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, cpf, phone, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING ${COLUNAS}`,
            [name, email, hash, role, cpf, phone, empresa]
        );

        // 201 = criado com sucesso
        res.status(201).json(resultado.rows[0]);
    }
    catch (err){
        // email/cpf repetido (23505) ou empresa que não existe (23503) caem aqui
        responderErro(res, err);
    }
}

);

module.exports = router;