// =====================================================================
// rotas de equipamentos da reserva
//
// rotas:
//   get    /reservas-equipamentos                                        -> lista todos
//   get    /reservas-equipamentos/nome/:nome                             -> busca pelo equipamento, espaco ou cliente
//   get    /reservas-equipamentos/reserva/:booking_id                    -> equipamentos de uma reserva
//   get    /reservas-equipamentos/equipamento/:equipment_id              -> reservas que usam um equipamento
//   get    /reservas-equipamentos/reserva/:booking_id/equipamento/:equipment_id -> um item
//   post   /reservas-equipamentos                                        -> adiciona um equipamento na reserva
//   put    /reservas-equipamentos/reserva/:booking_id/equipamento/:equipment_id -> muda a quantidade
//   delete /reservas-equipamentos/reserva/:booking_id/equipamento/:equipment_id -> tira o equipamento da reserva
//
// cadastro dos equipamentos de cada espaco (o equipamento fica vinculado ao espaco):
//   get    /reservas-equipamentos/equipamentos                  -> lista todos
//   get    /reservas-equipamentos/equipamentos/espaco/:space_id -> equipamentos de um espaco
//   get    /reservas-equipamentos/equipamentos/:id              -> busca um
//   post   /reservas-equipamentos/equipamentos                 -> cadastra um equipamento num espaco
//   post   /reservas-equipamentos/equipamentos/lote            -> cadastra varios de uma vez (cadastro do espaco)
//   put    /reservas-equipamentos/equipamentos/:id              -> atualiza nome, descricao e estoque
//   delete /reservas-equipamentos/equipamentos/:id              -> exclui
// =====================================================================

// conexao com o banco
const express = require("express");
const { pool } = require("../config/db");
const { responderErro, semAcento } = require("../utils/banco");

const router = express.Router();

const FUSO = "America/Sao_Paulo";

// formata uma data/hora do banco como "2026-10-19t09:00" no horario de brasilia
const local = (coluna) =>
  `to_char((${coluna}) AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI')`;

// colunas devolvidas pela api: junta o item com o equipamento, a reserva, o espaco e o cliente
// (os ids sao bigint no banco; o ::int faz eles virem como numero, e nao como texto)
const COLUNAS = `be.booking_id::int AS booking_id, be.equipment_id::int AS equipment_id,
                 be.quantity, e.name AS equipment_name, e.quantity AS equipment_stock,
                 b.space_id::int AS space_id, s.name AS space_name,
                 b.user_id::int AS user_id, u.name AS user_name,
                 b.status AS booking_status,
                 ${local("b.start_datetime")} AS start_datetime,
                 ${local("b.end_datetime")}   AS end_datetime`;
const FROM = `FROM booking_equipment be
              JOIN equipment e ON e.id = be.equipment_id
              JOIN bookings b  ON b.id = be.booking_id
              JOIN spaces s    ON s.id = b.space_id
              JOIN users u     ON u.id = b.user_id`;
const ORDEM = "ORDER BY b.start_datetime, be.booking_id, e.name";

// busca um item pelos dois ids (undefined se nao achar)
async function buscarUm(bookingId, equipmentId) {
  const resultado = await pool.query(
    `SELECT ${COLUNAS} ${FROM} WHERE be.booking_id = $1 AND be.equipment_id = $2`,
    [bookingId, equipmentId],
  );
  return resultado.rows[0];
}

// confere se o valor e um id valido (numero inteiro maior que zero)
function idValido(valor) {
  return Number.isInteger(valor) && valor >= 1;
}

// confere os dados enviados; devolve { status, erro } se tiver problema ou null se estiver tudo certo
// (se a reserva e o equipamento existem, quem confere e a funcao conferirRegras, mais abaixo)
function validar(dados) {
  if (!idValido(dados.booking_id))
    return { status: 400, erro: "booking_id precisa ser o id de uma reserva" };
  if (!idValido(dados.equipment_id))
    return {
      status: 400,
      erro: "equipment_id precisa ser o id de um equipamento",
    };
  if (!Number.isInteger(dados.quantity) || dados.quantity < 1)
    return {
      status: 400,
      erro: "quantity precisa ser um número inteiro maior que zero",
    };
  return null;
}

