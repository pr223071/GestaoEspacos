const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const arquivo = path.join(__dirname, "..", "db", "availability.json"); // "tabela" de disponibilidades
const arquivoEspacos = path.join(__dirname, "..", "db", "spaces.json");

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function lerDisponibilidades() {
    return JSON.parse(fs.readFileSync(arquivo, "utf-8"));
}

function salvarDisponibilidades(disponibilidades) {
    fs.writeFileSync(arquivo, JSON.stringify(disponibilidades, null, 2));
}

function lerEspacos() {
    return JSON.parse(fs.readFileSync(arquivoEspacos, "utf-8"));
}

// "08:00" válido, "8h" ou "25:00" inválido
const horaValida = hora => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);

// confere os dados enviados; devolve { status, erro } se tiver problema ou null se estiver tudo certo
function validar(dados, disponibilidades, idAtual) {
    if (!lerEspacos().some(e => e.id === dados.space_id)) return { status: 400, erro: "O espaço informado não existe" };
    if (!Number.isInteger(dados.day_of_week) || dados.day_of_week < 0 || dados.day_of_week > 6) {
        return { status: 400, erro: "day_of_week precisa ser de 0 (domingo) a 6 (sábado)" };
    }
    if (!horaValida(dados.start_time) || !horaValida(dados.end_time)) return { status: 400, erro: "Horários precisam estar no formato HH:MM (ex: 08:00)" };
    if (dados.end_time <= dados.start_time) return { status: 400, erro: "O horário de fim precisa ser depois do início" };
    if (typeof dados.is_external_allowed !== "boolean") return { status: 400, erro: "is_external_allowed precisa ser true ou false" };

    // não pode ter dois horários do mesmo espaço se sobrepondo no mesmo dia
    const sobreposta = disponibilidades.find(d => d.id !== idAtual && d.space_id === dados.space_id &&
        d.day_of_week === dados.day_of_week && d.start_time < dados.end_time && d.end_time > dados.start_time);
    if (sobreposta) {
        return { status: 409, erro: `Conflito com o horário #${sobreposta.id} (${DIAS[sobreposta.day_of_week]} ${sobreposta.start_time}–${sobreposta.end_time}) desse espaço` };
    }
    return null;
}


/**
 * @swagger
 * tags:
 *   name: Disponibilidades
 *   description: Horários da semana em que cada espaço pode ser reservado -  Paulo - enzo
 * 
 *
 * components:
 *   schemas:
 *     Disponibilidade:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         space_id:
 *           type: integer
 *           example: 1
 *         day_of_week:
 *           type: integer
 *           description: 0 = domingo, 1 = segunda ... 6 = sábado
 *           example: 1
 *         start_time:
 *           type: string
 *           example: "08:00"
 *         end_time:
 *           type: string
 *           example: "18:00"
 *         is_external_allowed:
 *           type: boolean
 *           description: Se pessoas de fora podem reservar nesse horário
 *           example: true
 *     DisponibilidadeInput:
 *       type: object
 *       required:
 *         - space_id
 *         - day_of_week
 *         - start_time
 *         - end_time
 *       properties:
 *         space_id:
 *           type: integer
 *           example: 5
 *         day_of_week:
 *           type: integer
 *           example: 2
 *         start_time:
 *           type: string
 *           example: "08:00"
 *         end_time:
 *           type: string
 *           example: "12:00"
 *         is_external_allowed:
 *           type: boolean
 *           example: false
 */


/**
 * @swagger
 * /disponibilidades:
 *   get:
 *     summary: Lista todas as disponibilidades
 *     tags: [Disponibilidades]
 *     responses:
 *       200:
 *         description: Lista ordenada por dia da semana e horário
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Disponibilidade'
 */
router.get("/", function (req, res) {
    const disponibilidades = lerDisponibilidades()
        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
    res.json(disponibilidades);
});


