const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const arquivo = path.join(__dirname, "..", "db", "reservations.json");

function lerReservas() {
    return JSON.parse(fs.readFileSync(arquivo, "utf-8"));
}

function salvarReservas(reservas) {
    fs.writeFileSync(
        arquivo,
        JSON.stringify(reservas, null, 2)
    );
}

/**
 * @swagger
 * tags:
 *   name: Reservas
 *   description: Gerenciamento de reservas de espaços
 *
 * components:
 *   schemas:
 *     Reserva:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         space_id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 3
 *         start_datetime:
 *           type: string
 *           format: date-time
 *           example: 2026-09-16T09:00:00Z
 *         end_datetime:
 *           type: string
 *           format: date-time
 *           example: 2026-09-16T12:00:00Z
 *         status:
 *           type: string
 *           enum:
 *             - APPROVED
 *             - PENDING
 *             - REJECTED
 *             - CANCELLED
 *           example: APPROVED
 *         rejection_reason:
 *           type: string
 *           nullable: true
 *           example: null
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2026-09-10T14:20:00Z
 *
 *     ReservaInput:
 *       type: object
 *       required:
 *         - space_id
 *         - user_id
 *         - start_datetime
 *         - end_datetime
 *       properties:
 *         space_id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 3
 *         start_datetime:
 *           type: string
 *           format: date-time
 *           example: 2026-10-05T09:00:00Z
 *         end_datetime:
 *           type: string
 *           format: date-time
 *           example: 2026-10-05T12:00:00Z
 *         status:
 *           type: string
 *           enum:
 *             - APPROVED
 *             - PENDING
 *             - REJECTED
 *             - CANCELLED
 *           example: PENDING
 *         rejection_reason:
 *           type: string
 *           nullable: true
 *           example: null
 *
 *     Erro:
 *       type: object
 *       properties:
 *         erro:
 *           type: string
 *           example: Reserva não encontrada
 */


/**
 * @swagger
 * /reservas:
 *   get:
 *     summary: Lista todas as reservas
 *     tags: [Reservas]
 *     responses:
 *       200:
 *         description: Lista de reservas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reserva'
 */
router.get("/", function (req, res) {

    const reservas = lerReservas()
        .sort((a, b) => a.id - b.id);

    res.json(reservas);
});


/**
 * @swagger
 * /reservas/data/{data}:
 *   get:
 *     summary: Busca reservas por data
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-09-16
 *     responses:
 *       200:
 *         description: Reservas encontradas na data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reserva'
 *       404:
 *         description: Nenhuma reserva encontrada
 */
router.get("/data/:data", function (req, res) {

    const { data } = req.params;

    const reservas = lerReservas();

    const encontradas = reservas.filter(reserva =>
        reserva.start_datetime.startsWith(data)
    );

    if (encontradas.length === 0) {
        return res.status(404).json({
            erro: "Nenhuma reserva encontrada nessa data"
        });
    }

    res.json(encontradas);
});


/**
 * @swagger
 * /reservas/usuario/{user_id}:
 *   get:
 *     summary: Busca reservas de um usuário
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Reservas do usuário
 *       404:
 *         description: Nenhuma reserva encontrada
 */
router.get("/usuario/:user_id", function (req, res) {

    const userId = Number(req.params.user_id);

    const reservas = lerReservas()
        .filter(reserva => reserva.user_id === userId);

    if (reservas.length === 0) {
        return res.status(404).json({
            erro: "Nenhuma reserva encontrada para esse usuário"
        });
    }

    res.json(reservas);
});


/**
 * @swagger
 * /reservas/espaco/{space_id}:
 *   get:
 *     summary: Busca reservas de um espaço
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: space_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Reservas do espaço
 *       404:
 *         description: Nenhuma reserva encontrada
 */
router.get("/espaco/:space_id", function (req, res) {

    const spaceId = Number(req.params.space_id);

    const reservas = lerReservas()
        .filter(reserva => reserva.space_id === spaceId);

    if (reservas.length === 0) {
        return res.status(404).json({
            erro: "Nenhuma reserva encontrada para esse espaço"
        });
    }

    res.json(reservas);
});