// confere os ids que vem na url (nas rotas sem corpo)
function validarIds(bookingId, equipmentId) {
  if (!idValido(bookingId)) return { status: 400, erro: "booking_id inválido" };
  if (!idValido(equipmentId))
    return { status: 400, erro: "equipment_id inválido" };
  return null;
}

// regras de negocio do pedido de equipamento (post e put)
async function conferirRegras(dados) {
  // 1) a reserva existe e ainda esta ativa?
  const reserva = await pool.query(
    "SELECT space_id, status FROM bookings WHERE id = $1",
    [dados.booking_id],
  );
  if (reserva.rows.length === 0)
    return { status: 400, erro: "A reserva informada (booking_id) não existe" };
  const { space_id, status } = reserva.rows[0];
  if (status !== "PENDING" && status !== "APPROVED") {
    return {
      status: 409,
      erro: `Não é possível alterar os equipamentos de uma reserva ${status} (só reservas pendentes ou aprovadas)`,
    };
  }

  // 2) o equipamento existe e e do espaco da reserva?
  const equipamento = await pool.query(
    "SELECT space_id, name, quantity FROM equipment WHERE id = $1",
    [dados.equipment_id],
  );
  if (equipamento.rows.length === 0)
    return {
      status: 400,
      erro: "O equipamento informado (equipment_id) não existe",
    };
  const { name, quantity: estoque } = equipamento.rows[0];
  if (equipamento.rows[0].space_id !== space_id) {
    return {
      status: 400,
      erro: `O equipamento "${name}" não pertence ao espaço dessa reserva`,
    };
  }

  // 3) cabe no estoque?
  if (dados.quantity > estoque) {
    return {
      status: 409,
      erro: `Quantidade pedida (${dados.quantity}) maior que o estoque de "${name}" (${estoque})`,
    };
  }

  return null;
}

// erros do banco que tem mensagem propria nesta tabela
function responderErroItem(res, err) {
  if (err.code === "23505")
    return res.status(409).json({
      erro: "Esse equipamento já está nessa reserva. Use PUT para mudar a quantidade",
    });
  responderErro(res, err);
}

/**
 * @swagger
 * tags:
 *   name: Equipamentos da reserva
 *   description: Equipamentos e insumos pedidos em cada reserva (tabela booking_equipment)
 *
 * components:
 *   schemas:
 *     EquipamentoDaReserva:
 *       type: object
 *       properties:
 *         booking_id:
 *           type: integer
 *           example: 15
 *         equipment_id:
 *           type: integer
 *           example: 3
 *         quantity:
 *           type: integer
 *           description: Quantas unidades foram pedidas nesta reserva
 *           example: 2
 *         equipment_name:
 *           type: string
 *           example: Osciloscópio digital
 *         equipment_stock:
 *           type: integer
 *           description: Estoque total do equipamento
 *           example: 4
 *         space_id:
 *           type: integer
 *           example: 3
 *         space_name:
 *           type: string
 *           example: Laboratório de Eletrônica
 *         user_id:
 *           type: integer
 *           example: 5
 *         user_name:
 *           type: string
 *           description: Solicitante da reserva
 *           example: Carla Souza
 *         booking_status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *           example: PENDING
 *         start_datetime:
 *           type: string
 *           description: Início da reserva (horário de Brasília)
 *           example: "2026-10-19T13:00"
 *         end_datetime:
 *           type: string
 *           example: "2026-10-19T16:00"
 *     EquipamentoDaReservaInput:
 *       type: object
 *       required:
 *         - booking_id
 *         - equipment_id
 *       properties:
 *         booking_id:
 *           type: integer
 *           example: 14
 *         equipment_id:
 *           type: integer
 *           description: Precisa ser um equipamento do mesmo espaço da reserva
 *           example: 2
 *         quantity:
 *           type: integer
 *           description: Padrão 1
 *           example: 1
 *     QuantidadeInput:
 *       type: object
 *       required:
 *         - quantity
 *       properties:
 *         quantity:
 *           type: integer
 *           example: 3
 */

