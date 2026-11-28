// =====================================================================
// rotas de notificacoes - paulo
//
// melhoria pedida na especificacao: "integracao de notificacoes: disparo de
// e-mails e mensagens instantaneas (whatsapp/telegram) notificando sobre
// mudancas de status e lembretes de reserva"
//
// como as notificacoes nascem: o proprio banco cria uma notificacao sozinho
// (trigger) toda vez que uma reserva e criada, aprovada, recusada ou cancelada
// ou seja, quem faz reservas nao precisa lembrar de avisar ninguem
//
// a tabela "notifications" funciona como uma fila:
//   - sent_at vazio (null)  = ainda nao foi enviada
//   - sent_at preenchido    = ja foi enviada (guarda a data/hora do envio)
// um servico de e-mail/whatsapp le as pendentes (get /notificacoes/pendentes),
// envia e marca como enviada (put /notificacoes/:id/enviada)
//
// rotas:
//   get    /notificacoes                   -> lista todas
//   get    /notificacoes/pendentes         -> fila do que ainda nao foi enviado
//   get    /notificacoes/minhas            -> as de quem ta logado (tela de notificacoes do front)
//
// quem pode: o cliente so ve as dele (/minhas e /usuario/<id dele>), o resto é so recepcao/adm
// (essa regra ta no middleware soAsMinhasNotificacoes do auth.js)
// quem manda os e-mails de verdade é o src/services/enviarEmails.js
//   get    /notificacoes/nome/:nome        -> busca pelo nome do usuario ou pelo assunto
//   get    /notificacoes/data/:data        -> notificacoes criadas nessa data
//   get    /notificacoes/usuario/:user_id  -> notificacoes de um usuario ("minhas notificacoes")
//   get    /notificacoes/:id               -> busca uma pelo id
//   post   /notificacoes                   -> o gestor cria um aviso manual (ex.: lembrete)
//   put    /notificacoes/:id               -> corrige assunto/mensagem/canal (so antes de enviar)
//   put    /notificacoes/:id/enviada       -> marca como enviada
//   delete /notificacoes/:id               -> remove
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");                          // conexao com o banco (criada pelo enzo)
const { responderErro, semAcento } = require("../utils/banco");    // tratamento de erros do banco e busca sem acento

// o router agrupa as rotas deste arquivo; no index.js ele e ligado ao caminho "/notificacoes"
const router = express.Router();

// canais aceitos (sao os mesmos do tipo enum "notification_channel" do banco)
const CANAIS = ["EMAIL", "WHATSAPP", "TELEGRAM"];

// colunas devolvidas pela api; o join com users traz o nome de quem recebe
// "sent" e calculado na hora: true se ja foi enviada
// (os ids sao bigint no banco; o ::int faz eles virem como numero, e nao como texto)
const COLUNAS = `n.id::int AS id, n.user_id::int AS user_id, u.name AS user_name, u.email AS user_email,
                 n.booking_id::int AS booking_id, n.channel, n.subject, n.message,
                 n.created_at, n.sent_at, (n.sent_at IS NOT NULL) AS sent`;
const FROM = `FROM notifications n JOIN users u ON u.id = n.user_id`;

// confere os dados de uma notificacao; devolve { status, erro } se tiver problema ou null se estiver tudo certo
// (o post confere tudo; o put so confere os campos que vieram)
function validar(dados, parcial) {
    if (!parcial || dados.channel !== undefined) {
        if (!CANAIS.includes(dados.channel)) return { status: 400, erro: "channel precisa ser EMAIL, WHATSAPP ou TELEGRAM" };
    }
    if (!parcial || dados.subject !== undefined) {
        if (!dados.subject || !String(dados.subject).trim()) return { status: 400, erro: "Informe o assunto (subject)" };
        if (String(dados.subject).length > 200) return { status: 400, erro: "O assunto pode ter no máximo 200 caracteres" };
    }
    if (!parcial || dados.message !== undefined) {
        if (!dados.message || !String(dados.message).trim()) return { status: 400, erro: "Informe a mensagem (message)" };
    }
    return null;
}


