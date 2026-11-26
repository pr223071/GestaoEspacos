const express = require("express"); // importa o express
const { pool } = require("../config/db"); // cria uma intancia pra usar as funções do banco
const { responderErro } = require("../utils/banco");

// cria uma instância do roteador do Express
const router = express.Router();

const COLUNAS =
  "id, name, type, capacity, description, terms_of_use, buffer_minutes, is_active, created_at";

/**
 * @swagger
 * tags:
 *   - name: Espaços
 *     description: CRUD de espaços
 *
 * components:
 *   schemas:
 *     Espaco:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Sala de Reunião 1
 *         type:
 *           type: string
 *           description: Tipo próprio do banco, precisa ser um dos valores aceitos
 *           example: sala
 *         capacity:
 *           type: integer
 *           example: 10
 *         description:
 *           type: string
 *           nullable: true
 *           example: Sala com projetor
 *         terms_of_use:
 *           type: string
 *           nullable: true
 *           example: Deixar a sala organizada
 *         buffer_minutes:
 *           type: integer
 *           example: 15
 *         is_active:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-10-23T13:00:00.000Z"
 *
 *     EspacoInput:
 *       type: object
 *       required: [name, type, capacity]
 *       properties:
 *         name:
 *           type: string
 *           example: Sala de Reunião 1
 *         type:
 *           type: string
 *           example: sala
 *         capacity:
 *           type: integer
 *           example: 10
 *         description:
 *           type: string
 *           example: Sala com projetor
 *         terms_of_use:
 *           type: string
 *           example: Deixar a sala organizada
 *         buffer_minutes:
 *           type: integer
 *           description: Se não for enviado, usa 0
 *           example: 15
 *
 *     EspacoUpdate:
 *       type: object
 *       description: Envie só os campos que quer alterar
 *       properties:
 *         name:
 *           type: string
 *           example: Sala de Reunião 2
 *         type:
 *           type: string
 *           example: sala
 *         capacity:
 *           type: integer
 *           example: 20
 *         description:
 *           type: string
 *           example: Sala com projetor e TV
 *         terms_of_use:
 *           type: string
 *           example: Deixar a sala organizada
 *         buffer_minutes:
 *           type: integer
 *           example: 10
 *         is_active:
 *           type: boolean
 *           example: false
 */

/**
 * @swagger
 * /spaces:
 *   get:
 *     summary: Lista todos os espaços
 *     tags: [Espaços]
 *     responses:
 *       200:
 *         description: Lista de espaços
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Espaco'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//RETORNA TODOS OS ESPAÇOS

router.get("/spaces", async function (req, res) {
  try {
    const resultado = await pool.query("SELECT * FROM spaces");
    //verifica se tem 0 clientes
    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: "nenhum cliente cadastrado" });
    }
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: "erro ao buscar os espaço" });
  }
});

/**
 * @swagger
 * /spaces/name/{name}:
 *   get:
 *     summary: Pesquisa espaços pelo nome (busca parcial, ignora maiúsculas)
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: reunião
 *     responses:
 *       200:
 *         description: Espaços encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Espaco'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//PESQUISA PELO NOME
router.get("/spaces/name/:name", async function (req, res) {
  //não precisa verificar se veio como inteiro, pois a url só retorna string
  try {
    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM spaces WHERE name ILIKE $1`,
      ["%" + req.params.name + "%"],
    );

    //retorna o erro se n tiver linhas
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "nenhum espaço encontrado" });
    }
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: "erro ao buscar o espaço" });
  }
});

/**
 * @swagger
 * /spaces/type/{type}:
 *   get:
 *     summary: Pesquisa espaços pelo tipo (busca parcial, ignora maiúsculas)
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         example: sala
 *     responses:
 *       200:
 *         description: Espaços encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Espaco'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//PESQUISA PELO TIPO
router.get("/spaces/type/:type", async function (req, res) {
  /*
        No banco, o tipo da coluna type, não string ou varchar.Foi criado
        um tipo próprio para a coluna. E para resolver isso, basta tranformar
        a coluna em text com essa sintaxe "type::text", pois LIKE só comapra texto
    */
  try {
    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM spaces WHERE type::text ILIKE $1`,
      ["%" + req.params.type + "%"],
    );

    //retorna o erro se n tiver linhas
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "nenhum espaço encontrado" });
    }
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: "erro ao buscar o espaço" });
  }
});

/**
 * @swagger
 * /spaces/id/{id}:
 *   get:
 *     summary: Busca um espaço pelo id
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Espaço encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Espaco'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//PESQUISA PELO ID
router.get("/spaces/id/:id", async function (req, res) {
  try {
    //verifica se o numero é valido
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ errr: "informe um valor valido" });
    }
    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM spaces WHERE id = $1`,
      [id],
    );

    //retorna o erro se n tiver linhas
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "nenhum espaço encontrado" });
    }
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: "erro ao buscar o espaço" });
  }
});