/**
 * @swagger
 * /reservas-equipamentos:
 *   get:
 *     summary: Lista todos os equipamentos pedidos em reservas
 *     tags: [Equipamentos da reserva]
 *     responses:
 *       200:
 *         description: Lista ordenada pelo início da reserva
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EquipamentoDaReserva'
 */
router.get("/", async function (req, res) {
  try {
    const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} ${ORDEM}`);
    res.json(resultado.rows);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/nome/{nome}:
 *   get:
 *     summary: Busca pelo nome do equipamento, do espaço ou do cliente
 *     description: Busca parcial, ignorando maiúsculas/minúsculas e acentos.
 *     tags: [Equipamentos da reserva]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: osciloscopio
 *     responses:
 *       200:
 *         description: Itens encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EquipamentoDaReserva'
 *       404:
 *         description: Nenhum item encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/nome/:nome", async function (req, res) {
  try {
    // o texto vai no $1 (protege contra sql injection)
    const resultado = await pool.query(
      `SELECT ${COLUNAS} ${FROM}
              WHERE ${semAcento("e.name")} LIKE ${semAcento("$1")}
                 OR ${semAcento("s.name")} LIKE ${semAcento("$1")}
                 OR ${semAcento("u.name")} LIKE ${semAcento("$1")}
              ${ORDEM}`,
      ["%" + req.params.nome + "%"],
    );

    if (resultado.rows.length === 0)
      return res.status(404).json({
        erro: "Nenhum equipamento de reserva encontrado com esse nome",
      });

    res.json(resultado.rows);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/reserva/{booking_id}:
 *   get:
 *     summary: Equipamentos pedidos em uma reserva
 *     description: Lista vazia quando a reserva existe mas não pediu equipamentos.
 *     tags: [Equipamentos da reserva]
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *     responses:
 *       200:
 *         description: Equipamentos da reserva
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EquipamentoDaReserva'
 *       400:
 *         description: booking_id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: A reserva não existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/reserva/:booking_id", async function (req, res) {
  const bookingId = Number(req.params.booking_id);
  if (!idValido(bookingId))
    return res.status(400).json({ erro: "booking_id inválido" });

  try {
    // reserva sem equipamentos e normal (lista vazia); reserva que nao existe e 404
    const reserva = await pool.query("SELECT 1 FROM bookings WHERE id = $1", [
      bookingId,
    ]);
    if (reserva.rows.length === 0)
      return res.status(404).json({ erro: "Reserva não encontrada" });

    const resultado = await pool.query(
      `SELECT ${COLUNAS} ${FROM} WHERE be.booking_id = $1 ORDER BY e.name`,
      [bookingId],
    );
    res.json(resultado.rows);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/equipamento/{equipment_id}:
 *   get:
 *     summary: Reservas que pediram um equipamento
 *     description: Lista vazia quando o equipamento existe mas nenhuma reserva o pediu.
 *     tags: [Equipamentos da reserva]
 *     parameters:
 *       - in: path
 *         name: equipment_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Reservas que usam o equipamento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EquipamentoDaReserva'
 *       400:
 *         description: equipment_id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: O equipamento não existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/equipamento/:equipment_id", async function (req, res) {
  const equipmentId = Number(req.params.equipment_id);
  if (!idValido(equipmentId))
    return res.status(400).json({ erro: "equipment_id inválido" });

  try {
    const equipamento = await pool.query(
      "SELECT 1 FROM equipment WHERE id = $1",
      [equipmentId],
    );
    if (equipamento.rows.length === 0)
      return res.status(404).json({ erro: "Equipamento não encontrado" });

    const resultado = await pool.query(
      `SELECT ${COLUNAS} ${FROM} WHERE be.equipment_id = $1 ${ORDEM}`,
      [equipmentId],
    );
    res.json(resultado.rows);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/reserva/{booking_id}/equipamento/{equipment_id}:
 *   get:
 *     summary: Busca um item (um equipamento de uma reserva)
 *     tags: [Equipamentos da reserva]
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *       - in: path
 *         name: equipment_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Item encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipamentoDaReserva'
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Essa reserva não pediu esse equipamento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get(
  "/reserva/:booking_id/equipamento/:equipment_id",
  async function (req, res) {
    const bookingId = Number(req.params.booking_id);
    const equipmentId = Number(req.params.equipment_id);

    const problema = validarIds(bookingId, equipmentId);
    if (problema)
      return res.status(problema.status).json({ erro: problema.erro });

    try {
      const item = await buscarUm(bookingId, equipmentId);
      if (!item)
        return res
          .status(404)
          .json({ erro: "Essa reserva não pediu esse equipamento" });

      res.json(item);
    } catch (err) {
      responderErro(res, err);
    }
  },
);

/**
 * @swagger
 * /reservas-equipamentos:
 *   post:
 *     summary: Adiciona um equipamento a uma reserva
 *     description: |
 *       Regras: a reserva precisa estar pendente ou aprovada; o equipamento precisa ser do mesmo espaço da reserva;
 *       a quantidade não pode passar do estoque do equipamento; o mesmo equipamento só entra uma vez por reserva
 *       (para mudar a quantidade, use PUT).
 *     tags: [Equipamentos da reserva]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EquipamentoDaReservaInput'
 *     responses:
 *       201:
 *         description: Equipamento adicionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipamentoDaReserva'
 *       400:
 *         description: Dados inválidos, reserva ou equipamento inexistente, ou equipamento de outro espaço
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Reserva recusada/cancelada, equipamento já na reserva ou quantidade acima do estoque
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/", async function (req, res) {
  const { booking_id, equipment_id, quantity } = req.body;

  // quantity e opcional (padrao 1, igual ao default da tabela)
  const dados = {
    booking_id: Number(booking_id),
    equipment_id: Number(equipment_id),
    quantity:
      quantity !== undefined && quantity !== null ? Number(quantity) : 1,
  };

  // 1) valida o formato; se tiver problema, ja responde 400 e para aqui
  const problema = validar(dados);
  if (problema)
    return res.status(problema.status).json({ erro: problema.erro });

  try {
    // 2) regras de negocio: reserva ativa, equipamento do mesmo espaco, quantidade dentro do estoque
    const barrado = await conferirRegras(dados);
    if (barrado) return res.status(barrado.status).json({ erro: barrado.erro });

    // 3) grava no banco; $1...$3 sao trocados pelos valores da lista (protege contra sql injection)
    await pool.query(
      "INSERT INTO booking_equipment (booking_id, equipment_id, quantity) VALUES ($1, $2, $3)",
      [dados.booking_id, dados.equipment_id, dados.quantity],
    );

    res.status(201).json(await buscarUm(dados.booking_id, dados.equipment_id)); // 201 = criado
  } catch (err) {
    responderErroItem(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/reserva/{booking_id}/equipamento/{equipment_id}:
 *   put:
 *     summary: Muda a quantidade de um equipamento da reserva
 *     description: Só a quantidade pode mudar. Para trocar de equipamento, remova este e adicione o outro. As mesmas regras do POST valem aqui.
 *     tags: [Equipamentos da reserva]
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *       - in: path
 *         name: equipment_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuantidadeInput'
 *     responses:
 *       200:
 *         description: Quantidade atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipamentoDaReserva'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Essa reserva não pediu esse equipamento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Reserva recusada/cancelada ou quantidade acima do estoque
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.put(
  "/reserva/:booking_id/equipamento/:equipment_id",
  async function (req, res) {
    const dados = {
      booking_id: Number(req.params.booking_id),
      equipment_id: Number(req.params.equipment_id),
      quantity: Number(req.body.quantity),
    };

    // aqui a quantidade e obrigatoria: e a unica coisa que o put muda
    if (req.body.quantity === undefined)
      return res
        .status(400)
        .json({ erro: "Informe a nova quantidade (quantity)" });

    const problema = validar(dados);
    if (problema)
      return res.status(problema.status).json({ erro: problema.erro });

    try {
      const atual = await buscarUm(dados.booking_id, dados.equipment_id);
      if (!atual)
        return res
          .status(404)
          .json({ erro: "Essa reserva não pediu esse equipamento" });

      const barrado = await conferirRegras(dados);
      if (barrado)
        return res.status(barrado.status).json({ erro: barrado.erro });

      await pool.query(
        "UPDATE booking_equipment SET quantity = $3 WHERE booking_id = $1 AND equipment_id = $2",
        [dados.booking_id, dados.equipment_id, dados.quantity],
      );

      res.json(await buscarUm(dados.booking_id, dados.equipment_id));
    } catch (err) {
      responderErroItem(res, err);
    }
  },
);

/**
 * @swagger
 * /reservas-equipamentos/reserva/{booking_id}/equipamento/{equipment_id}:
 *   delete:
 *     summary: Tira um equipamento da reserva
 *     tags: [Equipamentos da reserva]
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *       - in: path
 *         name: equipment_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Item removido (devolve o que foi apagado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipamentoDaReserva'
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Essa reserva não pediu esse equipamento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete(
  "/reserva/:booking_id/equipamento/:equipment_id",
  async function (req, res) {
    const bookingId = Number(req.params.booking_id);
    const equipmentId = Number(req.params.equipment_id);

    const problema = validarIds(bookingId, equipmentId);
    if (problema)
      return res.status(problema.status).json({ erro: problema.erro });

    try {
      // busca antes de apagar para poder devolver o item (o delete nao enxerga os joins)
      const item = await buscarUm(bookingId, equipmentId);
      if (!item)
        return res
          .status(404)
          .json({ erro: "Essa reserva não pediu esse equipamento" });

      await pool.query(
        "DELETE FROM booking_equipment WHERE booking_id = $1 AND equipment_id = $2",
        [bookingId, equipmentId],
      );

      res.json(item);
    } catch (err) {
      responderErro(res, err);
    }
  },
);

// colunas devolvidas pelas rotas de equipamento (o ::int faz o id vir como numero)
const COLUNAS_EQUIPAMENTO = `e.id::int AS id, e.space_id::int AS space_id, s.name AS space_name,
                             e.name, e.description, e.quantity`;
const FROM_EQUIPAMENTO = `FROM equipment e JOIN spaces s ON s.id = e.space_id`;
const ORDEM_EQUIPAMENTO = "ORDER BY s.name, e.name";

// busca um equipamento pelo id (undefined se nao achar)
async function buscarEquipamento(id) {
  const resultado = await pool.query(
    `SELECT ${COLUNAS_EQUIPAMENTO} ${FROM_EQUIPAMENTO} WHERE e.id = $1`,
    [id],
  );
  return resultado.rows[0];
}

// confere se o espaco existe ("db" pode ser o pool ou a conexao de uma transacao)
async function espacoExiste(db, id) {
  const resultado = await db.query("SELECT 1 FROM spaces WHERE id = $1", [id]);
  return resultado.rows.length > 0;
}

// texto opcional: vazio vira null
function textoOuNulo(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

// le name, description e quantity do corpo; quantity e opcional (padrao 1, igual ao default da tabela)
function lerEquipamento(corpo) {
  return {
    name: typeof corpo.name === "string" ? corpo.name.trim() : "",
    description: textoOuNulo(corpo.description),
    quantity:
      corpo.quantity !== undefined && corpo.quantity !== null
        ? Number(corpo.quantity)
        : 1,
  };
}

// confere os dados do equipamento; devolve { status, erro } se tiver problema ou null se estiver tudo certo
function validarEquipamento(dados) {
  if (!dados.name) return { status: 400, erro: "name é obrigatório" };
  if (dados.name.length > 120)
    return { status: 400, erro: "name pode ter no máximo 120 caracteres" };
  if (!Number.isInteger(dados.quantity) || dados.quantity < 0)
    return {
      status: 400,
      erro: "quantity precisa ser um número inteiro maior ou igual a zero",
    };
  return null;
}

// grava um equipamento e devolve o id dele ("db" pode ser o pool ou a conexao de uma transacao)
async function inserirEquipamento(db, spaceId, dados) {
  const resultado = await db.query(
    "INSERT INTO equipment (space_id, name, description, quantity) VALUES ($1, $2, $3, $4) RETURNING id::int AS id",
    [spaceId, dados.name, dados.description, dados.quantity],
  );
  return resultado.rows[0].id;
}

// erros do banco que tem mensagem propria no cadastro de equipamentos
//   23505 = nome repetido no mesmo espaco -> 409
//   23503 = equipamento ja pedido em alguma reserva (chave estrangeira) -> 409
function responderErroEquipamento(res, err) {
  if (err.code === "23505")
    return res
      .status(409)
      .json({ erro: "Esse espaço já tem um equipamento com esse nome" });
  if (err.code === "23503")
    return res.status(409).json({
      erro: "Esse equipamento já foi pedido em reservas e não pode ser excluído. Coloque o estoque em 0 para tirá-lo de uso",
    });
  responderErro(res, err);
}

/**
 * @swagger
 * tags:
 *   name: Equipamentos
 *   description: Cadastro de equipamentos e insumos de cada espaço (tabela equipment)
 *
 * components:
 *   schemas:
 *     Equipamento:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         space_id:
 *           type: integer
 *           example: 3
 *         space_name:
 *           type: string
 *           example: Laboratório de Eletrônica
 *         name:
 *           type: string
 *           example: Osciloscópio digital
 *         description:
 *           type: string
 *           nullable: true
 *           example: Osciloscópio de 2 canais, 100 MHz
 *         quantity:
 *           type: integer
 *           description: Estoque total (quantas unidades o espaço tem)
 *           example: 4
 *     EquipamentoInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         space_id:
 *           type: integer
 *           description: Obrigatório no POST. Não pode ser trocado no PUT
 *           example: 3
 *         name:
 *           type: string
 *           description: Único dentro do espaço
 *           example: Osciloscópio digital
 *         description:
 *           type: string
 *           example: Osciloscópio de 2 canais, 100 MHz
 *         quantity:
 *           type: integer
 *           description: Estoque total. No POST o padrão é 1; no PUT é obrigatório
 *           example: 4
 *     EquipamentoLoteInput:
 *       type: object
 *       required:
 *         - space_id
 *         - equipamentos
 *       properties:
 *         space_id:
 *           type: integer
 *           example: 3
 *         equipamentos:
 *           type: array
 *           description: De 1 a 50 equipamentos
 *           items:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kit de solda
 *               description:
 *                 type: string
 *                 example: Ferro de solda, estanho e suporte
 *               quantity:
 *                 type: integer
 *                 example: 5
 */

/**
 * @swagger
 * /reservas-equipamentos/equipamentos:
 *   get:
 *     summary: Lista todos os equipamentos cadastrados
 *     tags: [Equipamentos]
 *     responses:
 *       200:
 *         description: Lista ordenada pelo nome do espaço e do equipamento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Equipamento'
 */
router.get("/equipamentos", async function (req, res) {
  try {
    const resultado = await pool.query(
      `SELECT ${COLUNAS_EQUIPAMENTO} ${FROM_EQUIPAMENTO} ${ORDEM_EQUIPAMENTO}`,
    );
    res.json(resultado.rows);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/equipamentos/espaco/{space_id}:
 *   get:
 *     summary: Equipamentos de um espaço
 *     description: Lista vazia quando o espaço existe mas não tem equipamentos.
 *     tags: [Equipamentos]
 *     parameters:
 *       - in: path
 *         name: space_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Equipamentos do espaço
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Equipamento'
 *       400:
 *         description: space_id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: O espaço não existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/equipamentos/espaco/:space_id", async function (req, res) {
  const spaceId = Number(req.params.space_id);
  if (!idValido(spaceId))
    return res.status(400).json({ erro: "space_id inválido" });

  try {
    if (!(await espacoExiste(pool, spaceId)))
      return res.status(404).json({ erro: "Espaço não encontrado" });

    const resultado = await pool.query(
      `SELECT ${COLUNAS_EQUIPAMENTO} ${FROM_EQUIPAMENTO} WHERE e.space_id = $1 ORDER BY e.name`,
      [spaceId],
    );
    res.json(resultado.rows);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/equipamentos/{id}:
 *   get:
 *     summary: Busca um equipamento pelo id
 *     tags: [Equipamentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Equipamento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Equipamento'
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Equipamento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/equipamentos/:id", async function (req, res) {
  const id = Number(req.params.id);
  if (!idValido(id)) return res.status(400).json({ erro: "id inválido" });

  try {
    const equipamento = await buscarEquipamento(id);
    if (!equipamento)
      return res.status(404).json({ erro: "Equipamento não encontrado" });

    res.json(equipamento);
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/equipamentos:
 *   post:
 *     summary: Cadastra um equipamento em um espaço
 *     description: O nome não pode se repetir dentro do mesmo espaço. Para cadastrar vários de uma vez (ex junto com o espaço), use /equipamentos/lote.
 *     tags: [Equipamentos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EquipamentoInput'
 *     responses:
 *       201:
 *         description: Equipamento cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Equipamento'
 *       400:
 *         description: Dados inválidos ou espaço inexistente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: O espaço já tem um equipamento com esse nome
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/equipamentos", async function (req, res) {
  const spaceId = Number(req.body.space_id);
  if (!idValido(spaceId))
    return res
      .status(400)
      .json({ erro: "space_id precisa ser o id de um espaço" });

  const dados = lerEquipamento(req.body);
  const problema = validarEquipamento(dados);
  if (problema)
    return res.status(problema.status).json({ erro: problema.erro });

  try {
    if (!(await espacoExiste(pool, spaceId)))
      return res
        .status(400)
        .json({ erro: "O espaço informado (space_id) não existe" });

    const id = await inserirEquipamento(pool, spaceId, dados);

    res.status(201).json(await buscarEquipamento(id)); // 201 = criado
  } catch (err) {
    responderErroEquipamento(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/equipamentos/lote:
 *   post:
 *     summary: Cadastra vários equipamentos de um espaço de uma vez
 *     description: |
 *       Pensado para o cadastro do espaço: depois de criar o espaço (POST /spaces), o front manda a lista de equipamentos
 *       com o id dele. É tudo ou nada: se um item for inválido ou repetir nome, nenhum é cadastrado.
 *     tags: [Equipamentos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EquipamentoLoteInput'
 *     responses:
 *       201:
 *         description: Equipamentos cadastrados (na mesma ordem enviada)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Equipamento'
 *       400:
 *         description: Dados inválidos ou espaço inexistente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Nome repetido no espaço
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/equipamentos/lote", async function (req, res) {
  const spaceId = Number(req.body.space_id);
  if (!idValido(spaceId))
    return res
      .status(400)
      .json({ erro: "space_id precisa ser o id de um espaço" });

  const lista = req.body.equipamentos;
  if (!Array.isArray(lista) || lista.length === 0)
    return res.status(400).json({
      erro: "equipamentos precisa ser uma lista com pelo menos um item",
    });
  if (lista.length > 50)
    return res
      .status(400)
      .json({ erro: "equipamentos pode ter no máximo 50 itens por vez" });

  // valida todos antes de gravar qualquer um
  const itens = [];
  for (let i = 0; i < lista.length; i++) {
    const dados = lerEquipamento(lista[i] || {});
    const problema = validarEquipamento(dados);
    if (problema)
      return res
        .status(problema.status)
        .json({ erro: `equipamentos[${i}]: ${problema.erro}` });
    itens.push(dados);
  }

  // transacao: se algum falhar, desfaz todos (begin ... commit; erro = rollback)
  const conexao = await pool.connect();
  try {
    if (!(await espacoExiste(conexao, spaceId)))
      return res
        .status(400)
        .json({ erro: "O espaço informado (space_id) não existe" });

    await conexao.query("BEGIN");
    const ids = [];
    for (const dados of itens)
      ids.push(await inserirEquipamento(conexao, spaceId, dados));
    await conexao.query("COMMIT");

    const criados = await pool.query(
      `SELECT ${COLUNAS_EQUIPAMENTO} ${FROM_EQUIPAMENTO} WHERE e.id = ANY($1::bigint[])`,
      [ids],
    );
    // devolve na mesma ordem em que foram enviados
    const porId = new Map(criados.rows.map((linha) => [linha.id, linha]));
    res.status(201).json(ids.map((id) => porId.get(id)));
  } catch (err) {
    await conexao.query("ROLLBACK").catch(() => {}); // sem transacao aberta o rollback e ignorado
    responderErroEquipamento(res, err);
  } finally {
    conexao.release(); // devolve a conexao para o pool
  }
});

/**
 * @swagger
 * /reservas-equipamentos/equipamentos/{id}:
 *   put:
 *     summary: Atualiza um equipamento
 *     description: Troca nome, descrição e estoque (o espaço não muda). O estoque não pode ficar abaixo do que uma reserva futura (pendente ou aprovada) já pediu.
 *     tags: [Equipamentos]
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
 *             $ref: '#/components/schemas/EquipamentoInput'
 *     responses:
 *       200:
 *         description: Equipamento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Equipamento'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Equipamento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Nome repetido no espaço ou estoque abaixo do que já foi pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.put("/equipamentos/:id", async function (req, res) {
  const id = Number(req.params.id);
  if (!idValido(id)) return res.status(400).json({ erro: "id inválido" });

  // aqui o estoque e obrigatorio: se faltasse, o valor padrao (1) mudaria o estoque sem querer
  if (req.body.quantity === undefined || req.body.quantity === null)
    return res.status(400).json({ erro: "Informe o estoque (quantity)" });

  const dados = lerEquipamento(req.body);
  const problema = validarEquipamento(dados);
  if (problema)
    return res.status(problema.status).json({ erro: problema.erro });

  try {
    const atual = await buscarEquipamento(id);
    if (!atual)
      return res.status(404).json({ erro: "Equipamento não encontrado" });

    // o estoque nao pode ficar menor que o maior pedido de uma reserva ativa que ainda nao terminou
    const pedido = await pool.query(
      `SELECT COALESCE(MAX(be.quantity), 0)::int AS maior
               FROM booking_equipment be
               JOIN bookings b ON b.id = be.booking_id
              WHERE be.equipment_id = $1
                AND b.status IN ('PENDING', 'APPROVED')
                AND b.end_datetime > now()`,
      [id],
    );
    const maior = pedido.rows[0].maior;
    if (dados.quantity < maior) {
      return res.status(409).json({
        erro: `O estoque (${dados.quantity}) ficaria menor que o pedido de ${maior} unidade(s) em uma reserva ativa`,
      });
    }

    await pool.query(
      "UPDATE equipment SET name = $2, description = $3, quantity = $4 WHERE id = $1",
      [id, dados.name, dados.description, dados.quantity],
    );

    res.json(await buscarEquipamento(id));
  } catch (err) {
    responderErroEquipamento(res, err);
  }
});

/**
 * @swagger
 * /reservas-equipamentos/equipamentos/{id}:
 *   delete:
 *     summary: Exclui um equipamento
 *     description: Só exclui equipamento que nunca foi pedido em uma reserva. Os outros devem ficar com estoque 0.
 *     tags: [Equipamentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Equipamento excluído (devolve o que foi apagado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Equipamento'
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Equipamento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Equipamento já foi pedido em reservas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete("/equipamentos/:id", async function (req, res) {
  const id = Number(req.params.id);
  if (!idValido(id)) return res.status(400).json({ erro: "id inválido" });

  try {
    // busca antes de apagar para poder devolver o item
    const equipamento = await buscarEquipamento(id);
    if (!equipamento)
      return res.status(404).json({ erro: "Equipamento não encontrado" });

    await pool.query("DELETE FROM equipment WHERE id = $1", [id]);

    res.json(equipamento);
  } catch (err) {
    responderErroEquipamento(res, err);
  }
});

module.exports = router;
