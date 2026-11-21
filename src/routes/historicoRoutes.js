// =====================================================================
// rotas do historico de status das reservas
//
// rotas:
//   get /historico                      -> lista tudo (do mais antigo para o mais novo)
//   get /historico/nome/:nome           -> busca pelo nome do solicitante, do espaco ou de quem alterou
//   get /historico/data/:data           -> alteracoes feitas nessa data
//   get /historico/status/:status       -> alteracoes que levaram a reserva a esse status
//   get /historico/reserva/:booking_id  -> linha do tempo de uma reserva
//   get /historico/:id                  -> busca uma alteracao pelo id
// =====================================================================

 // conexao com o banco
const express = require("express");
const { pool } = require("../config/db");                         
const { responderErro, semAcento } = require("../utils/banco");

const router = express.Router();

const FUSO = "America/Sao_Paulo";

// os quatro status possiveis de uma reserva (mesmo enum do banco)
const STATUS_VALIDOS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

// formata uma data/hora do banco como "2026-10-19t09:00:00" no horario de brasilia
// aqui vai ate os segundos porque o historico e um registro de auditoria
const local = coluna => `to_char((${coluna}) AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI:SS')`;

// colunas devolvidas pela api: junta a alteracao com a reserva, o espaco, o solicitante
// e o usuario que fez a alteracao (left join porque changed_by pode ser nulo)
// (os ids sao bigint no banco; o ::int faz eles virem como numero, e nao como texto)
const COLUNAS = `h.id::int AS id, h.booking_id::int AS booking_id,
                 h.old_status, h.new_status,
                 h.changed_by::int AS changed_by, u.name AS changed_by_name,
                 h.justification,
                 ${local("h.changed_at")} AS changed_at,
                 s.name AS space_name, r.name AS user_name,
                 ${local("b.start_datetime")} AS booking_start,
                 ${local("b.end_datetime")}   AS booking_end`;
const FROM = `FROM booking_status_history h
              JOIN bookings b    ON b.id = h.booking_id
              JOIN spaces s      ON s.id = b.space_id
              JOIN users r       ON r.id = b.user_id
              LEFT JOIN users u  ON u.id = h.changed_by`;


/**
 * @swagger
 * tags:
 *   name: Histórico
 *   description: Histórico de mudanças de status das reservas (somente leitura, gravado automaticamente pelo banco)
 *
 * components:
 *   schemas:
 *     HistoricoStatus:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 12
 *         booking_id:
 *           type: integer
 *           example: 6
 *         old_status:
 *           type: string
 *           nullable: true
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *           description: Status anterior (null na criação da reserva)
 *           example: PENDING
 *         new_status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *           example: REJECTED
 *         changed_by:
 *           type: integer
 *           nullable: true
 *           description: Id do usuário que fez a alteração
 *           example: 1
 *         changed_by_name:
 *           type: string
 *           nullable: true
 *           example: Marina Gestora
 *         justification:
 *           type: string
 *           nullable: true
 *           description: Preenchida nas recusas (motivo informado ao solicitante)
 *           example: Uso de drones dentro do laboratório não é permitido pelo termo de uso.
 *         changed_at:
 *           type: string
 *           description: Quando houve a alteração (horário de Brasília)
 *           example: "2026-10-14T09:30:15"
 *         space_name:
 *           type: string
 *           example: Laboratório de Eletrônica
 *         user_name:
 *           type: string
 *           description: Solicitante da reserva
 *           example: Diego Pesquisador
 *         booking_start:
 *           type: string
 *           example: "2026-09-17T13:00"
 *         booking_end:
 *           type: string
 *           example: "2026-09-17T15:00"
 */


/**
 * @swagger
 * /historico:
 *   get:
 *     summary: Lista todo o histórico de status
 *     tags: [Histórico]
 *     responses:
 *       200:
 *         description: Lista ordenada da alteração mais antiga para a mais recente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HistoricoStatus'
 */
router.get("/", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} ORDER BY h.changed_at, h.id`);
        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /historico/nome/{nome}:
 *   get:
 *     summary: Busca pelo nome do solicitante, do espaço ou de quem alterou
 *     description: Busca parcial, ignorando maiúsculas/minúsculas e acentos.
 *     tags: [Histórico]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: marina
 *     responses:
 *       200:
 *         description: Alterações encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HistoricoStatus'
 *       404:
 *         description: Nenhuma alteração encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/nome/:nome", async function (req, res) {
    try {
        // procura no nome do solicitante, do espaco ou do usuario que alterou
        // o texto vai no $1 (protege contra sql injection)
        const resultado = await pool.query(
            `SELECT ${COLUNAS} ${FROM}
              WHERE ${semAcento("r.name")} LIKE ${semAcento("$1")}
                 OR ${semAcento("s.name")} LIKE ${semAcento("$1")}
                 OR ${semAcento("u.name")} LIKE ${semAcento("$1")}
              ORDER BY h.changed_at, h.id`,
            ["%" + req.params.nome + "%"]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma alteração encontrada com esse nome" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /historico/data/{data}:
 *   get:
 *     summary: Alterações de status feitas em uma data
 *     tags: [Histórico]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-10-13
 *     responses:
 *       200:
 *         description: Alterações feitas nessa data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HistoricoStatus'
 *       400:
 *         description: Data inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Nenhuma alteração nessa data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/data/:data", async function (req, res) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.data) || isNaN(new Date(req.params.data))) {
        return res.status(400).json({ erro: "Data inválida. Use o formato AAAA-MM-DD" });
    }

    try {
        // usa o momento da alteracao, convertido para o horario de brasilia
        const resultado = await pool.query(
            `SELECT ${COLUNAS} ${FROM}
              WHERE (h.changed_at AT TIME ZONE '${FUSO}')::date = $1
              ORDER BY h.changed_at, h.id`,
            [req.params.data]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma alteração nessa data" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /historico/status/{status}:
 *   get:
 *     summary: Alterações que levaram a reserva a um status
 *     description: Ex.- status REJECTED lista todas as recusas, com a justificativa de cada uma.
 *     tags: [Histórico]
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *         example: REJECTED
 *     responses:
 *       200:
 *         description: Alterações para esse status
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HistoricoStatus'
 *       400:
 *         description: Status inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Nenhuma alteração para esse status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/status/:status", async function (req, res) {
    const status = req.params.status.toUpperCase();
    if (!STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_VALIDOS.join(", ")}` });
    }

    try {
        const resultado = await pool.query(
            `SELECT ${COLUNAS} ${FROM} WHERE h.new_status = $1 ORDER BY h.changed_at, h.id`,
            [status]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma alteração para esse status" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /historico/reserva/{booking_id}:
 *   get:
 *     summary: Linha do tempo de uma reserva
 *     description: Todas as mudanças de status da reserva, da criação até o status atual.
 *     tags: [Histórico]
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 6
 *     responses:
 *       200:
 *         description: Histórico da reserva, em ordem cronológica
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HistoricoStatus'
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
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE h.booking_id = $1 ORDER BY h.changed_at, h.id`, [bookingId]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Reserva não encontrada (ou sem histórico)" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /historico/{id}:
 *   get:
 *     summary: Busca uma alteração de status pelo id
 *     tags: [Histórico]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Alteração encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HistoricoStatus'
 *       404:
 *         description: Alteração não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// esta rota fica por ultimo: se viesse antes, "/historico/nome" seria entendido como se "nome" fosse um id
router.get("/:id", async function (req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: "id inválido" });

    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE h.id = $1`, [id]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Alteração não encontrada" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


module.exports = router;
