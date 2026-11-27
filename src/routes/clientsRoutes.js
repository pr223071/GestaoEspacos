const express = require("express"); // importa o express
const { pool } = require("../config/db"); // cria uma intancia pra usar as funções do banco
const { responderErro } = require("../utils/banco");
const {
  limparEmail,
  soNumeros,
  problemaCpf,
  problemaTelefone,
} = require("../utils/documentos");
// cria uma instância do roteador do Express
const router = express.Router();

//instacia da biblioteca bcryptjs para fazer o hash das senhas
const bcrypt = require("bcryptjs");

//sem password hash para nenhuma rota devolver a senha
const COLUNAS =
  "id, name, email, role, cpf, phone, company_id, is_active, created_at";

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
 *       required: [name, email, password, role, cpf, phone]
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
router.get("/clients", async function (req, res) {
  //req (request,requisição) pega o res (response, resposta), tudo da biblioteca express

  try {
    //pool. é a instância do banco de dados, query é a função que faz a query no banco
    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM users ORDER BY name`,
    ); // faz a query no banco de dados

    //verifica se tem 0 clientes
    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: "nenhum cliente cadastrado" });
    }

    res.json(resultado.rows); // retorna o resultado da query em formato json
  } catch (error) {
    console.error("Erro ao buscar clientes:", error); //print no console do erro
    res.status(500).json({ error: "Erro ao buscar clientes" }); //retorna um json com o status 500 e a mensagem de erro
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
router.get("/clients/name/:name", async function (req, res) {
  // WHERE name = $1      -- igual, texto exato
  // WHERE name LIKE $1   -- busca parcial, diferencia maiúscula de minúscula
  // WHERE name ILIKE $1  -- busca parcial, ignora maiúscula/minúscula

  try {
    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM users WHERE name ILIKE $1`,
      ["%" + req.params.name + "%"],
    );

    //retorna o erro se n tiver linhas
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "nenhum cliente encontrado" });
    }

    res.json(resultado.rows);
  } catch (err) {
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
router.get("/clients/id/:id", async function (req, res) {
  // As crases (`) são utilizadas para isierir variaveis dentro de strings
  //o $1 reserva o local onde o pg preenche com o primeiro item do array
  //"[Number(req.params.id)]" acessa o id vindo da url e NUmber transforma ele em INT
  try {
    // trsnforma o id em inteiro
    const id = Number(req.params.id);
    //verifica se id é um inteiro ou se é um numero maior que 0, se não da erro
    if (!Number.isInteger(id) || id < 0) {
      return res.status(400).json({ erro: "informe um valor valido" });
    }

    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM users WHERE id = $1`,
      [Number(req.params.id)],
    );

    // se a quantidade de linhas for igual a 0, ele retorna o status 404 e a mensagem de erro em json
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "cliente não encontrada" });
    }
    // se não, retorna o cliente prucarado
    res.json(resultado.rows);
  } catch (err) {
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
  try {
    // trsnforma o id em inteiro
    const id = Number(req.params.id);

    //verifica se id é um inteiro ou se é um numero maior que 0, se não da erro
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "informe um valor valido" });
    }

    // só os campos que vierem no body são alterados, o resto continua igual
    const { name, password_hash, role, company_id, is_active } = req.body;
    const email = limparEmail(req.body.email); // e-mail padronizado
    // cpf e telefone ficam só com números no banco (aceita "529.982.247-25" ou "52998224725")
    const cpf = soNumeros(req.body.cpf);
    const phone = soNumeros(req.body.phone);

    //se não vier nenhum campo, retorna erro
    if (
      name === undefined &&
      email === undefined &&
      password_hash === undefined &&
      role === undefined &&
      cpf === undefined &&
      phone === undefined &&
      company_id === undefined &&
      is_active === undefined
    ) {
      return res
        .status(400)
        .json({ erro: "informe pelo menos um campo para alterar" });
    }

    // se mandar cpf ou telefone, confere se são válidos
    if (cpf !== undefined) {
      const problema = problemaCpf(cpf);
      if (problema) {
        return res.status(400).json({ erro: problema });
      }
    }
    if (phone !== undefined) {
      const problema = problemaTelefone(phone);
      if (problema) {
        return res.status(400).json({ erro: problema });
      }
    }

    // se mandar company_id, verifica se é valido
    let empresa = null;
    if (company_id !== undefined) {
      empresa = Number(company_id);
      if (!Number.isInteger(empresa) || empresa <= 0) {
        return res.status(400).json({ erro: "informe um company_id valido" });
      }
    }

    // se mandar is_active, tem que ser true ou false
    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({ erro: "is_active deve ser true ou false" });
    }

    // verifica se o email ou cpf já pertencem a OUTRO cliente (id <> $3 ignora o próprio cliente)
    if (email !== undefined || cpf !== undefined) {
      const repetido = await pool.query(
        `SELECT lower(email) AS email, cpf FROM users WHERE (lower(email) = $1 OR cpf = $2) AND id <> $3`,
        [email ?? null, cpf ?? null, id],
      );

      if (repetido.rowCount > 0) {
        if (
          email !== undefined &&
          repetido.rows.some((u) => u.email === email)
        ) {
          return res.status(409).json({ erro: "email já cadastrado" });
        }
        return res.status(409).json({ erro: "cpf já cadastrado" });
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
      [
        name ?? null,
        email ?? null,
        password_hash ?? null,
        role ?? null,
        cpf ?? null,
        phone ?? null,
        empresa,
        is_active ?? null,
        id,
      ],
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "cliente não encontrado" });
    }

    //retorna o cliente atualizado
    res.json(resultado.rows[0]);
  } catch (err) {
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
router.delete("/clients/delete/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "informe um valor valido" });
    }

    //verifica se o user tem vagas ativas
    const { rows } = await pool.query(
      `SELECT * FROM bookings WHERE user_id = $1 AND status != 'REJECTED' `,
      [id],
    );
    if (rows.length > 0) {
      return res
        .status(409)
        .json({
          erro: "não é possivel excluir um usuario com uma reserva ativa",
        });
    }

    // retorna só os campos seguros, sem o password_hash
    const resultado = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING *`,
      [id],
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "cliente não encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (err) {
    responderErro(res, err); // função que de fato foi importada
  }
});

/**
 * @swagger
 * /perfil:
 *   get:
 *     summary: Dados do próprio usuário logado
 *     tags: [Perfil]
 *     responses:
 *       200:
 *         description: Usuário logado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *   put:
 *     summary: Altera os dados do próprio usuário (nome, email, cpf, telefone, senha)
 *     description: Para trocar a senha é preciso mandar senha_atual. Perfil, empresa e status não podem ser alterados aqui.
 *     tags: [Perfil]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               cpf: { type: string }
 *               phone: { type: string }
 *               password: { type: string, description: nova senha }
 *               senha_atual: { type: string }
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       409:
 *         $ref: '#/components/responses/Conflito'
 *   delete:
 *     summary: Exclui a própria conta
 *     description: Pede a senha para confirmar. Se o usuário tiver histórico de reservas, a conta é desativada em vez de apagada.
 *     tags: [Perfil]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               senha: { type: string }
 *     responses:
 *       200:
 *         description: Conta excluída ou desativada
 *       401:
 *         description: Senha incorreta
 *       409:
 *         description: Usuário tem reservas ativas
 */
// VER O PRÓPRIO PERFIL (o id vem do token, não da url)
router.get("/perfil", async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM users WHERE id = $1`,
      [req.usuario.id],
    );
    if (resultado.rowCount === 0)
      return res.status(404).json({ erro: "usuário não encontrado" });
    res.json(resultado.rows[0]);
  } catch (err) {
    responderErro(res, err);
  }
});

// ALTERA O PRÓPRIO PERFIL
router.put("/perfil", async (req, res) => {
  try {
    if (req.usuario.role === "RECEPTION") {
      return res.status(403).json({ erro: "o perfil de funcionário não pode ser alterado por aqui; fale com o administrador" });
    }
    const id = req.usuario.id;
    const { name, password, senha_atual } = req.body;
    const email = limparEmail(req.body.email);
    const cpf = soNumeros(req.body.cpf);
    const phone = soNumeros(req.body.phone);

    if (
      name === undefined &&
      email === undefined &&
      cpf === undefined &&
      phone === undefined &&
      password === undefined
    ) {
      return res
        .status(400)
        .json({ erro: "informe pelo menos um campo para alterar" });
    }
    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim() === "")
    ) {
      return res.status(400).json({ erro: "o nome não pode ficar vazio" });
    }
    if (email !== undefined && (typeof email !== "string" || email === "")) {
      return res.status(400).json({ erro: "o e-mail não pode ficar vazio" });
    }
    if (cpf !== undefined) {
      const problema = problemaCpf(cpf);
      if (problema) return res.status(400).json({ erro: problema });
    }
    if (phone !== undefined) {
      const problema = problemaTelefone(phone);
      if (problema) return res.status(400).json({ erro: problema });
    }

    // trocar a senha exige a senha atual
    let hash = null;
    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 4) {
        return res
          .status(400)
          .json({ erro: "a nova senha deve ter pelo menos 4 caracteres" });
      }
      if (!senha_atual)
        return res
          .status(400)
          .json({ erro: "informe a senha atual para trocar a senha" });
      const atual = await pool.query(
        `SELECT password_hash FROM users WHERE id = $1`,
        [id],
      );
      if (atual.rowCount === 0)
        return res.status(404).json({ erro: "usuário não encontrado" });
      const confere = await bcrypt.compare(
        String(senha_atual),
        atual.rows[0].password_hash,
      );
      if (!confere)
        return res.status(401).json({ erro: "senha atual incorreta" });
      hash = await bcrypt.hash(password, 10);
    }

    // e-mail ou cpf de outro usuário
    if (email !== undefined || cpf !== undefined) {
      const repetido = await pool.query(
        `SELECT lower(email) AS email, cpf FROM users WHERE (lower(email) = $1 OR cpf = $2) AND id <> $3`,
        [email ?? null, cpf ?? null, id],
      );
      if (repetido.rowCount > 0) {
        if (email !== undefined && repetido.rows.some((u) => u.email === email))
          return res.status(409).json({ erro: "email já cadastrado" });
        return res.status(409).json({ erro: "cpf já cadastrado" });
      }
    }

    const resultado = await pool.query(
      `UPDATE users SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                cpf = COALESCE($3, cpf),
                phone = COALESCE($4, phone),
                password_hash = COALESCE($5, password_hash)
             WHERE id = $6
             RETURNING ${COLUNAS}`,
      [
        name !== undefined ? name.trim() : null,
        email ?? null,
        cpf ?? null,
        phone ?? null,
        hash,
        id,
      ],
    );
    if (resultado.rowCount === 0)
      return res.status(404).json({ erro: "usuário não encontrado" });
    res.json(resultado.rows[0]);
  } catch (err) {
    responderErro(res, err);
  }
});

// EXCLUI A PRÓPRIA CONTA
router.delete("/perfil", async (req, res) => {
  try {
    if (req.usuario.role === "RECEPTION") {
      return res.status(403).json({ erro: "o perfil de funcionário não pode ser excluído; fale com o administrador" });
    }
    const id = req.usuario.id;
    const { senha } = req.body || {};
    if (!senha)
      return res
        .status(400)
        .json({ erro: "informe sua senha para excluir a conta" });

    const atual = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [id],
    );
    if (atual.rowCount === 0)
      return res.status(404).json({ erro: "usuário não encontrado" });
    const confere = await bcrypt.compare(
      String(senha),
      atual.rows[0].password_hash,
    );
    if (!confere) return res.status(401).json({ erro: "senha incorreta" });

    // reservas pendentes ou aprovadas que ainda não terminaram
    const ativas = await pool.query(
      `SELECT 1 FROM bookings WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED') AND end_datetime >= now() LIMIT 1`,
      [id],
    );
    if (ativas.rowCount > 0) {
      return res
        .status(409)
        .json({
          erro: "você tem reservas ativas; cancele-as antes de excluir a conta",
        });
    }

    try {
      await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
      return res.json({ mensagem: "conta excluída" });
    } catch (err) {
      // 23503: o usuário aparece no histórico (reservas antigas, check-ins...), então só desativa
      if (err.code !== "23503") throw err;
      await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [
        id,
      ]);
      return res.json({
        mensagem: "conta desativada (seu histórico de reservas foi mantido)",
      });
    }
  } catch (err) {
    responderErro(res, err);
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

router.post("/clients", async function (req, res) {
  // o req.body vai pedir todos esses campos
  const { name, password, role, company_id } = req.body;
  const email = limparEmail(req.body.email); // e-mail padronizado
  // cpf e telefone ficam só com números no banco (aceita "529.982.247-25" ou "52998224725")
  const cpf = soNumeros(req.body.cpf);
  const phone = soNumeros(req.body.phone);

  //se algum vir vazio, retorna erro dizendo QUAIS faltaram (company_id é opcional: o signup não manda)
  const obrigatorios = {
    nome: name,
    email,
    senha: password,
    perfil: role,
    CPF: cpf,
    telefone: phone,
  };
  const faltando = Object.keys(obrigatorios).filter(
    (campo) => !obrigatorios[campo],
  );
  if (faltando.length > 0) {
    return res
      .status(400)
      .json({
        erro: `preencha os campos obrigatórios: ${faltando.join(", ")}`,
      });
  }

  // confere se o cpf tem 11 números
  const problemaDoCpf = problemaCpf(cpf);
  if (problemaDoCpf) {
    return res.status(400).json({ erro: problemaDoCpf });
  }

  // confere o telefone (DDD + número)
  const problemaDoTelefone = problemaTelefone(phone);
  if (problemaDoTelefone) {
    return res.status(400).json({ erro: problemaDoTelefone });
  }

  // a senha tem que ser texto. Se alguém mandar um número no JSON (ex: 123456 sem aspas),
  // o bcrypt dá erro, então barramos antes.
  if (typeof password !== "string" || password.length < 4) {
    return res
      .status(400)
      .json({ erro: "a senha deve ter pelo menos 4 caracteres" });
  }

  try {
    // se mandar company_id, transforma em inteiro e verifica se é valido
    // se não mandar, o cliente fica sem empresa (null) até alguém vincular uma
    let empresa = null;
    if (company_id !== undefined && company_id !== null && company_id !== "") {
      empresa = Number(company_id);
      if (!Number.isInteger(empresa) || empresa <= 0) {
        return res.status(400).json({ erro: "informe um company_id valido" });
      }
    }

    // barra e-mail ou cpf já cadastrado
    const repetido = await pool.query(
      `SELECT lower(email) AS email FROM users WHERE lower(email) = $1 OR cpf = $2`,
      [email, cpf],
    );
    if (repetido.rowCount > 0) {
      if (repetido.rows.some((u) => u.email === email)) {
        return res.status(409).json({ erro: "email já cadastrado" });
      }
      return res.status(409).json({ erro: "cpf já cadastrado" });
    }

    //transofrma a password em hash
    const hash = await bcrypt.hash(password, 10);

    // insere o cliente e retorna o cliente criado
    // is_active e created_at ficam com o valor padrão do banco
    const resultado = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, cpf, phone, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING ${COLUNAS}`,
      [name, email, hash, role, cpf, phone, empresa],
    );

    // 201 = criado com sucesso
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    // email/cpf repetido (23505) ou empresa que não existe (23503) caem aqui
    responderErro(res, err);
  }
});

module.exports = router;
