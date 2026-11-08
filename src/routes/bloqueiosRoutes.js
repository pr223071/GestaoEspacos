// =====================================================================
// rotas de bloqueios - paulo
//
// parte da matriz de disponibilidade: a especificacao pede "janelas permitidas...
// e bloqueios para manutencao ou eventos internos"
//
// a disponibilidade diz quando o espaco abre toda semana (ex.: segunda 08h-18h)
// o bloqueio fecha o espaco num periodo especifico (ex.: dia 23/10 das 08h as 18h,
// manutencao das bancadas). enquanto o bloqueio existir, o banco nao aceita
// reservas nesse espaco e periodo, e a agenda mostra os horarios como bloqueado
//
// os dados ficam na tabela "space_blocks" do postgresql (schema sgec)
//
// rotas:
//   get    /bloqueios              -> lista todos
//   get    /bloqueios/nome/:nome   -> busca pelo nome do espaco ou pelo motivo
//   get    /bloqueios/data/:data   -> bloqueios que valem nessa data
//   get    /bloqueios/:id          -> busca um pelo id
//   post   /bloqueios              -> bloqueia um espaco por um periodo
//   put    /bloqueios/:id          -> atualiza (so os campos enviados)
//   delete /bloqueios/:id          -> remove (o espaco volta a aceitar reservas)
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");                          // conexao com o banco (criada pelo enzo)
const { responderErro, semAcento } = require("../utils/banco");    // tratamento de erros do banco e busca sem acento

// o router agrupa as rotas deste arquivo; no index.js ele e ligado ao caminho "/bloqueios"
const router = express.Router();

// todas as datas e horas usam o horario de brasilia
// (o banco guarda em utc; o at time zone converte na ida e na volta)
const FUSO = "America/Sao_Paulo";

// colunas devolvidas pela api (tabela sgec.space_blocks)
// as datas saem como "2026-10-23t08:00" no horario de brasilia (mesmo formato que o usuario envia)
// (os ids sao bigint no banco; o ::int faz eles virem como numero, e nao como texto)
const COLUNAS = `id::int AS id, space_id::int AS space_id,
                 to_char(start_datetime AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI') AS start_datetime,
                 to_char(end_datetime AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI')   AS end_datetime,
                 reason, created_by::int AS created_by, created_at`;

// "2026-10-23t08:00" ou "2026-10-23 08:00" (data, t ou espaco, hora:minuto)
const dataHoraValida = valor => /^\d{4}-\d{2}-\d{2}[T ]([01]\d|2[0-3]):[0-5]\d$/.test(valor) && !isNaN(new Date(valor.replace(" ", "T")));

// confere os dados enviados; devolve { status, erro } se tiver problema ou null se estiver tudo certo
// fica numa funcao porque o post e o put usam as mesmas regras
// (se o espaco e o usuario existem, quem confere e o banco, pela chave estrangeira)
function validar(dados) {
    if (!Number.isInteger(dados.space_id)) return { status: 400, erro: "space_id precisa ser o id de um espaço" };
    if (!dataHoraValida(dados.start_datetime) || !dataHoraValida(dados.end_datetime)) {
        return { status: 400, erro: "Datas precisam estar no formato AAAA-MM-DDTHH:MM (ex: 2026-10-23T08:00)" };
    }
    // nesse formato da para comparar as datas como texto ("2026-10-23t18:00" > "2026-10-23t08:00")
    if (dados.end_datetime.replace(" ", "T") <= dados.start_datetime.replace(" ", "T")) return { status: 400, erro: "O fim do bloqueio precisa ser depois do início" };
    // o motivo e obrigatorio: serve de registro de por que o espaco ficou fechado
    if (!dados.reason || !String(dados.reason).trim()) return { status: 400, erro: "Informe o motivo do bloqueio (reason)" };
    if (dados.created_by !== null && !Number.isInteger(dados.created_by)) return { status: 400, erro: "created_by precisa ser o id de um usuário" };
    return null;
}

// regra de negocio: nao deixa bloquear um periodo que ja tem reservas pendentes ou aprovadas
// senao um cliente teria a reserva aprovada e chegaria com o espaco fechado
// o gestor precisa cancelar (e avisar) essas reservas antes de bloquear
// devolve a lista de ids das reservas que atrapalham (lista vazia = pode bloquear)
async function reservasNoPeriodo(dados) {
    // tstzrange cria um intervalo de tempo e o && pergunta "esses dois intervalos se cruzam?"
    // o "::timestamp at time zone" diz ao banco que a hora enviada e do horario de brasilia
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

// erros do banco que tem mensagem propria nesta tabela
//   23503 = chave estrangeira -> o space_id ou o created_by nao existe -> 400
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
        // procura o texto no motivo ou no nome do espaco (subconsulta na tabela spaces)
        // o texto vai no $1, separado do sql, para evitar sql injection
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
        // um bloqueio "pega" o dia se comeca antes do fim do dia e termina depois do comeco do dia
        // (assim aparece tambem um bloqueio de varios dias que passa por essa data)
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
// esta rota fica depois de /nome e /data: se viesse antes, "/bloqueios/nome" seria
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

    // monta os dados ja convertidos; created_by e opcional (null se nao vier)
    const dados = {
        space_id: Number(space_id),
        start_datetime,
        end_datetime,
        reason,
        created_by: created_by !== undefined && created_by !== null ? Number(created_by) : null
    };

    // 1) valida o formato; se tiver problema, ja responde 400 e para aqui
    const problema = validar(dados);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        // 2) regra de negocio: nao pode ter reserva ativa no periodo -> 409 (conflito)
        const reservas = await reservasNoPeriodo(dados);
        if (reservas.length > 0) {
            return res.status(409).json({ erro: `Existem reservas ativas nesse período (ids: ${reservas.join(", ")}). Cancele-as antes de bloquear o espaço` });
        }

        // 3) grava no banco; $1...$5 sao trocados pelos valores da lista (protege contra sql injection)
        // returning devolve o bloqueio criado, ja com o id gerado pelo banco
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
        // atualizacao parcial: busca o bloqueio atual para completar os campos que nao foram enviados
        const atual = await pool.query(`SELECT ${COLUNAS} FROM space_blocks WHERE id = $1`, [Number(req.params.id)]);
        if (atual.rows.length === 0) return res.status(404).json({ erro: "Bloqueio não encontrado" });

        const bloqueio = atual.rows[0];
        const { space_id, start_datetime, end_datetime, reason, created_by } = req.body;

        // para cada campo: se veio no corpo (!== undefined) usa o novo, senao mantem o atual
        const dados = {
            space_id: space_id !== undefined ? Number(space_id) : bloqueio.space_id,
            start_datetime: start_datetime !== undefined ? start_datetime : bloqueio.start_datetime,
            end_datetime: end_datetime !== undefined ? end_datetime : bloqueio.end_datetime,
            reason: reason !== undefined ? reason : bloqueio.reason,
            created_by: created_by !== undefined ? (created_by === null ? null : Number(created_by)) : bloqueio.created_by
        };

        const problema = validar(dados);
        if (problema) return res.status(problema.status).json({ erro: problema.erro });

        // se o periodo mudou, confere de novo se nao pegou nenhuma reserva ativa
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
        // returning devolve o bloqueio apagado; se nao voltar nada, o id nao existia -> 404
        const resultado = await pool.query(`DELETE FROM space_blocks WHERE id = $1 RETURNING ${COLUNAS}`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Bloqueio não encontrado" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


module.exports = router;
