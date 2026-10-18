// =====================================================================
// ROTAS DE BLOQUEIOS - Paulo
//
// Parte da Matriz de Disponibilidade: a especificação pede "janelas permitidas...
// e bloqueios para manutenção ou eventos internos".
//
// A disponibilidade diz quando o espaço abre TODA SEMANA (ex.: segunda 08h-18h).
// O bloqueio fecha o espaço num período ESPECÍFICO (ex.: dia 23/10 das 08h às 18h,
// manutenção das bancadas). Enquanto o bloqueio existir, o banco não aceita
// reservas nesse espaço e período, e a agenda mostra os horários como BLOQUEADO.
//
// Os dados ficam na tabela "space_blocks" do PostgreSQL (schema sgec).
//
// Rotas:
//   GET    /bloqueios              -> lista todos
//   GET    /bloqueios/nome/:nome   -> busca pelo nome do espaço ou pelo motivo
//   GET    /bloqueios/data/:data   -> bloqueios que valem nessa data
//   GET    /bloqueios/:id          -> busca um pelo id
//   POST   /bloqueios              -> bloqueia um espaço por um período
//   PUT    /bloqueios/:id          -> atualiza (só os campos enviados)
//   DELETE /bloqueios/:id          -> remove (o espaço volta a aceitar reservas)
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");                          // conexão com o banco (criada pelo Enzo)
const { responderErro, semAcento } = require("../utils/banco");    // tratamento de erros do banco e busca sem acento

// o Router agrupa as rotas deste arquivo; no index.js ele é ligado ao caminho "/bloqueios"
const router = express.Router();

// todas as datas e horas usam o horário de Brasília
// (o banco guarda em UTC; o AT TIME ZONE converte na ida e na volta)
const FUSO = "America/Sao_Paulo";

// colunas devolvidas pela API (tabela sgec.space_blocks)
// as datas saem como "2026-10-23T08:00" no horário de Brasília (mesmo formato que o usuário envia)
// (os ids são BIGINT no banco; o ::int faz eles virem como número, e não como texto)
const COLUNAS = `id::int AS id, space_id::int AS space_id,
                 to_char(start_datetime AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI') AS start_datetime,
                 to_char(end_datetime AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI')   AS end_datetime,
                 reason, created_by::int AS created_by, created_at`;

// "2026-10-23T08:00" ou "2026-10-23 08:00" (data, T ou espaço, hora:minuto)
const dataHoraValida = valor => /^\d{4}-\d{2}-\d{2}[T ]([01]\d|2[0-3]):[0-5]\d$/.test(valor) && !isNaN(new Date(valor.replace(" ", "T")));

// confere os dados enviados; devolve { status, erro } se tiver problema ou null se estiver tudo certo
// fica numa função porque o POST e o PUT usam as mesmas regras
// (se o espaço e o usuário existem, quem confere é o banco, pela chave estrangeira)
function validar(dados) {
    if (!Number.isInteger(dados.space_id)) return { status: 400, erro: "space_id precisa ser o id de um espaço" };
    if (!dataHoraValida(dados.start_datetime) || !dataHoraValida(dados.end_datetime)) {
        return { status: 400, erro: "Datas precisam estar no formato AAAA-MM-DDTHH:MM (ex: 2026-10-23T08:00)" };
    }
    // nesse formato dá para comparar as datas como texto ("2026-10-23T18:00" > "2026-10-23T08:00")
    if (dados.end_datetime.replace(" ", "T") <= dados.start_datetime.replace(" ", "T")) return { status: 400, erro: "O fim do bloqueio precisa ser depois do início" };
    // o motivo é obrigatório: serve de registro de por que o espaço ficou fechado
    if (!dados.reason || !String(dados.reason).trim()) return { status: 400, erro: "Informe o motivo do bloqueio (reason)" };
    if (dados.created_by !== null && !Number.isInteger(dados.created_by)) return { status: 400, erro: "created_by precisa ser o id de um usuário" };
    return null;
}