/**
 * @swagger
 * /spaces/status/{status}:
 *   get:
 *     summary: Lista os espaços ativos ou inativos
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         example: "true"
 *     responses:
 *       200:
 *         description: Espaços encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Espaco'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//RETORNA APENAS AS QUE ESTÃO ATIVAS
router.get("/spaces/status/:status", async function (req, res) {
  //req.params sempre retorna variaeis tipo string

  try {
    const status = req.params.status;
    // só aceita os textos "true" ou "false"
    if (status !== "true" && status !== "false") {
      return res
        .status(400)
        .json({ error: "Insira um valor válido (true ou false)" });
    }

    const resultado = await pool.query(
      `SELECT ${COLUNAS} FROM spaces WHERE is_active = $1`,
      [status],
    );

    //retorna o erro se n tiver linhas
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "nenhum espaço encontrado" });
    }
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: "erro ao buscar o espaço" });
  }
});

/**
 * @swagger
 * /spaces:
 *   post:
 *     summary: Cria um espaço
 *     tags: [Espaços]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EspacoInput'
 *     responses:
 *       201:
 *         description: Espaço criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Espaco'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       409:
 *         $ref: '#/components/responses/Conflito'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//CRIA UM ESPAÇO NO BANCO DE DADOS
router.post("/spaces", async function (req, res) {
  // o req.body vai pedir esses campos (description e terms_of_use são opcionais)
  const { name, type, capacity, description, terms_of_use, buffer_minutes } =
    req.body;

  //se algum obrigatorio vir nulo, retorna erro
  if (!name || !type || capacity === undefined) {
    return res
      .status(400)
      .json({ erro: "name, type e capacity são obrigatórios" });
  }

  try {
    // transforma a capacidade em inteiro e verifica se é valida
    const capacidade = Number(capacity);
    if (!Number.isInteger(capacidade) || capacidade <= 0) {
      return res.status(400).json({ erro: "informe uma capacity valida" });
    }

    // se não mandar buffer_minutes, usa 0
    const buffer = buffer_minutes === undefined ? 0 : Number(buffer_minutes);
    if (!Number.isInteger(buffer) || buffer < 0) {
      return res.status(400).json({ erro: "informe um buffer_minutes valido" });
    }

    // insere o espaço e retorna o espaço criado
    // is_active e created_at ficam com o valor padrão do banco
    const resultado = await pool.query(
      `INSERT INTO spaces (name, type, capacity, description, terms_of_use, buffer_minutes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUNAS}`,
      [
        name,
        type,
        capacidade,
        description || null,
        terms_of_use || null,
        buffer,
      ],
    );

    // 201 = criado com sucesso
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    // type que não existe no banco (22P02) ou nome repetido (23505) caem aqui
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /spaces/update/{id}:
 *   put:
 *     summary: Altera os dados de um espaço (só os campos enviados)
 *     description: Também serve para ativar/desativar o espaço com is_active.
 *     tags: [Espaços]
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
 *             $ref: '#/components/schemas/EspacoUpdate'
 *     responses:
 *       200:
 *         description: Espaço atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Espaco'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       409:
 *         $ref: '#/components/responses/Conflito'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//ALTERA UM ESPAÇO
router.put("/spaces/update/:id", async function (req, res) {
  try {
    // transforma o id em inteiro e verifica se é valido
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "informe um valor valido" });
    }

    // só os campos que vierem no body são alterados, o resto continua igual
    const {
      name,
      type,
      capacity,
      description,
      terms_of_use,
      buffer_minutes,
      is_active,
    } = req.body;

    //se não vier nenhum campo, retorna erro
    if (
      name === undefined &&
      type === undefined &&
      capacity === undefined &&
      description === undefined &&
      terms_of_use === undefined &&
      buffer_minutes === undefined &&
      is_active === undefined
    ) {
      return res
        .status(400)
        .json({ erro: "informe pelo menos um campo para alterar" });
    }

    // se mandar capacity, verifica se é valida
    let capacidade = null;
    if (capacity !== undefined) {
      capacidade = Number(capacity);
      if (!Number.isInteger(capacidade) || capacidade <= 0) {
        return res.status(400).json({ erro: "informe uma capacity valida" });
      }
    }

    // se mandar buffer_minutes, verifica se é valido
    let buffer = null;
    if (buffer_minutes !== undefined) {
      buffer = Number(buffer_minutes);
      if (!Number.isInteger(buffer) || buffer < 0) {
        return res
          .status(400)
          .json({ erro: "informe um buffer_minutes valido" });
      }
    }

    // se mandar is_active, tem que ser true ou false
    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({ erro: "is_active deve ser true ou false" });
    }

    // COALESCE pega o primeiro valor que não for nulo:
    // se o campo não veio (null), mantém o valor que já estava no banco
    const resultado = await pool.query(
      `UPDATE spaces SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        capacity = COALESCE($3, capacity),
        description = COALESCE($4, description),
        terms_of_use = COALESCE($5, terms_of_use),
        buffer_minutes = COALESCE($6, buffer_minutes),
        is_active = COALESCE($7, is_active)
     WHERE id = $8
     RETURNING ${COLUNAS}`,
      [
        name ?? null,
        type ?? null,
        capacidade,
        description ?? null,
        terms_of_use ?? null,
        buffer,
        is_active ?? null,
        id,
      ],
    );

    //retorna o erro se n tiver linhas
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "nenhum espaço encontrado" });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /spaces/delete/{id}:
 *   delete:
 *     summary: Deleta um espaço
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Espaço deletado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Espaco'
 *       400:
 *         description: Id inválido ou espaço com reservas/bloqueios ligados a ele
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */
//DELETA UM ESPAÇO
router.delete("/spaces/delete/:id", async function (req, res) {
  try {
    // transforma o id em inteiro e verifica se é valido
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "informe um valor valido" });
    }

    // deleta o espaço pelo id e retorna o espaço deletado
    const resultado = await pool.query(
      `DELETE FROM spaces WHERE id = $1 RETURNING ${COLUNAS}`,
      [id],
    );

    //retorna o erro se n tiver linhas
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: "nenhum espaço encontrado" });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    // espaço com reservas/bloqueios ligados (23503) cai aqui
    responderErro(res, err);
  }
});