/**
 * @swagger
 * tags:
 *   name: Notificações
 *   description: Avisos por e-mail/WhatsApp/Telegram sobre as reservas (criados automaticamente pelo banco) - Paulo
 *
 * components:
 *   schemas:
 *     Notificacao:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 4
 *         user_name:
 *           type: string
 *           example: Bruno Martins
 *         user_email:
 *           type: string
 *           example: bruno@technova.com.br
 *         booking_id:
 *           type: integer
 *           nullable: true
 *           description: Reserva que gerou o aviso (null num aviso geral)
 *           example: 14
 *         channel:
 *           type: string
 *           enum: [EMAIL, WHATSAPP, TELEGRAM]
 *           example: EMAIL
 *         subject:
 *           type: string
 *           example: "Reserva #14 recebida e está aguardando análise"
 *         message:
 *           type: string
 *           example: "Sua reserva do espaço \"Sala de Reunião Ipê\" em 19/10/2026 09:00 foi recebida e está aguardando análise."
 *         created_at:
 *           type: string
 *           format: date-time
 *         sent_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Quando foi enviada (null = ainda na fila)
 *         sent:
 *           type: boolean
 *           example: false
 *     NotificacaoInput:
 *       type: object
 *       required:
 *         - user_id
 *         - subject
 *         - message
 *       properties:
 *         user_id:
 *           type: integer
 *           example: 4
 *         booking_id:
 *           type: integer
 *           description: Opcional. Precisa ser uma reserva desse mesmo usuário
 *           example: 14
 *         channel:
 *           type: string
 *           enum: [EMAIL, WHATSAPP, TELEGRAM]
 *           description: Se não for enviado, fica EMAIL
 *           example: WHATSAPP
 *         subject:
 *           type: string
 *           example: Lembrete da sua reserva
 *         message:
 *           type: string
 *           example: "Lembrete: sua reserva da Sala Ipê é amanhã às 09:00. Leve o QR Code."
 *     NotificacaoEdicao:
 *       type: object
 *       properties:
 *         channel:
 *           type: string
 *           enum: [EMAIL, WHATSAPP, TELEGRAM]
 *           example: EMAIL
 *         subject:
 *           type: string
 *           example: Lembrete da sua reserva (horário atualizado)
 *         message:
 *           type: string
 *           example: "Lembrete: sua reserva da Sala Ipê é amanhã às 10:00."
 */


/**
 * @swagger
 * /notificacoes:
 *   get:
 *     summary: Lista todas as notificações
 *     tags: [Notificações]
 *     responses:
 *       200:
 *         description: Lista da mais nova para a mais antiga
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notificacao'
 */
router.get("/", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} ORDER BY n.created_at DESC, n.id DESC`);
        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/pendentes:
 *   get:
 *     summary: Fila de notificações que ainda não foram enviadas
 *     description: É o que o serviço de e-mail/WhatsApp lê para saber o que precisa enviar.
 *     tags: [Notificações]
 *     responses:
 *       200:
 *         description: Pendentes, da mais antiga para a mais nova (ordem de envio)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notificacao'
 */
// esta rota fica antes de /:id; senao "pendentes" seria entendido como um id
router.get("/pendentes", async function (req, res) {
    try {
        // a mais antiga primeiro: quem entrou primeiro na fila sai primeiro
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE n.sent_at IS NULL ORDER BY n.created_at, n.id`);
        res.json(resultado.rows); // lista vazia = nada pendente (nao e erro)
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/minhas:
 *   get:
 *     summary: Notificações de quem está logado (tela de Notificações)
 *     description: Usa o id do token, então cada um só vê as suas. Junta o nome do espaço da reserva quando tiver.
 *     tags: [Notificações]
 *     responses:
 *       200:
 *         description: Da mais nova para a mais antiga
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notificacao'
 */