// REGRA DE NEGÓCIO: não deixa bloquear um período que já tem reservas pendentes ou aprovadas.
// Senão um cliente teria a reserva aprovada e chegaria com o espaço fechado.
// O gestor precisa cancelar (e avisar) essas reservas antes de bloquear.
// Devolve a lista de ids das reservas que atrapalham (lista vazia = pode bloquear).
async function reservasNoPeriodo(dados) {
    // tstzrange cria um intervalo de tempo e o && pergunta "esses dois intervalos se cruzam?"
    // o "::timestamp AT TIME ZONE" diz ao banco que a hora enviada é do horário de Brasília
    const resultado = await pool.query(
        `SELECT id::int AS id FROM bookings
          WHERE space_id = $1
            AND status IN ('PENDING', 'APPROVED')
            AND tstzrange(start_datetime, end_datetime)
             && tstzrange($2::timestamp AT TIME ZONE '${FUSO}', $3::timestamp AT TIME ZONE '${FUSO}')
          ORDER BY start_datetime`,
        [dados.space_id, dados.start_datetime, dados.end_datetime]
    );
    return resultado.rows.map(r => r.id);
}

// erros do banco que têm mensagem própria nesta tabela
//   23503 = chave estrangeira -> o space_id ou o created_by não existe -> 400
function responderErroBloqueio(res, err) {
    if (err.code === "23503") return res.status(400).json({ erro: "O espaço (space_id) ou o usuário (created_by) informado não existe" });
    responderErro(res, err);
}


/**
 * @swagger
 * tags:
 *   name: Bloqueios
 *   description: Bloqueios de espaços para manutenção ou eventos internos - Paulo
 *
 * components:
 *   schemas:
 *     Bloqueio:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         space_id:
 *           type: integer
 *           example: 3
 *         start_datetime:
 *           type: string
 *           description: Início do bloqueio (horário de Brasília)
 *           example: "2026-10-23T08:00"
 *         end_datetime:
 *           type: string
 *           description: Fim do bloqueio (horário de Brasília)
 *           example: "2026-10-23T18:00"
 *         reason:
 *           type: string
 *           description: Motivo do bloqueio
 *           example: Manutenção preventiva das bancadas
 *         created_by:
 *           type: integer
 *           description: Id do usuário (gestor) que cadastrou o bloqueio
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2026-10-17T10:00:00Z
 *     BloqueioInput:
 *       type: object
 *       required:
 *         - space_id
 *         - start_datetime
 *         - end_datetime
 *         - reason
 *       properties:
 *         space_id:
 *           type: integer
 *           example: 1
 *         start_datetime:
 *           type: string
 *           description: Formato AAAA-MM-DDTHH:MM (horário de Brasília)
 *           example: "2026-11-03T08:00"
 *         end_datetime:
 *           type: string
 *           description: Formato AAAA-MM-DDTHH:MM (horário de Brasília)
 *           example: "2026-11-03T12:00"
 *         reason:
 *           type: string
 *           example: Troca do ar-condicionado
 *         created_by:
 *           type: integer
 *           description: Opcional. Id do usuário que está bloqueando
 *           example: 1
 */


/**
 * @swagger
 * /bloqueios:
 *   get:
 *     summary: Lista todos os bloqueios
 *     tags: [Bloqueios]
 *     responses:
 *       200:
 *         description: Lista ordenada pela data de início
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bloqueio'
 */