// Equipamentos vinculados ao espaço (cadastro/edição no modal de espaços).
router.get("/spaces/:id/equipment", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ erro: "Informe um id válido." });
  try {
    const result = await pool.query(
      "SELECT id, space_id, name, description, quantity FROM equipment WHERE space_id = $1 ORDER BY name",
      [id],
    );
    return res.json(result.rows);
  } catch (err) {
    return responderErro(res, err);
  }
});

//lista de equipamentos do espaço.
router.put("/spaces/:id/equipment", async (req, res) => {
  const id = Number(req.params.id);
  const items = req.body?.equipment;
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ erro: "Informe um id válido." });
  if (!Array.isArray(items))
    return res.status(400).json({ erro: "equipment deve ser uma lista." });
  for (const item of items) {
    if (!item.name || !String(item.name).trim())
      return res
        .status(400)
        .json({ erro: "O nome de cada equipamento é obrigatório." });
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 0)
      return res.status(400).json({
        erro: "A quantidade deve ser um inteiro maior ou igual a zero.",
      });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exists = await client.query("SELECT id FROM spaces WHERE id = $1", [
      id,
    ]);
    if (!exists.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Espaço não encontrado." });
    }
    await client.query("DELETE FROM equipment WHERE space_id = $1", [id]);
    for (const item of items) {
      await client.query(
        "INSERT INTO equipment (space_id, name, description, quantity) VALUES ($1, $2, $3, $4)",
        [
          id,
          String(item.name).trim(),
          item.description || null,
          Number(item.quantity ?? 1),
        ],
      );
    }
    const result = await client.query(
      "SELECT id, space_id, name, description, quantity FROM equipment WHERE space_id = $1 ORDER BY name",
      [id],
    );
    await client.query("COMMIT");
    return res.json(result.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    return responderErro(res, err);
  } finally {
    client.release();
  }
});

