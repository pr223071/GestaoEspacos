const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

const STATUS_VALIDOS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const CAMPOS_RESERVA = `
    b.id, b.space_id, s.name AS space_name, b.user_id, u.name AS user_name,
    b.start_datetime, b.end_datetime, b.attendees, b.status, b.notes,
    b.rejection_reason, b.reviewed_by, b.reviewed_at, b.created_at, b.updated_at
`;
const JOINS = `
    FROM bookings b
    JOIN spaces s ON s.id = b.space_id
    JOIN users u ON u.id = b.user_id
`;

function erroBanco(res, err) {
    console.error('Erro na rota de reservas:', err.message);
    if (err.code === '23P01') {
        return res.status(409).json({ erro: 'Já existe uma reserva ativa nesse espaço nesse horário.' });
    }
    if (err.code === '23503') {
        return res.status(400).json({ erro: 'O espaço ou usuário informado não existe.' });
    }
    if (err.code === '23514' || err.code === '22P02') {
        return res.status(400).json({ erro: err.message });
    }
    if (err.code === '23505') {
        return res.status(409).json({ erro: 'Conflito com um registro existente.' });
    }
    return res.status(500).json({ erro: 'Erro interno ao acessar as reservas.' });
}

function validarPeriodo(inicio, fim) {
    const d1 = new Date(inicio);
    const d2 = new Date(fim);
    return !Number.isNaN(d1.getTime()) && !Number.isNaN(d2.getTime()) && d1 < d2;
}

/**
 * @swagger
 * tags:
 *   name: Reservas
 *   description: Gerenciamento de reservas de espaços - Enzo
 * components:
 *   schemas:
 *     Reserva:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         space_id: { type: integer, example: 2 }
 *         space_name: { type: string, example: Sala Ipê }
 *         user_id: { type: integer, example: 3 }
 *         user_name: { type: string, example: Ana Silva }
 *         start_datetime: { type: string, format: date-time }
 *         end_datetime: { type: string, format: date-time }
 *         attendees: { type: integer, example: 4 }
 *         status: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED] }
 *         notes: { type: string, nullable: true }
 *         rejection_reason: { type: string, nullable: true }
 *         reviewed_by: { type: integer, nullable: true }
 *         reviewed_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     ReservaInput:
 *       type: object
 *       required: [space_id, user_id, start_datetime, end_datetime]
 *       properties:
 *         space_id: { type: integer, example: 2 }
 *         user_id: { type: integer, example: 3 }
 *         start_datetime: { type: string, format: date-time, example: '2026-10-19T09:00:00-03:00' }
 *         end_datetime: { type: string, format: date-time, example: '2026-10-19T10:00:00-03:00' }
 *         attendees: { type: integer, default: 1, example: 2 }
 *         notes: { type: string, nullable: true }
 */