router.get("/", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} FROM space_blocks ORDER BY space_blocks.start_datetime, space_id`);
        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /bloqueios/nome/{nome}:
 *   get:
 *     summary: Busca bloqueios pelo nome do espaço ou pelo motivo
 *     description: Busca parcial, ignorando maiúsculas/minúsculas e acentos.
 *     tags: [Bloqueios]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: laboratorio
 *     responses:
 *       200:
 *         description: Bloqueios encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bloqueio'
 *       404:
 *         description: Nenhum bloqueio encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/nome/:nome", async function (req, res) {
    try {
        // procura o texto no motivo OU no nome do espaço (subconsulta na tabela spaces)
        // o texto vai no $1, separado do SQL, para evitar SQL Injection
        const resultado = await pool.query(
            `SELECT ${COLUNAS} FROM space_blocks
              WHERE ${semAcento("reason")} LIKE ${semAcento("$1")}
                 OR space_id IN (SELECT id FROM spaces WHERE ${semAcento("name")} LIKE ${semAcento("$1")})
              ORDER BY space_blocks.start_datetime`,
            ["%" + req.params.nome + "%"]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhum bloqueio encontrado com esse nome" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /bloqueios/data/{data}:
 *   get:
 *     summary: Lista os bloqueios que valem na data informada
 *     description: Traz todo bloqueio que pega pelo menos um pedaço desse dia.
 *     tags: [Bloqueios]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-10-23
 *     responses:
 *       200:
 *         description: Bloqueios nesse dia
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bloqueio'
 *       400:
 *         description: Data inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Nenhum bloqueio nesse dia
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
        // um bloqueio "pega" o dia se começa antes do fim do dia E termina depois do começo do dia
        // (assim aparece também um bloqueio de vários dias que passa por essa data)
        // $1::date + 1 = meia-noite do dia seguinte
        const resultado = await pool.query(
            `SELECT ${COLUNAS} FROM space_blocks
              WHERE space_blocks.start_datetime < ($1::date + 1)::timestamp AT TIME ZONE '${FUSO}'
                AND space_blocks.end_datetime   >  $1::date::timestamp     AT TIME ZONE '${FUSO}'
              ORDER BY space_blocks.start_datetime`,
            [req.params.data]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhum bloqueio nessa data" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /bloqueios/{id}:
 *   get:
 *     summary: Busca um bloqueio pelo id
 *     tags: [Bloqueios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Bloqueio encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bloqueio'
 *       404:
 *         description: Bloqueio não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// esta rota fica DEPOIS de /nome e /data: se viesse antes, "/bloqueios/nome" seria
// entendido como se "nome" fosse um id
router.get("/:id", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} FROM space_blocks WHERE id = $1`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Bloqueio não encontrado" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /bloqueios:
 *   post:
 *     summary: Bloqueia um espaço por um período
 *     description: Enquanto o bloqueio existir, o banco não aceita reservas nesse espaço e período.
 *     tags: [Bloqueios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BloqueioInput'
 *     responses:
 *       201:
 *         description: Bloqueio cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bloqueio'
 *       400:
 *         description: Dados inválidos ou espaço/usuário inexistente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Já existem reservas pendentes ou aprovadas nesse período (cancele-as antes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/", async function (req, res) {
    const { space_id, start_datetime, end_datetime, reason, created_by } = req.body;

    // monta os dados já convertidos; created_by é opcional (null se não vier)
    const dados = {
        space_id: Number(space_id),
        start_datetime,
        end_datetime,
        reason,
        created_by: created_by !== undefined && created_by !== null ? Number(created_by) : null
    };

    // 1º) valida o formato; se tiver problema, já responde 400 e para aqui
    const problema = validar(dados);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        // 2º) regra de negócio: não pode ter reserva ativa no período -> 409 (conflito)
        const reservas = await reservasNoPeriodo(dados);
        if (reservas.length > 0) {
            return res.status(409).json({ erro: `Existem reservas ativas nesse período (ids: ${reservas.join(", ")}). Cancele-as antes de bloquear o espaço` });
        }

        // 3º) grava no banco; $1...$5 são trocados pelos valores da lista (protege contra SQL Injection)
        // RETURNING devolve o bloqueio criado, já com o id gerado pelo banco
        const resultado = await pool.query(
            `INSERT INTO space_blocks (space_id, start_datetime, end_datetime, reason, created_by)
             VALUES ($1, $2::timestamp AT TIME ZONE '${FUSO}', $3::timestamp AT TIME ZONE '${FUSO}', $4, $5)
             RETURNING ${COLUNAS}`,
            [dados.space_id, dados.start_datetime, dados.end_datetime, dados.reason.trim(), dados.created_by]
        );

        res.status(201).json(resultado.rows[0]); // 201 = criado
    } catch (err) {
        responderErroBloqueio(res, err);
    }
});