// Retorna os horários semanais em que um espaço pode ser reservado.
router.get("/spaces/:id/availability", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "Informe um id válido." });
  }
  try {
    const result = await pool.query(
      `SELECT day_of_week, start_time, end_time, is_external_allowed
         FROM space_availability
        WHERE space_id = $1
        ORDER BY day_of_week, start_time`,
      [id],
    );
    return res.json(result.rows);
  } catch (err) {
    return responderErro(res, err);
  }
});

/**
 * @swagger
 * /spaces/{id}/availability:
 *   put:
 *     summary: Salva os horários de funcionamento de um espaço
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - availability
 *             properties:
 *               availability:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day_of_week:
 *                       type: integer
 *                       description: Dia da semana, de 0 (domingo) a 6 (sábado)
 *                     start_time:
 *                       type: string
 *                       example: "08:00"
 *                     end_time:
 *                       type: string
 *                       example: "18:00"
 *                     is_external_allowed:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Horários salvos
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Espaço não encontrado
 *       500:
 *         description: Erro interno
 */
router.put("/spaces/:id/availability", async (req, res) => {
  const id = Number(req.params.id);
  const horarios = req.body?.availability;

  // Valida o ID do espaço.
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      erro: "Informe um id válido.",
    });
  }

  // Confere se a tela enviou uma lista de horários.
  if (!Array.isArray(horarios)) {
    return res.status(400).json({
      erro: "availability deve ser uma lista.",
    });
  }

  // Valida os horários antes de alterar o banco.
  const diasRecebidos = new Set();

  for (const horario of horarios) {
    const dia = Number(horario.day_of_week);
    const inicio = horario.start_time;
    const fim = horario.end_time;

    if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
      return res.status(400).json({
        erro: "day_of_week deve ser um número de 0 a 6.",
      });
    }

    if (diasRecebidos.has(dia)) {
      return res.status(400).json({
        erro: "Não envie mais de um horário para o mesmo dia.",
      });
    }

    diasRecebidos.add(dia);

    const formatoHora = /^\d{2}:\d{2}$/;

    if (
      typeof inicio !== "string" ||
      typeof fim !== "string" ||
      !formatoHora.test(inicio) ||
      !formatoHora.test(fim) ||
      inicio >= fim
    ) {
      return res.status(400).json({
        erro: "Informe horários válidos; o fim deve ser depois do início.",
      });
    }

    if (typeof horario.is_external_allowed !== "boolean") {
      return res.status(400).json({
        erro: "is_external_allowed deve ser true ou false.",
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Confere se o espaço existe.
    const espaco = await client.query("SELECT id FROM spaces WHERE id = $1", [
      id,
    ]);

    if (espaco.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        erro: "Espaço não encontrado.",
      });
    }

    // Apaga os horários antigos desse espaço.
    await client.query("DELETE FROM space_availability WHERE space_id = $1", [
      id,
    ]);

    // Salva os horários enviados pelo formulário.
    for (const horario of horarios) {
      await client.query(
        `INSERT INTO space_availability
          (space_id, day_of_week, start_time, end_time, is_external_allowed)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          Number(horario.day_of_week),
          horario.start_time,
          horario.end_time,
          horario.is_external_allowed,
        ],
      );
    }

    // Busca os horários salvos para devolver à tela.
    const resultado = await client.query(
      `SELECT day_of_week, start_time, end_time, is_external_allowed
       FROM space_availability
       WHERE space_id = $1
       ORDER BY day_of_week, start_time`,
      [id],
    );

    await client.query("COMMIT");

    return res.json(resultado.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    return responderErro(res, err);
  } finally {
    client.release();
  }
});

module.exports = router;
