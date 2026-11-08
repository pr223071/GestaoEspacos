// =====================================================================
// rotas de check-in / check-out (qr code) - paulo
//
// melhoria pedida na especificacao: "fluxo de check-in via qr code: geracao
// automatizada de qr code temporario enviado por e-mail apos aprovacao da
// reserva para validacao presencial na recepcao". usada pelo perfil recepcao
//
// como o check-in nasce: quando o gestor aprova uma reserva, o proprio banco
// (trigger) cria uma linha em "checkins" com um qr_token aleatorio (uuid)
// esse token e o conteudo do qr code: o front-end transforma o texto em imagem
// por isso esta rota nao tem post para criar nem delete: quem cria e o sistema
//
// o token e aleatorio e impossivel de adivinhar (ex.: 3f2a9c1e-5b7d-...), entao
// so quem recebeu o qr code consegue fazer o check-in. ele nao contem dados pessoais
//
// fluxo na recepcao:
//   1) le o qr code             -> get  /checkins/token/:qr_token          (mostra de quem e a reserva)
//   2) confirma a entrada       -> post /checkins/token/:qr_token/entrada  (grava checkin_at)
//   3) na saida                 -> post /checkins/token/:qr_token/saida    (grava checkout_at)
//
// rotas de consulta:
//   get /checkins                       -> lista todos
//   get /checkins/nome/:nome            -> busca pelo nome do cliente ou do espaco
//   get /checkins/data/:data            -> check-ins das reservas dessa data
//   get /checkins/reserva/:booking_id   -> check-in de uma reserva
//   get /checkins/:id                   -> busca um pelo id
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");                          // conexao com o banco (criada pelo enzo)
const { responderErro, semAcento } = require("../utils/banco");    // tratamento de erros do banco e busca sem acento

// o router agrupa as rotas deste arquivo; no index.js ele e ligado ao caminho "/checkins"
const router = express.Router();

// todas as datas e horas saem no horario de brasilia (o banco guarda em utc)
const FUSO = "America/Sao_Paulo";

// a entrada e liberada a partir de 30 minutos antes do inicio da reserva
const MINUTOS_ANTES = 30;

// formata uma data/hora do banco como "2026-10-19t09:00" no horario de brasilia
// (os parenteses garantem que uma conta como "inicio - 30 minutos" seja feita antes de converter o fuso)
const local = coluna => `to_char((${coluna}) AT TIME ZONE '${FUSO}', 'YYYY-MM-DD"T"HH24:MI')`;

// colunas devolvidas pela api: junta o check-in com a reserva, o espaco, o cliente
// e o recepcionista que validou (left join porque pode ainda nao ter sido validado)
//
// "situation" e calculada na hora, para a tela mostrar o estado de cada check-in:
//   concluido      = entrou e saiu
//   em_uso         = entrou e ainda nao saiu
//   cancelado      = a reserva foi cancelada depois de aprovada
//   nao_compareceu = o horario acabou e ninguem fez check-in
//   aguardando     = ainda vai acontecer
// (os ids sao bigint no banco; o ::int faz eles virem como numero, e nao como texto)
const COLUNAS = `ck.id::int AS id, ck.booking_id::int AS booking_id, ck.qr_token,
                 b.status AS booking_status, s.name AS space_name, u.name AS user_name,
                 ${local("b.start_datetime")} AS start_datetime,
                 ${local("b.end_datetime")}   AS end_datetime,
                 ${local("ck.expires_at")}    AS expires_at,
                 ${local("ck.checkin_at")}    AS checkin_at,
                 ${local("ck.checkout_at")}   AS checkout_at,
                 ck.validated_by::int AS validated_by, v.name AS validated_by_name,
                 CASE
                     WHEN ck.checkout_at IS NOT NULL THEN 'CONCLUIDO'
                     WHEN ck.checkin_at  IS NOT NULL THEN 'EM_USO'
                     WHEN b.status <> 'APPROVED'     THEN 'CANCELADO'
                     WHEN ck.expires_at < now()      THEN 'NAO_COMPARECEU'
                     ELSE 'AGUARDANDO'
                 END AS situation`;