/** @swagger
 * /reservas:
 *   get:
 *     summary: Lista reservas
 *     tags: [Reservas]
 *     responses:
 *       200:
 *         description: Lista de reservas
 */
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT ${CAMPOS_RESERVA} ${JOINS} ORDER BY b.id`);
        res.json(result.rows);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas/nome/{nome}:
 *   get:
 *     summary: Busca reservas pelo nome do usuário ou do espaço
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reservas encontradas
 */
router.get('/nome/:nome', async (req, res) => {
    try {
        const termo = `%${req.params.nome}%`;
        const result = await pool.query(
            `SELECT ${CAMPOS_RESERVA} ${JOINS}
             WHERE u.name ILIKE $1 OR s.name ILIKE $1 ORDER BY b.id`, [termo]
        );
        res.json(result.rows);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas/data/{data}:
 *   get:
 *     summary: Busca reservas que começam em uma data (AAAA-MM-DD)
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Reservas da data
 */
router.get('/data/:data', async (req, res) => {
    try {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.data)) {
            return res.status(400).json({ erro: 'Informe a data no formato AAAA-MM-DD.' });
        }
        const result = await pool.query(
            `SELECT ${CAMPOS_RESERVA} ${JOINS}
             WHERE (b.start_datetime AT TIME ZONE 'America/Sao_Paulo')::date = $1::date
             ORDER BY b.start_datetime`, [req.params.data]
        );
        res.json(result.rows);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas/usuario/{user_id}:
 *   get:
 *     summary: Lista reservas de um usuário
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reservas do usuário }
 */
router.get('/usuario/:user_id', async (req, res) => {
    try {
        const userId = Number(req.params.user_id);
        if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ erro: 'user_id inválido.' });
        const result = await pool.query(`SELECT ${CAMPOS_RESERVA} ${JOINS} WHERE b.user_id = $1 ORDER BY b.start_datetime DESC`, [userId]);
        res.json(result.rows);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas/espaco/{space_id}:
 *   get:
 *     summary: Lista reservas de um espaço
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: space_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reservas do espaço }
 */
router.get('/espaco/:space_id', async (req, res) => {
    try {
        const spaceId = Number(req.params.space_id);
        if (!Number.isInteger(spaceId) || spaceId < 1) return res.status(400).json({ erro: 'space_id inválido.' });
        const result = await pool.query(`SELECT ${CAMPOS_RESERVA} ${JOINS} WHERE b.space_id = $1 ORDER BY b.start_datetime`, [spaceId]);
        res.json(result.rows);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas/{id}:
 *   get:
 *     summary: Busca reserva pelo ID
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reserva encontrada }
 *       404: { description: Reserva não encontrada }
 */
router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
        const result = await pool.query(`SELECT ${CAMPOS_RESERVA} ${JOINS} WHERE b.id = $1`, [id]);
        if (!result.rowCount) return res.status(404).json({ erro: 'Reserva não encontrada.' });
        res.json(result.rows[0]);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas:
 *   post:
 *     summary: Cria uma solicitação de reserva
 *     tags: [Reservas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReservaInput' }
 *     responses:
 *       201: { description: Reserva criada }
 *       400: { description: Dados inválidos ou regra de negócio violada }
 *       409: { description: Conflito de horário }
 */
router.post('/', async (req, res) => {
    try {
        const { space_id, user_id, start_datetime, end_datetime, attendees = 1, notes = null } = req.body;
        if (!space_id || !user_id || !start_datetime || !end_datetime) {
            return res.status(400).json({ erro: 'space_id, user_id, start_datetime e end_datetime são obrigatórios.' });
        }
        if (!validarPeriodo(start_datetime, end_datetime)) {
            return res.status(400).json({ erro: 'A data/hora inicial deve ser anterior à final e ambas devem ser válidas.' });
        }
        if (!Number.isInteger(Number(attendees)) || Number(attendees) < 1) {
            return res.status(400).json({ erro: 'attendees deve ser um inteiro maior que zero.' });
        }
        // O status começa como PENDING; as regras do banco validam capacidade,
        // disponibilidade, bloqueios, intervalo e conflitos de agenda.
        const result = await pool.query(
            `INSERT INTO bookings (space_id, user_id, start_datetime, end_datetime, attendees, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, space_id, user_id, start_datetime, end_datetime, attendees, status, notes, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at`,
            [Number(space_id), Number(user_id), start_datetime, end_datetime, Number(attendees), notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas/{id}:
 *   put:
 *     summary: Atualiza dados ou status de uma reserva
 *     description: Para recusar, envie status REJECTED e rejection_reason. O banco controla as transições permitidas.
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               space_id: { type: integer }
 *               user_id: { type: integer }
 *               start_datetime: { type: string, format: date-time }
 *               end_datetime: { type: string, format: date-time }
 *               attendees: { type: integer }
 *               notes: { type: string, nullable: true }
 *               status: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED] }
 *               rejection_reason: { type: string, nullable: true }
 *     responses:
 *       200: { description: Reserva atualizada }
 *       404: { description: Reserva não encontrada }
 */
router.put('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
        const allowed = ['space_id', 'user_id', 'start_datetime', 'end_datetime', 'attendees', 'notes', 'status', 'rejection_reason'];
        const body = req.body || {};
        const fields = allowed.filter(key => body[key] !== undefined);
        if (!fields.length) return res.status(400).json({ erro: 'Informe ao menos um campo para atualizar.' });
        if (body.status !== undefined && !STATUS_VALIDOS.includes(body.status)) {
            return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}.` });
        }
        await client.query('BEGIN');
        const current = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
        if (!current.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Reserva não encontrada.' });
        }
        const reserva = { ...current.rows[0], ...body };
        if (!validarPeriodo(reserva.start_datetime, reserva.end_datetime)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ erro: 'A data/hora inicial deve ser anterior à final e ambas devem ser válidas.' });
        }
        if (reserva.status === 'REJECTED' && !String(reserva.rejection_reason || '').trim()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ erro: 'Informe o motivo para recusar a reserva.' });
        }
        const colunas = {
            space_id: 'space_id', user_id: 'user_id', start_datetime: 'start_datetime',
            end_datetime: 'end_datetime', attendees: 'attendees', notes: 'notes',
            status: 'status', rejection_reason: 'rejection_reason'
        };
        const values = [];
        const sets = fields.map((field, index) => {
            values.push(field === 'space_id' || field === 'user_id' || field === 'attendees' ? Number(body[field]) : body[field]);
            return `${colunas[field]} = $${index + 1}`;
        });
        values.push(id);
        const result = await client.query(
            `UPDATE bookings SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}
             RETURNING id, space_id, user_id, start_datetime, end_datetime, attendees, status, notes, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at`, values
        );
        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        erroBanco(res, err);
    } finally { client.release(); }
});

/** @swagger
 * /reservas/{id}:
 *   delete:
 *     summary: Exclui uma reserva
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reserva excluída }
 *       404: { description: Reserva não encontrada }
 */
router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
        const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);
        if (!result.rowCount) return res.status(404).json({ erro: 'Reserva não encontrada.' });
        res.json({ mensagem: 'Reserva excluída.', reserva: result.rows[0] });
    } catch (err) { erroBanco(res, err); }
});

module.exports = router;