/**
 * @swagger
 * /reservas/{id}:
 *   get:
 *     summary: Busca uma reserva pelo ID
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Reserva encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reserva'
 *       404:
 *         description: Reserva não encontrada
 */
router.get("/:id", function (req, res) {

    const reserva = lerReservas()
        .find(reserva => reserva.id === Number(req.params.id));

    if (!reserva) {
        return res.status(404).json({
            erro: "Reserva não encontrada"
        });
    }

    res.json(reserva);
});


/**
 * @swagger
 * /reservas:
 *   post:
 *     summary: Cria uma nova reserva
 *     tags: [Reservas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReservaInput'
 *     responses:
 *       201:
 *         description: Reserva criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reserva'
 *       400:
 *         description: Dados obrigatórios não informados
 */
router.post("/", function (req, res) {

    const {
        space_id,
        user_id,
        start_datetime,
        end_datetime,
        status,
        rejection_reason
    } = req.body;

    if (
        !space_id ||
        !user_id ||
        !start_datetime ||
        !end_datetime
    ) {
        return res.status(400).json({
            erro: "space_id, user_id, start_datetime e end_datetime são obrigatórios"
        });
    }

    if (
        new Date(start_datetime) >= new Date(end_datetime)
    ) {
        return res.status(400).json({
            erro: "A data/hora inicial deve ser anterior à data/hora final"
        });
    }

    const reservas = lerReservas();

    const novoId = reservas.length
        ? Math.max(...reservas.map(reserva => reserva.id)) + 1
        : 1;

    const novaReserva = {
        id: novoId,
        space_id: Number(space_id),
        user_id: Number(user_id),
        start_datetime,
        end_datetime,
        status: status || "PENDING",
        rejection_reason: rejection_reason || null,
        created_at: new Date().toISOString()
    };

    reservas.push(novaReserva);

    salvarReservas(reservas);

    res.status(201).json(novaReserva);
});


/**
 * @swagger
 * /reservas/{id}:
 *   put:
 *     summary: Atualiza uma reserva
 *     tags: [Reservas]
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
 *             $ref: '#/components/schemas/ReservaInput'
 *     responses:
 *       200:
 *         description: Reserva atualizada
 *       404:
 *         description: Reserva não encontrada
 */
router.put("/:id", function (req, res) {

    const reservas = lerReservas();

    const reserva = reservas.find(
        reserva => reserva.id === Number(req.params.id)
    );

    if (!reserva) {
        return res.status(404).json({
            erro: "Reserva não encontrada"
        });
    }

    const {
        space_id,
        user_id,
        start_datetime,
        end_datetime,
        status,
        rejection_reason
    } = req.body;

    if (space_id !== undefined) {
        reserva.space_id = Number(space_id);
    }

    if (user_id !== undefined) {
        reserva.user_id = Number(user_id);
    }

    if (start_datetime !== undefined) {
        reserva.start_datetime = start_datetime;
    }

    if (end_datetime !== undefined) {
        reserva.end_datetime = end_datetime;
    }

    if (status !== undefined) {
        reserva.status = status;
    }

    if (rejection_reason !== undefined) {
        reserva.rejection_reason = rejection_reason;
    }

    if (
        new Date(reserva.start_datetime) >=
        new Date(reserva.end_datetime)
    ) {
        return res.status(400).json({
            erro: "A data/hora inicial deve ser anterior à data/hora final"
        });
    }

    salvarReservas(reservas);

    res.json(reserva);
});


/**
 * @swagger
 * /reservas/{id}:
 *   delete:
 *     summary: Remove uma reserva
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Reserva removida
 *       404:
 *         description: Reserva não encontrada
 */
router.delete("/:id", function (req, res) {

    const reservas = lerReservas();

    const reserva = reservas.find(
        reserva => reserva.id === Number(req.params.id)
    );

    if (!reserva) {
        return res.status(404).json({
            erro: "Reserva não encontrada"
        });
    }

    const reservasAtualizadas = reservas.filter(
        reserva => reserva.id !== Number(req.params.id)
    );

    salvarReservas(reservasAtualizadas);

    res.json(reserva);
});


module.exports = router;