// rota da tela de notificaçoes: pego o id do token, entao ninguem consegue ver a dos outros por aqui
// tambem fica antes de /:id pelo mesmo motivo da /pendentes
router.get("/minhas", async function (req, res) {
    try {
        const resultado = await pool.query(
            `SELECT ${COLUNAS}, s.name AS space_name, b.status AS booking_status
               ${FROM}
               LEFT JOIN bookings b ON b.id = n.booking_id
               LEFT JOIN spaces s ON s.id = b.space_id
              WHERE n.user_id = $1
              ORDER BY n.created_at DESC, n.id DESC`,
            [req.usuario.id],
        );
        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/nome/{nome}:
 *   get:
 *     summary: Busca notificações pelo nome do usuário ou pelo assunto
 *     description: Busca parcial, ignorando maiúsculas/minúsculas e acentos.
 *     tags: [Notificações]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: bruno
 *     responses:
 *       200:
 *         description: Notificações encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notificacao'
 *       404:
 *         description: Nenhuma notificação encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/nome/:nome", async function (req, res) {
    try {
        // procura no nome de quem recebe ou no assunto; o texto vai no $1 (protege contra sql injection)
        const resultado = await pool.query(
            `SELECT ${COLUNAS} ${FROM}
              WHERE ${semAcento("u.name")} LIKE ${semAcento("$1")}
                 OR ${semAcento("n.subject")} LIKE ${semAcento("$1")}
              ORDER BY n.created_at DESC, n.id DESC`,
            ["%" + req.params.nome + "%"]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma notificação encontrada com esse nome" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/data/{data}:
 *   get:
 *     summary: Lista as notificações criadas na data informada
 *     tags: [Notificações]
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
 *         description: Notificações dessa data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notificacao'
 *       400:
 *         description: Data inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Nenhuma notificação nessa data
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
        // o created_at guarda data e hora em utc; convertemos para brasilia e comparamos so a data
        const resultado = await pool.query(
            `SELECT ${COLUNAS} ${FROM}
              WHERE (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date = $1
              ORDER BY n.created_at, n.id`,
            [req.params.data]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma notificação nessa data" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/usuario/{user_id}:
 *   get:
 *     summary: Notificações de um usuário ("minhas notificações")
 *     tags: [Notificações]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 4
 *     responses:
 *       200:
 *         description: Notificações do usuário, da mais nova para a mais antiga (lista vazia se ele não tiver nenhuma)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notificacao'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get("/usuario/:user_id", async function (req, res) {
    const userId = Number(req.params.user_id);
    if (!Number.isInteger(userId)) return res.status(400).json({ erro: "user_id precisa ser o id de um usuário" });

    try {
        // primeiro confere se o usuario existe: "usuario sem notificacoes" (lista vazia)
        // e diferente de "usuario que nao existe" (404)
        const usuario = await pool.query("SELECT 1 FROM users WHERE id = $1", [userId]);
        if (usuario.rows.length === 0) return res.status(404).json({ erro: "Usuário não encontrado" });

        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE n.user_id = $1 ORDER BY n.created_at DESC, n.id DESC`, [userId]);
        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/{id}:
 *   get:
 *     summary: Busca uma notificação pelo id
 *     tags: [Notificações]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Notificação encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notificacao'
 *       404:
 *         description: Notificação não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// esta rota fica depois de /pendentes, /nome, /data e /usuario: se viesse antes,
// "/notificacoes/pendentes" seria entendido como se "pendentes" fosse um id
router.get("/:id", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} ${FROM} WHERE n.id = $1`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Notificação não encontrada" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes:
 *   post:
 *     summary: "Cria um aviso manual para um usuário (ex.: lembrete de reserva)"
 *     description: As notificações de mudança de status já são criadas sozinhas pelo banco; esta rota é para avisos extras do gestor.
 *     tags: [Notificações]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificacaoInput'
 *     responses:
 *       201:
 *         description: Notificação criada (entra na fila de envio)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notificacao'
 *       400:
 *         description: Dados inválidos, usuário inexistente ou reserva de outro usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post("/", async function (req, res) {
    const { user_id, booking_id, channel, subject, message } = req.body;

    // monta os dados ja convertidos; canal padrao = email
    const dados = {
        user_id: Number(user_id),
        booking_id: booking_id !== undefined && booking_id !== null ? Number(booking_id) : null,
        channel: channel ?? "EMAIL",
        subject,
        message
    };

    // 1) valida o formato
    if (!Number.isInteger(dados.user_id)) return res.status(400).json({ erro: "user_id precisa ser o id de um usuário" });
    if (dados.booking_id !== null && !Number.isInteger(dados.booking_id)) return res.status(400).json({ erro: "booking_id precisa ser o id de uma reserva" });
    const problema = validar(dados, false);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        // 2) regra: se o aviso for sobre uma reserva, ela precisa ser desse mesmo usuario
        // (nao faz sentido avisar a ana sobre a reserva do bruno)
        if (dados.booking_id !== null) {
            const reserva = await pool.query("SELECT user_id::int AS user_id FROM bookings WHERE id = $1", [dados.booking_id]);
            if (reserva.rows.length === 0) return res.status(400).json({ erro: "A reserva informada não existe" });
            if (reserva.rows[0].user_id !== dados.user_id) return res.status(400).json({ erro: "A reserva informada é de outro usuário" });
        }

        // 3) grava; o "with nova as (...)" faz o insert e, na mesma consulta,
        // devolve a notificacao ja com o nome do usuario (join)
        const resultado = await pool.query(
            `WITH nova AS (
                 INSERT INTO notifications (user_id, booking_id, channel, subject, message)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *
             )
             SELECT ${COLUNAS} FROM nova n JOIN users u ON u.id = n.user_id`,
            [dados.user_id, dados.booking_id, dados.channel, String(dados.subject).trim(), String(dados.message).trim()]
        );

        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        // 23503 = chave estrangeira: o user_id nao existe na tabela users
        if (err.code === "23503") return res.status(400).json({ erro: "O usuário informado não existe" });
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/{id}/enviada:
 *   put:
 *     summary: Marca uma notificação como enviada
 *     description: Chamado pelo serviço de e-mail/WhatsApp depois de enviar. Grava a data/hora do envio.
 *     tags: [Notificações]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Notificação marcada como enviada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notificacao'
 *       404:
 *         description: Notificação não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: A notificação já tinha sido enviada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// fica antes do put /:id para o caminho "/:id/enviada" ser reconhecido primeiro
router.put("/:id/enviada", async function (req, res) {
    try {
        // o "and sent_at is null" garante que so marca uma vez:
        // se ja estava enviada, o update nao altera nenhuma linha
        const resultado = await pool.query(
            `WITH alterada AS (
                 UPDATE notifications SET sent_at = now()
                  WHERE id = $1 AND sent_at IS NULL
                  RETURNING *
             )
             SELECT ${COLUNAS} FROM alterada n JOIN users u ON u.id = n.user_id`,
            [Number(req.params.id)]
        );

        if (resultado.rows.length === 0) {
            // nao alterou nada: ou nao existe, ou ja estava enviada; descobre qual dos dois
            const existe = await pool.query("SELECT 1 FROM notifications WHERE id = $1", [Number(req.params.id)]);
            if (existe.rows.length === 0) return res.status(404).json({ erro: "Notificação não encontrada" });
            return res.status(409).json({ erro: "Essa notificação já tinha sido enviada" });
        }

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/{id}:
 *   put:
 *     summary: Corrige o assunto, a mensagem ou o canal de uma notificação
 *     description: Só os campos enviados são alterados. Depois de enviada, a notificação não pode mais ser alterada (é registro do que o usuário recebeu).
 *     tags: [Notificações]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificacaoEdicao'
 *     responses:
 *       200:
 *         description: Notificação atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notificacao'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Notificação não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: A notificação já foi enviada e não pode mais ser alterada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.put("/:id", async function (req, res) {
    const { channel, subject, message } = req.body;

    // valida so o que veio (atualizacao parcial)
    const problema = validar({ channel, subject, message }, true);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        const atual = await pool.query("SELECT sent_at FROM notifications WHERE id = $1", [Number(req.params.id)]);
        if (atual.rows.length === 0) return res.status(404).json({ erro: "Notificação não encontrada" });
        // regra: o que ja foi enviado nao muda (seria apagar o registro do que o usuario recebeu)
        if (atual.rows[0].sent_at !== null) return res.status(409).json({ erro: "Essa notificação já foi enviada e não pode mais ser alterada" });

        // coalesce($1, channel) = usa o valor novo, ou mantem o atual se nao veio nada
        const resultado = await pool.query(
            `WITH alterada AS (
                 UPDATE notifications SET
                     channel = COALESCE($1::notification_channel, channel),
                     subject = COALESCE($2, subject),
                     message = COALESCE($3, message)
                  WHERE id = $4 AND sent_at IS NULL
                  RETURNING *
             )
             SELECT ${COLUNAS} FROM alterada n JOIN users u ON u.id = n.user_id`,
            [channel ?? null, subject !== undefined ? String(subject).trim() : null,
             message !== undefined ? String(message).trim() : null, Number(req.params.id)]
        );

        // se foi enviada bem entre a consulta acima e o update, nao altera nada
        if (resultado.rows.length === 0) return res.status(409).json({ erro: "Essa notificação já foi enviada e não pode mais ser alterada" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /notificacoes/{id}:
 *   delete:
 *     summary: Remove uma notificação
 *     tags: [Notificações]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Notificação removida (retorna o registro apagado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notificacao'
 *       404:
 *         description: Notificação não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete("/:id", async function (req, res) {
    try {
        // apaga e ja devolve o registro apagado (com o nome do usuario)
        const resultado = await pool.query(
            `WITH apagada AS (
                 DELETE FROM notifications WHERE id = $1 RETURNING *
             )
             SELECT ${COLUNAS} FROM apagada n JOIN users u ON u.id = n.user_id`,
            [Number(req.params.id)]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Notificação não encontrada" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


module.exports = router;