/**
 * @swagger
 * /disponibilidades/nome/{nome}:
 *   get:
 *     summary: Busca as disponibilidades pelo nome do espaço
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: coworking
 *     responses:
 *       200:
 *         description: Disponibilidades dos espaços encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Disponibilidade'
 *       404:
 *         description: Nenhuma disponibilidade encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/nome/:nome", function (req, res) {
    const nome = req.params.nome.toLowerCase();
    const idsEspacos = lerEspacos().filter(e => e.name.toLowerCase().includes(nome)).map(e => e.id);
    const encontradas = lerDisponibilidades().filter(d => idsEspacos.includes(d.space_id));

    if (encontradas.length === 0) return res.status(404).json({ erro: "Nenhuma disponibilidade encontrada para esse espaço" });

    res.json(encontradas);
});


/**
 * @swagger
 * /disponibilidades/data/{data}:
 *   get:
 *     summary: Lista os horários disponíveis na data informada
 *     description: Usa o dia da semana da data (ex. 2026-09-21 é segunda-feira).
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-09-21
 *     responses:
 *       200:
 *         description: Horários disponíveis nesse dia
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Disponibilidade'
 *       400:
 *         description: Data inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Nenhum horário nesse dia
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/data/:data", function (req, res) {
    const data = new Date(req.params.data + "T12:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.data) || isNaN(data)) return res.status(400).json({ erro: "Data inválida. Use o formato AAAA-MM-DD" });

    const diaDaSemana = data.getUTCDay();
    const encontradas = lerDisponibilidades().filter(d => d.day_of_week === diaDaSemana);

    if (encontradas.length === 0) return res.status(404).json({ erro: `Nenhum horário disponível na ${DIAS[diaDaSemana].toLowerCase()}` });

    res.json(encontradas);
});


/**
 * @swagger
 * /disponibilidades/{id}:
 *   get:
 *     summary: Busca uma disponibilidade pelo id
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Disponibilidade encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       404:
 *         description: Disponibilidade não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/:id", function (req, res) {
    const disponibilidade = lerDisponibilidades().find(d => d.id === Number(req.params.id));

    if (!disponibilidade) return res.status(404).json({ erro: "Disponibilidade não encontrada" });

    res.json(disponibilidade);
});


/**
 * @swagger
 * /disponibilidades:
 *   post:
 *     summary: Cadastra um novo horário de disponibilidade
 *     tags: [Disponibilidades]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisponibilidadeInput'
 *     responses:
 *       201:
 *         description: Disponibilidade cadastrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Horário se sobrepõe a outro do mesmo espaço
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/", function (req, res) {
    const { space_id, day_of_week, start_time, end_time, is_external_allowed } = req.body;
    const disponibilidades = lerDisponibilidades();

    const dados = {
        space_id: Number(space_id),
        day_of_week: Number(day_of_week),
        start_time,
        end_time,
        is_external_allowed: is_external_allowed ?? false
    };

    const problema = validar(dados, disponibilidades, null);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    const nova = { id: disponibilidades.length ? Math.max(...disponibilidades.map(d => d.id)) + 1 : 1, ...dados };

    disponibilidades.push(nova);
    salvarDisponibilidades(disponibilidades);

    res.status(201).json(nova);
});


/**
 * @swagger
 * /disponibilidades/{id}:
 *   put:
 *     summary: Atualiza um horário de disponibilidade
 *     description: Só os campos enviados são alterados.
 *     tags: [Disponibilidades]
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
 *             $ref: '#/components/schemas/DisponibilidadeInput'
 *     responses:
 *       200:
 *         description: Disponibilidade atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Disponibilidade não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Horário se sobrepõe a outro do mesmo espaço
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.put("/:id", function (req, res) {
    const disponibilidades = lerDisponibilidades();
    const disponibilidade = disponibilidades.find(d => d.id === Number(req.params.id));

    if (!disponibilidade) return res.status(404).json({ erro: "Disponibilidade não encontrada" });

    const { space_id, day_of_week, start_time, end_time, is_external_allowed } = req.body;

    const dados = {
        space_id: space_id !== undefined ? Number(space_id) : disponibilidade.space_id,
        day_of_week: day_of_week !== undefined ? Number(day_of_week) : disponibilidade.day_of_week,
        start_time: start_time !== undefined ? start_time : disponibilidade.start_time,
        end_time: end_time !== undefined ? end_time : disponibilidade.end_time,
        is_external_allowed: is_external_allowed !== undefined ? is_external_allowed : disponibilidade.is_external_allowed
    };

    const problema = validar(dados, disponibilidades, disponibilidade.id);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    Object.assign(disponibilidade, dados);
    salvarDisponibilidades(disponibilidades);

    res.json(disponibilidade);
});


/**
 * @swagger
 * /disponibilidades/{id}:
 *   delete:
 *     summary: Remove um horário de disponibilidade
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 11
 *     responses:
 *       200:
 *         description: Disponibilidade removida (retorna o registro apagado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       404:
 *         description: Disponibilidade não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete("/:id", function (req, res) {
    const disponibilidades = lerDisponibilidades();
    const disponibilidade = disponibilidades.find(d => d.id === Number(req.params.id));

    if (!disponibilidade) return res.status(404).json({ erro: "Disponibilidade não encontrada" });

    salvarDisponibilidades(disponibilidades.filter(d => d.id !== disponibilidade.id));

    res.json(disponibilidade);
});


module.exports = router;