const FROM = `FROM checkins ck
              JOIN bookings b    ON b.id = ck.booking_id
              JOIN spaces s      ON s.id = b.space_id
              JOIN users u       ON u.id = b.user_id
              LEFT JOIN users v  ON v.id = ck.validated_by`;

// formato de um uuid: 8-4-4-4-12 caracteres hexadecimais
const tokenValido = token => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

// busca um check-in pelo token, ja com tudo que as regras precisam saber
async function buscarPorToken(token) {
    const resultado = await pool.query(
        `SELECT ${COLUNAS},
                now() > ck.expires_at                                              AS expirado,
                now() < b.start_datetime - make_interval(mins => ${MINUTOS_ANTES}) AS cedo_demais,
                ${local(`b.start_datetime - make_interval(mins => ${MINUTOS_ANTES})`)} AS liberado_a_partir_de
           ${FROM}
          WHERE ck.qr_token = $1`,
        [token]
    );
    return resultado.rows[0]; // undefined se nao achar
}

// regra: so a recepcao ou o gestor podem validar entrada/saida (cliente nao valida o proprio check-in)
// devolve { status, erro } se nao puder ou null se puder
async function conferirRecepcionista(validated_by) {
    if (!Number.isInteger(validated_by)) return { status: 400, erro: "Informe validated_by: o id do usuário da recepção que está validando" };
    const resultado = await pool.query("SELECT role, is_active FROM users WHERE id = $1", [validated_by]);
    if (resultado.rows.length === 0) return { status: 400, erro: "O usuário informado em validated_by não existe" };
    const { role, is_active } = resultado.rows[0];
    if (!is_active) return { status: 403, erro: "O usuário informado em validated_by está inativo" };
    if (role !== "RECEPTION" && role !== "ADMIN") return { status: 403, erro: "Só a recepção ou o gestor podem validar check-in/check-out" };
    return null;
}

// tira os campos de apoio (usados so nas regras) antes de responder
function limpar(checkin) {
    const { expirado, cedo_demais, liberado_a_partir_de, ...resto } = checkin;
    return resto;
}


/**
 * @swagger
 * tags:
 *   name: Check-ins
 *   description: Check-in e check-out presencial pelo QR Code da reserva aprovada (perfil Recepção) - Paulo
 *
 * components:
 *   schemas:
 *     Checkin:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         booking_id:
 *           type: integer
 *           example: 16
 *         qr_token:
 *           type: string
 *           format: uuid
 *           description: Conteúdo do QR Code
 *           example: 3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90
 *         booking_status:
 *           type: string
 *           example: APPROVED
 *         space_name:
 *           type: string
 *           example: Estação Coworking A
 *         user_name:
 *           type: string
 *           example: Ana Lima
 *         start_datetime:
 *           type: string
 *           description: Início da reserva (horário de Brasília)
 *           example: "2026-10-20T08:00"
 *         end_datetime:
 *           type: string
 *           example: "2026-10-20T12:00"
 *         expires_at:
 *           type: string
 *           description: Até quando o QR Code vale (fim da reserva)
 *           example: "2026-10-20T12:00"
 *         checkin_at:
 *           type: string
 *           nullable: true
 *           example: "2026-10-20T08:05"
 *         checkout_at:
 *           type: string
 *           nullable: true
 *           example: null
 *         validated_by:
 *           type: integer
 *           nullable: true
 *           example: 2
 *         validated_by_name:
 *           type: string
 *           nullable: true
 *           example: Rafael Recepção
 *         situation:
 *           type: string
 *           enum: [AGUARDANDO, EM_USO, CONCLUIDO, NAO_COMPARECEU, CANCELADO]
 *           example: EM_USO
 *     ValidacaoRecepcao:
 *       type: object
 *       required:
 *         - validated_by
 *       properties:
 *         validated_by:
 *           type: integer
 *           description: Id do usuário da recepção (ou gestor) que está validando
 *           example: 2
 */


/**
 * @swagger
 * /checkins:
 *   get:
 *     summary: Lista todos os check-ins
 *     tags: [Check-ins]
 *     responses:
 *       200:
 *         description: Lista ordenada pelo início da reserva
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Checkin'
 */