/**
 * @swagger
 * /bloqueios/{id}:
 *   put:
 *     summary: Atualiza um bloqueio
 *     description: Só os campos enviados são alterados.
 *     tags: [Bloqueios]
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
 *             $ref: '#/components/schemas/BloqueioInput'
 *     responses:
 *       200:
 *         description: Bloqueio atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bloqueio'
 *       400:
 *         description: Dados inválidos ou espaço/usuário inexistente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Bloqueio não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Já existem reservas pendentes ou aprovadas no novo período
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.put("/:id", async function (req, res) {
    try {
        // ATUALIZAÇÃO PARCIAL: busca o bloqueio atual para completar os campos que não foram enviados
        const atual = await pool.query(`SELECT ${COLUNAS} FROM space_blocks WHERE id = $1`, [Number(req.params.id)]);
        if (atual.rows.length === 0) return res.status(404).json({ erro: "Bloqueio não encontrado" });

        const bloqueio = atual.rows[0];
        const { space_id, start_datetime, end_datetime, reason, created_by } = req.body;

        // para cada campo: se veio no corpo (!== undefined) usa o novo, senão mantém o atual
        const dados = {
            space_id: space_id !== undefined ? Number(space_id) : bloqueio.space_id,
            start_datetime: start_datetime !== undefined ? start_datetime : bloqueio.start_datetime,
            end_datetime: end_datetime !== undefined ? end_datetime : bloqueio.end_datetime,
            reason: reason !== undefined ? reason : bloqueio.reason,
            created_by: created_by !== undefined ? (created_by === null ? null : Number(created_by)) : bloqueio.created_by
        };

        const problema = validar(dados);
        if (problema) return res.status(problema.status).json({ erro: problema.erro });

        // se o período mudou, confere de novo se não pegou nenhuma reserva ativa
        const reservas = await reservasNoPeriodo(dados);
        if (reservas.length > 0) {
            return res.status(409).json({ erro: `Existem reservas ativas nesse período (ids: ${reservas.join(", ")}). Cancele-as antes de bloquear o espaço` });
        }

        const resultado = await pool.query(
            `UPDATE space_blocks
                SET space_id = $1,
                    start_datetime = $2::timestamp AT TIME ZONE '${FUSO}',
                    end_datetime   = $3::timestamp AT TIME ZONE '${FUSO}',
                    reason = $4, created_by = $5
              WHERE id = $6
              RETURNING ${COLUNAS}`,
            [dados.space_id, dados.start_datetime, dados.end_datetime, String(dados.reason).trim(), dados.created_by, bloqueio.id]
        );

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErroBloqueio(res, err);
    }
});


/**
 * @swagger
 * /bloqueios/{id}:
 *   delete:
 *     summary: Remove um bloqueio (o espaço volta a aceitar reservas nesse período)
 *     tags: [Bloqueios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Bloqueio removido (retorna o registro apagado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bloqueio'
 *       404:
 *         description: Bloqueio não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete("/:id", async function (req, res) {
    try {
        // RETURNING devolve o bloqueio apagado; se não voltar nada, o id não existia -> 404
        const resultado = await pool.query(`DELETE FROM space_blocks WHERE id = $1 RETURNING ${COLUNAS}`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Bloqueio não encontrado" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


module.exports = router;
