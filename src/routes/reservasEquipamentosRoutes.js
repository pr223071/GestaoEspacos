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
// =====================================================================

// conexao com o banco
const express = require("express");
const { pool } = require("../config/db");                          
const { responderErro, semAcento } = require("../utils/banco");

const router = express.Router();

const FUSO = "America/Sao_Paulo";

// formata uma data/hora do banco como "2026-10-19t09:00" no horario de brasilia
const local = coluna => `to_char((${coluna}) AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI')`;

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
        [bookingId, equipmentId]
    );
    return resultado.rows[0];
}

// confere os dados enviados; devolve { status, erro } se tiver problema ou null se estiver tudo certo
// (se a reserva e o equipamento existem, quem confere e a funcao conferirRegras, mais abaixo)
function validar(dados) {
    if (!Number.isInteger(dados.booking_id) || dados.booking_id < 1) return { status: 400, erro: "booking_id precisa ser o id de uma reserva" };
    if (!Number.isInteger(dados.equipment_id) || dados.equipment_id < 1) return { status: 400, erro: "equipment_id precisa ser o id de um equipamento" };
    if (!Number.isInteger(dados.quantity) || dados.quantity < 1) return { status: 400, erro: "quantity precisa ser um número inteiro maior que zero" };
    return null;
}

// confere os ids que vem na url (nas rotas sem corpo)
function validarIds(bookingId, equipmentId) {
    if (!Number.isInteger(bookingId) || bookingId < 1) return { status: 400, erro: "booking_id inválido" };
    if (!Number.isInteger(equipmentId) || equipmentId < 1) return { status: 400, erro: "equipment_id inválido" };
    return null;
}

// regras de negocio do pedido de equipamento (post e put)
async function conferirRegras(dados) {
    // 1) a reserva existe e ainda esta ativa?
    const reserva = await pool.query("SELECT space_id, status FROM bookings WHERE id = $1", [dados.booking_id]);
    if (reserva.rows.length === 0) return { status: 400, erro: "A reserva informada (booking_id) não existe" };
    const { space_id, status } = reserva.rows[0];
    if (status !== "PENDING" && status !== "APPROVED") {
        return { status: 409, erro: `Não é possível alterar os equipamentos de uma reserva ${status} (só reservas pendentes ou aprovadas)` };
    }

    // 2) o equipamento existe e e do espaco da reserva?
    const equipamento = await pool.query("SELECT space_id, name, quantity FROM equipment WHERE id = $1", [dados.equipment_id]);
    if (equipamento.rows.length === 0) return { status: 400, erro: "O equipamento informado (equipment_id) não existe" };
    const { name, quantity: estoque } = equipamento.rows[0];
    if (equipamento.rows[0].space_id !== space_id) {
        return { status: 400, erro: `O equipamento "${name}" não pertence ao espaço dessa reserva` };
    }

    // 3) cabe no estoque?
    if (dados.quantity > estoque) {
        return { status: 409, erro: `Quantidade pedida (${dados.quantity}) maior que o estoque de "${name}" (${estoque})` };
    }

    return null;
}

// erros do banco que tem mensagem propria nesta tabela
function responderErroItem(res, err) {
    if (err.code === "23505") return res.status(409).json({ erro: "Esse equipamento já está nessa reserva. Use PUT para mudar a quantidade" });
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
            ["%" + req.params.nome + "%"]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhum equipamento de reserva encontrado com esse nome" });

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
    if (!Number.isInteger(bookingId) || bookingId < 1) return res.status(400).json({ erro: "booking_id inválido" });

    try {
        // reserva sem equipamentos e normal (lista vazia); reserva que nao existe e 404
        const reserva = await pool.query("SELECT 1 FROM bookings WHERE id = $1", [bookingId]);
        if (reserva.rows.length === 0) return res.status(404).json({ erro: "Reserva não encontrada" });

        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE be.booking_id = $1 ORDER BY e.name`, [bookingId]);
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
    if (!Number.isInteger(equipmentId) || equipmentId < 1) return res.status(400).json({ erro: "equipment_id inválido" });

    try {
        const equipamento = await pool.query("SELECT 1 FROM equipment WHERE id = $1", [equipmentId]);
        if (equipamento.rows.length === 0) return res.status(404).json({ erro: "Equipamento não encontrado" });

        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE be.equipment_id = $1 ${ORDEM}`, [equipmentId]);
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
router.get("/reserva/:booking_id/equipamento/:equipment_id", async function (req, res) {
    const bookingId = Number(req.params.booking_id);
    const equipmentId = Number(req.params.equipment_id);

    const problema = validarIds(bookingId, equipmentId);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        const item = await buscarUm(bookingId, equipmentId);
        if (!item) return res.status(404).json({ erro: "Essa reserva não pediu esse equipamento" });

        res.json(item);
    } catch (err) {
        responderErro(res, err);
    }
});


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
        quantity: quantity !== undefined && quantity !== null ? Number(quantity) : 1
    };

    // 1) valida o formato; se tiver problema, ja responde 400 e para aqui
    const problema = validar(dados);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        // 2) regras de negocio: reserva ativa, equipamento do mesmo espaco, quantidade dentro do estoque
        const barrado = await conferirRegras(dados);
        if (barrado) return res.status(barrado.status).json({ erro: barrado.erro });

        // 3) grava no banco; $1...$3 sao trocados pelos valores da lista (protege contra sql injection)
        await pool.query(
            "INSERT INTO booking_equipment (booking_id, equipment_id, quantity) VALUES ($1, $2, $3)",
            [dados.booking_id, dados.equipment_id, dados.quantity]
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
router.put("/reserva/:booking_id/equipamento/:equipment_id", async function (req, res) {
    const dados = {
        booking_id: Number(req.params.booking_id),
        equipment_id: Number(req.params.equipment_id),
        quantity: Number(req.body.quantity)
    };

    // aqui a quantidade e obrigatoria: e a unica coisa que o put muda
    if (req.body.quantity === undefined) return res.status(400).json({ erro: "Informe a nova quantidade (quantity)" });

    const problema = validar(dados);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        const atual = await buscarUm(dados.booking_id, dados.equipment_id);
        if (!atual) return res.status(404).json({ erro: "Essa reserva não pediu esse equipamento" });

        const barrado = await conferirRegras(dados);
        if (barrado) return res.status(barrado.status).json({ erro: barrado.erro });

        await pool.query(
            "UPDATE booking_equipment SET quantity = $3 WHERE booking_id = $1 AND equipment_id = $2",
            [dados.booking_id, dados.equipment_id, dados.quantity]
        );

        res.json(await buscarUm(dados.booking_id, dados.equipment_id));
    } catch (err) {
        responderErroItem(res, err);
    }
});


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
router.delete("/reserva/:booking_id/equipamento/:equipment_id", async function (req, res) {
    const bookingId = Number(req.params.booking_id);
    const equipmentId = Number(req.params.equipment_id);

    const problema = validarIds(bookingId, equipmentId);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        // busca antes de apagar para poder devolver o item (o delete nao enxerga os joins)
        const item = await buscarUm(bookingId, equipmentId);
        if (!item) return res.status(404).json({ erro: "Essa reserva não pediu esse equipamento" });

        await pool.query("DELETE FROM booking_equipment WHERE booking_id = $1 AND equipment_id = $2", [bookingId, equipmentId]);

        res.json(item);
    } catch (err) {
        responderErro(res, err);
    }
});


module.exports = router;