router.get("/", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} ORDER BY b.start_datetime, ck.id`);
        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /checkins/nome/{nome}:
 *   get:
 *     summary: Busca check-ins pelo nome do cliente ou do espaço
 *     description: Busca parcial, ignorando maiúsculas/minúsculas e acentos.
 *     tags: [Check-ins]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: ana
 *     responses:
 *       200:
 *         description: Check-ins encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Checkin'
 *       404:
 *         description: Nenhum check-in encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/nome/:nome", async function (req, res) {
    try {
        // procura no nome do cliente ou do espaco; o texto vai no $1 (protege contra sql injection)
        const resultado = await pool.query(
            `SELECT ${COLUNAS} ${FROM}
              WHERE ${semAcento("u.name")} LIKE ${semAcento("$1")}
                 OR ${semAcento("s.name")} LIKE ${semAcento("$1")}
              ORDER BY b.start_datetime, ck.id`,
            ["%" + req.params.nome + "%"]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhum check-in encontrado com esse nome" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /checkins/data/{data}:
 *   get:
 *     summary: Check-ins das reservas de uma data (a lista do dia da recepção)
 *     tags: [Check-ins]
 *     parameters:
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-09-15
 *     responses:
 *       200:
 *         description: Check-ins das reservas dessa data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Checkin'
 *       400:
 *         description: Data inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Nenhum check-in nessa data
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
        // usa a data de inicio da reserva, convertida para o horario de brasilia
        const resultado = await pool.query(
            `SELECT ${COLUNAS} ${FROM}
              WHERE (b.start_datetime AT TIME ZONE '${FUSO}')::date = $1
              ORDER BY b.start_datetime, ck.id`,
            [req.params.data]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhum check-in nessa data" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /checkins/reserva/{booking_id}:
 *   get:
 *     summary: Check-in de uma reserva
 *     description: Usado em "Meus agendamentos" para mostrar o QR Code da reserva aprovada.
 *     tags: [Check-ins]
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 16
 *     responses:
 *       200:
 *         description: Check-in da reserva
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Checkin'
 *       404:
 *         description: A reserva não existe ou ainda não foi aprovada (só reserva aprovada tem QR Code)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/reserva/:booking_id", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE ck.booking_id = $1`, [Number(req.params.booking_id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Essa reserva não tem check-in (ela não existe ou ainda não foi aprovada)" });

        res.json(resultado.rows[0]); // booking_id e unique em checkins: no maximo 1
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /checkins/token/{qr_token}:
 *   get:
 *     summary: Lê um QR Code (mostra de quem é a reserva antes de validar)
 *     tags: [Check-ins]
 *     parameters:
 *       - in: path
 *         name: qr_token
 *         required: true
 *         description: Conteúdo do QR Code (UUID)
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Check-in encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Checkin'
 *       400:
 *         description: O texto lido não é um QR Code do sistema (formato inválido)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: QR Code não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/token/:qr_token", async function (req, res) {
    // confere o formato antes de ir ao banco (um qr code qualquer, de outro sistema, cai aqui)
    if (!tokenValido(req.params.qr_token)) return res.status(400).json({ erro: "QR Code inválido: não é um código do SGEC" });

    try {
        const checkin = await buscarPorToken(req.params.qr_token);
        if (!checkin) return res.status(404).json({ erro: "QR Code não encontrado" });

        res.json(limpar(checkin));
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /checkins/token/{qr_token}/entrada:
 *   post:
 *     summary: Valida a ENTRADA (check-in) pelo QR Code
 *     description: |
 *       Regras: a reserva precisa estar aprovada; a entrada é liberada a partir de 30 minutos antes do início
 *       e até o fim da reserva (validade do QR Code); só pode entrar uma vez; quem valida precisa ser da recepção ou o gestor.
 *     tags: [Check-ins]
 *     parameters:
 *       - in: path
 *         name: qr_token
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidacaoRecepcao'
 *     responses:
 *       200:
 *         description: Entrada registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Checkin'
 *       400:
 *         description: QR Code ou validated_by inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       403:
 *         description: Quem está validando não é da recepção nem gestor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: QR Code não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Reserva não aprovada, QR Code expirado, cedo demais ou entrada já registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/token/:qr_token/entrada", async function (req, res) {
    const token = req.params.qr_token;
    const validatedBy = Number(req.body.validated_by);

    if (!tokenValido(token)) return res.status(400).json({ erro: "QR Code inválido: não é um código do SGEC" });

    try {
        // 1) quem esta validando pode validar? (recepcao ou gestor)
        const semPermissao = await conferirRecepcionista(validatedBy);
        if (semPermissao) return res.status(semPermissao.status).json({ erro: semPermissao.erro });

        // 2) o qr code existe?
        const checkin = await buscarPorToken(token);
        if (!checkin) return res.status(404).json({ erro: "QR Code não encontrado" });

        // 3) regras de negocio, cada uma com sua mensagem (409 = conflito com o estado atual)
        if (checkin.booking_status !== "APPROVED") return res.status(409).json({ erro: `A reserva não está aprovada (status: ${checkin.booking_status})` });
        if (checkin.checkin_at) return res.status(409).json({ erro: `A entrada já foi registrada em ${checkin.checkin_at}` });
        if (checkin.expirado) return res.status(409).json({ erro: `QR Code expirado: a reserva terminou em ${checkin.expires_at}` });
        if (checkin.cedo_demais) return res.status(409).json({ erro: `Ainda é cedo: a entrada é liberada a partir de ${checkin.liberado_a_partir_de}` });

        // 4) grava a entrada. o "and checkin_at is null" impede entrada dupla
        // mesmo se duas pessoas lerem o mesmo qr code ao mesmo tempo
        const resultado = await pool.query(
            "UPDATE checkins SET checkin_at = now(), validated_by = $2 WHERE qr_token = $1 AND checkin_at IS NULL",
            [token, validatedBy]
        );
        if (resultado.rowCount === 0) return res.status(409).json({ erro: "A entrada já foi registrada" });

        // responde o check-in atualizado (com o nome de quem validou)
        res.json(limpar(await buscarPorToken(token)));
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /checkins/token/{qr_token}/saida:
 *   post:
 *     summary: Registra a SAÍDA (check-out) pelo QR Code
 *     description: Só depois da entrada, e uma única vez.
 *     tags: [Check-ins]
 *     parameters:
 *       - in: path
 *         name: qr_token
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidacaoRecepcao'
 *     responses:
 *       200:
 *         description: Saída registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Checkin'
 *       400:
 *         description: QR Code ou validated_by inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       403:
 *         description: Quem está validando não é da recepção nem gestor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: QR Code não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Ainda não fez a entrada, ou a saída já foi registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/token/:qr_token/saida", async function (req, res) {
    const token = req.params.qr_token;
    const validatedBy = Number(req.body.validated_by);

    if (!tokenValido(token)) return res.status(400).json({ erro: "QR Code inválido: não é um código do SGEC" });

    try {
        const semPermissao = await conferirRecepcionista(validatedBy);
        if (semPermissao) return res.status(semPermissao.status).json({ erro: semPermissao.erro });

        const checkin = await buscarPorToken(token);
        if (!checkin) return res.status(404).json({ erro: "QR Code não encontrado" });

        // regras: precisa ter entrado antes, e so sai uma vez
        if (!checkin.checkin_at) return res.status(409).json({ erro: "Ainda não foi feita a entrada (check-in) dessa reserva" });
        if (checkin.checkout_at) return res.status(409).json({ erro: `A saída já foi registrada em ${checkin.checkout_at}` });

        // o banco ainda confere (check) que a saida e depois da entrada
        const resultado = await pool.query(
            "UPDATE checkins SET checkout_at = now() WHERE qr_token = $1 AND checkin_at IS NOT NULL AND checkout_at IS NULL",
            [token]
        );
        if (resultado.rowCount === 0) return res.status(409).json({ erro: "A saída já foi registrada" });

        res.json(limpar(await buscarPorToken(token)));
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /checkins/{id}:
 *   get:
 *     summary: Busca um check-in pelo id
 *     tags: [Check-ins]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Check-in encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Checkin'
 *       404:
 *         description: Check-in não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// esta rota fica por ultimo: se viesse antes, "/checkins/nome" seria entendido como se "nome" fosse um id
router.get("/:id", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE ck.id = $1`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Check-in não encontrado" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


module.exports = router;
