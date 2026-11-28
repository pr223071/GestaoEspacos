const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

const STATUS_VALIDOS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const CAMPOS_RESERVA = `
    b.id, b.space_id, s.name AS space_name, b.user_id, u.name AS user_name,
    b.start_datetime, b.end_datetime, b.attendees, b.status, b.notes,
    b.rejection_reason, b.reviewed_by, b.reviewed_at, b.created_at, b.updated_at,
    -- paulo: lista dos equipamentos que a pessoa pediu junto com a reserva
    -- vem tipo [{ "id": 3, "nome": "Projetor", "quantidade": 1 }], ou [] se nao pediu nada
    -- assim a tela de minhas reservas e a gestao de reservas ja mostram sem precisar de outra chamada
    COALESCE((SELECT json_agg(json_build_object('id', e.id, 'nome', e.name, 'quantidade', be.quantity) ORDER BY e.name)
                FROM booking_equipment be JOIN equipment e ON e.id = be.equipment_id
               WHERE be.booking_id = b.id), '[]'::json) AS equipamentos
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
 *         equipamentos:
 *           type: array
 *           description: Opcional. Equipamentos da sala pedidos junto com a reserva (gravados na mesma transação)
 *           items:
 *             type: object
 *             properties:
 *               equipment_id: { type: integer, example: 3 }
 *               quantity: { type: integer, example: 1 }
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
 * /reservas/{id}/qrcode:
 *   get:
 *     summary: Devolve o código do QR Code de uma reserva aprovada
 *     description: Só o dono da reserva, a recepção ou o gestor podem ver. O código é criado pelo banco quando a reserva é aprovada.
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Código do QR Code e horários da reserva }
 *       403: { description: A reserva é de outro usuário }
 *       404: { description: Reserva não encontrada ou ainda não aprovada }
 */
// rota pro cliente pegar o qr code da reserva dele
// fiz separado pq a rota /checkins é so da recepcao, e nao coloquei o qr_token na lista
// /reservas/usuario pq ali qualquer um logado consegue ver a reserva dos outros
router.get('/:id/qrcode', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
        const result = await pool.query(
            `SELECT b.id::int AS booking_id, b.user_id::int AS user_id, b.status, s.name AS space_name,
                    ck.qr_token,
                    to_char(b.start_datetime AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS start_datetime,
                    to_char(b.end_datetime   AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS end_datetime,
                    to_char(ck.checkin_at    AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS checkin_at,
                    to_char(ck.checkout_at   AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS checkout_at
               FROM bookings b
               JOIN spaces s ON s.id = b.space_id
               LEFT JOIN checkins ck ON ck.booking_id = b.id
              WHERE b.id = $1`, [id]);
        if (!result.rowCount) return res.status(404).json({ erro: 'Reserva não encontrada.' });
        const reserva = result.rows[0];
        // so o dono ve, ou a recepcao/adm
        const { id: idLogado, role } = req.usuario || {};
        const equipe = role === 'ADMIN' || role === 'RECEPTION';
        if (!equipe && reserva.user_id !== Number(idLogado)) {
            return res.status(403).json({ erro: 'Essa reserva é de outro usuário.' });
        }
        // o qr so existe depois de aprovada
        if (reserva.status !== 'APPROVED' || !reserva.qr_token) {
            return res.status(404).json({ erro: 'O QR Code só fica disponível depois que a reserva é aprovada.' });
        }
        res.json(reserva);
    } catch (err) { erroBanco(res, err); }
});

/** @swagger
 * /reservas/agenda/{space_id}:
 *   get:
 *     summary: Agenda de um espaço para o calendário (horários de funcionamento, ocupados e bloqueios)
 *     description: Não mostra o nome de quem reservou, só se o horário está ocupado e se a reserva é sua. Os horários vêm no fuso de Brasília.
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: space_id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: de
 *         required: true
 *         schema: { type: string, format: date, example: '2026-11-01' }
 *       - in: query
 *         name: ate
 *         required: true
 *         schema: { type: string, format: date, example: '2026-11-30' }
 *     responses:
 *       200: { description: "{ horarios, ocupados, bloqueios }" }
 *       400: { description: Datas inválidas }
 */
// paulo: rota do calendario
// a /reservas/espaco devolve o nome de quem reservou, entao fiz essa separada que so
// diz "ocupado" (e se é sua), pro cliente ver os horarios livres sem ver os dados dos outros
// devolve 3 listas:
//   horarios  -> quando a sala funciona em cada dia da semana (0 = domingo ... 6 = sabado)
//   ocupados  -> reservas pendentes e aprovadas entre as datas "de" e "ate"
//   bloqueios -> manutençao/evento que o adm ou a recepçao cadastrou
router.get('/agenda/:space_id', async (req, res) => {
    try {
        const spaceId = Number(req.params.space_id);
        const { de, ate } = req.query;
        if (!Number.isInteger(spaceId) || spaceId < 1) return res.status(400).json({ erro: 'space_id inválido.' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(de || '') || !/^\d{4}-\d{2}-\d{2}$/.test(ate || '') || de > ate) {
            return res.status(400).json({ erro: 'Informe as datas "de" e "ate" no formato AAAA-MM-DD.' });
        }

        // to_char ja devolve "2026-11-28T09:00" no horario de brasilia, ai o front nao precisa converter fuso
        const horarios = await pool.query(
            `SELECT day_of_week, to_char(start_time, 'HH24:MI') AS inicio, to_char(end_time, 'HH24:MI') AS fim
               FROM space_availability WHERE space_id = $1 ORDER BY day_of_week, start_time`, [spaceId]);

        // pega tudo que encosta no periodo (começa antes do fim e termina depois do inicio)
        // "minha" diz se a reserva é de quem ta logado, pro calendario pintar de outra cor
        const ocupados = await pool.query(
            `SELECT b.id::int AS id, b.status, (b.user_id = $4) AS minha,
                    to_char(b.start_datetime AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS inicio,
                    to_char(b.end_datetime   AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS fim
               FROM bookings b
              WHERE b.space_id = $1 AND b.status IN ('PENDING', 'APPROVED')
                AND (b.start_datetime AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
                AND (b.end_datetime   AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              ORDER BY b.start_datetime`, [spaceId, de, ate, Number(req.usuario?.id) || 0]);

        const bloqueios = await pool.query(
            `SELECT id::int AS id, reason AS motivo,
                    to_char(start_datetime AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS inicio,
                    to_char(end_datetime   AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') AS fim
               FROM space_blocks
              WHERE space_id = $1
                AND (start_datetime AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
                AND (end_datetime   AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              ORDER BY start_datetime`, [spaceId, de, ate]);

        res.json({ horarios: horarios.rows, ocupados: ocupados.rows, bloqueios: bloqueios.rows });
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
    // paulo: agora uso um "client" so pra essa requisiçao pq a reserva e os equipamentos
    // sao gravados juntos numa transaçao (ou grava tudo, ou nao grava nada)
    const client = await pool.connect();
    try {
        const { space_id, start_datetime, end_datetime, attendees = 1, notes = null } = req.body;
        let { user_id } = req.body;
        // paulo: o cliente so pode reservar pra ele mesmo, entao pego o id do token
        // (antes dava pra mandar o user_id de outra pessoa no corpo e reservar no nome dela)
        // recepçao e adm continuam podendo reservar pra qualquer um
        const { id: idLogado, role } = req.usuario || {};
        if (role !== 'ADMIN' && role !== 'RECEPTION') user_id = idLogado;
        // paulo: lista de equipamentos que vem da tela de reserva, tipo [{ equipment_id: 3, quantity: 1 }]
        // é opcional, se nao vier fica vazia
        const equipamentos = Array.isArray(req.body.equipamentos) ? req.body.equipamentos : [];
        if (!space_id || !user_id || !start_datetime || !end_datetime) {
            return res.status(400).json({ erro: 'space_id, user_id, start_datetime e end_datetime são obrigatórios.' });
        }
        if (!validarPeriodo(start_datetime, end_datetime)) {
            return res.status(400).json({ erro: 'A data/hora inicial deve ser anterior à final e ambas devem ser válidas.' });
        }
        if (!Number.isInteger(Number(attendees)) || Number(attendees) < 1) {
            return res.status(400).json({ erro: 'attendees deve ser um inteiro maior que zero.' });
        }
        // paulo: confere o formato de cada equipamento antes de ir pro banco
        for (const item of equipamentos) {
            const qtd = Number(item.quantity ?? 1);
            if (!Number.isInteger(Number(item.equipment_id)) || !Number.isInteger(qtd) || qtd < 1) {
                return res.status(400).json({ erro: 'Cada equipamento precisa de equipment_id e de uma quantidade maior que zero.' });
            }
        }

        await client.query('BEGIN');
        // O status começa como PENDING; as regras do banco validam capacidade,
        // disponibilidade, bloqueios, intervalo e conflitos de agenda.
        const result = await client.query(
            `INSERT INTO bookings (space_id, user_id, start_datetime, end_datetime, attendees, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, space_id, user_id, start_datetime, end_datetime, attendees, status, notes, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at`,
            [Number(space_id), Number(user_id), start_datetime, end_datetime, Number(attendees), notes]
        );
        const reserva = result.rows[0];

        // paulo: grava cada equipamento pedido, conferindo as mesmas regras da rota /reservas-equipamentos:
        // o equipamento tem que ser dessa sala e a quantidade tem que caber no estoque
        // se algum der problema, o ROLLBACK la embaixo desfaz a reserva tambem (nao fica reserva pela metade)
        for (const item of equipamentos) {
            const equipmentId = Number(item.equipment_id);
            const qtd = Number(item.quantity ?? 1);
            const eq = await client.query('SELECT space_id, name, quantity FROM equipment WHERE id = $1', [equipmentId]);
            if (!eq.rowCount || Number(eq.rows[0].space_id) !== Number(space_id)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ erro: 'Um dos equipamentos escolhidos não pertence a esse espaço.' });
            }
            if (qtd > eq.rows[0].quantity) {
                await client.query('ROLLBACK');
                return res.status(409).json({ erro: `Só temos ${eq.rows[0].quantity} de "${eq.rows[0].name}" nesse espaço.` });
            }
            await client.query(
                'INSERT INTO booking_equipment (booking_id, equipment_id, quantity) VALUES ($1, $2, $3)',
                [reserva.id, equipmentId, qtd]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(reserva);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        erroBanco(res, err);
    } finally { client.release(); }
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
        // campos que da pra mudar pelo PUT (coloquei o reviewed_by pra salvar quem aprovou ou recusou)
        const allowed = ['space_id', 'user_id', 'start_datetime', 'end_datetime', 'attendees', 'notes', 'status', 'rejection_reason', 'reviewed_by'];
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
        // antes qualquer um logado conseguia aprovar a propria reserva chamando a api direto
        // agora so a recepcao e o adm aprovam/recusam
        // o cliente so mexe na reserva dele e o unico status que ele pode mandar é CANCELLED
        const { id: idLogado, role } = req.usuario || {};
        const equipe = role === 'ADMIN' || role === 'RECEPTION';
        if (!equipe) {
            const naoEhDele = Number(current.rows[0].user_id) !== Number(idLogado);
            const trocouDono = body.user_id !== undefined && Number(body.user_id) !== Number(idLogado);
            const statusProibido = body.status !== undefined && body.status !== 'CANCELLED';
            const querRevisar = body.reviewed_by !== undefined || body.rejection_reason !== undefined;
            if (naoEhDele || trocouDono || statusProibido || querRevisar) {
                await client.query('ROLLBACK');
                return res.status(403).json({ erro: 'Só a recepção ou o gestor podem aprovar ou recusar reservas. O cliente só pode cancelar a própria reserva.' });
            }
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
            status: 'status', rejection_reason: 'rejection_reason',
            reviewed_by: 'reviewed_by' // quem aprovou ou recusou (o reviewed_at o banco ja preenche sozinho)
        };
        const values = [];
        const sets = fields.map((field, index) => {
            values.push(field === 'space_id' || field === 'user_id' || field === 'attendees' || field === 'reviewed_by' ? Number(body[field]) : body[field]);
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
 * /reservas/{id}/cancelar:
 *   put:
 *     summary: O próprio usuário cancela a sua reserva
 *     description: Só o dono da reserva pode cancelar, e só se ela estiver pendente ou aprovada e ainda não tiver começado.
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reserva cancelada }
 *       403: { description: A reserva é de outro usuário }
 *       404: { description: Reserva não encontrada }
 *       409: { description: A reserva não pode mais ser cancelada }
 */
router.put('/:id/cancelar', async (req, res) => {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });

        await client.query('BEGIN');
        // avisa o banco quem esta mudando, para o historico gravar o usuario certo
        await client.query(`SELECT set_config('sgec.current_user_id', $1, true)`, [String(req.usuario.id)]);

        const atual = await client.query('SELECT user_id, status, start_datetime FROM bookings WHERE id = $1 FOR UPDATE', [id]);
        if (!atual.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Reserva não encontrada.' });
        }
        const reserva = atual.rows[0];

        if (Number(reserva.user_id) !== Number(req.usuario.id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ erro: 'Você só pode cancelar as suas próprias reservas.' });
        }
        if (reserva.status === 'CANCELLED') {
            await client.query('ROLLBACK');
            return res.status(409).json({ erro: 'Esta reserva já está cancelada.' });
        }
        if (reserva.status === 'REJECTED') {
            await client.query('ROLLBACK');
            return res.status(409).json({ erro: 'Esta reserva foi recusada e não pode ser cancelada.' });
        }
        if (new Date(reserva.start_datetime) <= new Date()) {
            await client.query('ROLLBACK');
            return res.status(409).json({ erro: 'Não é possível cancelar uma reserva que já começou ou já passou.' });
        }

        const result = await client.query(
            `UPDATE bookings SET status = 'CANCELLED', updated_at = now() WHERE id = $1
             RETURNING id, space_id, user_id, start_datetime, end_datetime, attendees, status, notes, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at`,
            [id]
        );
        await client.query('COMMIT');
        res.json({ mensagem: 'Reserva cancelada.', reserva: result.rows[0] });
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