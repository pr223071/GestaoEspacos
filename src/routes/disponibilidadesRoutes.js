// =====================================================================
// rotas de disponibilidades (matriz de disponibilidade) - paulo
//
// define em quais dias da semana e horarios cada espaco pode ser reservado
// ex.: "sala ipe, segunda-feira, das 08:00 as 18:00, liberada para o publico externo"
// os dados ficam na tabela "space_availability" do postgresql (schema sgec)
//
// uma reserva so e aceita se cair dentro de uma dessas janelas
// (quem confere isso e o proprio banco, na hora de gravar a reserva)
//
// rotas:
//   get    /disponibilidades                          -> lista todas
//   get    /disponibilidades/nome/:nome               -> horarios dos espacos com esse nome
//   get    /disponibilidades/data/:data               -> horarios do dia da semana dessa data
//   get    /disponibilidades/agenda/:space_id/:data   -> agenda: horarios livres e ocupados do espaco no dia
//   get    /disponibilidades/:id                      -> busca uma pelo id
//   post   /disponibilidades                          -> cadastra uma janela de horario
//   put    /disponibilidades/:id                      -> atualiza (so os campos enviados)
//   delete /disponibilidades/:id                      -> remove
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");                          // conexao com o banco
const { responderErro, semAcento } = require("../utils/banco");    // tratamento de erros do banco e busca sem acento

// o router agrupa as rotas deste arquivo; no index.js ele e ligado ao caminho "/disponibilidades"
const router = express.Router();

// no banco o dia da semana e um numero: 0 = domingo, 1 = segunda  6 = sabado
// esta lista serve para transformar o numero em nome nas mensagens
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const noDia = dia => (dia === 0 || dia === 6 ? "no " : "na ") + DIAS[dia].toLowerCase();

// colunas devolvidas pela api (tabela sgec.space_availability); horarios saem como "08:00" em vez de "08:00:00"
// (os ids sao bigint no banco; o ::int faz eles virem como numero, e nao como texto)
const COLUNAS = `id::int AS id, space_id::int AS space_id, day_of_week,
                 to_char(start_time, 'HH24:MI') AS start_time,
                 to_char(end_time, 'HH24:MI')   AS end_time,
                 is_external_allowed`;

//  8h ou 25:00 invalido
// expressao regular: hora de 00 a 23 ([01]\d|2[0-3]), dois pontos, minuto de 00 a 59 ([0-5]\d)
const horaValida = hora => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);

// confere os dados enviados; devolve { status, erro } se tiver problema ou null se estiver tudo certo
// fica numa funcao porque o post e o put usam exatamente as mesmas regras
//
// divisao de tarefas entre a api e o banco:
//   - a api confere o formato (dia de 0 a 6, hora "hh:mm", fim depois do inicio...)
//   - o banco confere as regras que dependem de outros dados:
//       * se o espaco existe (chave estrangeira)
//       * se o horario se sobrepoe a outro do mesmo espaco no mesmo dia (restricao exclude)
//     assim a regra vale mesmo se duas pessoas cadastrarem ao mesmo tempo
function validar(dados) {
    if (!Number.isInteger(dados.space_id)) return { status: 400, erro: "space_id precisa ser o id de um espaço" };
    if (!Number.isInteger(dados.day_of_week) || dados.day_of_week < 0 || dados.day_of_week > 6) {
        return { status: 400, erro: "day_of_week precisa ser de 0 (domingo) a 6 (sábado)" };
    }
    if (!horaValida(dados.start_time) || !horaValida(dados.end_time)) return { status: 400, erro: "Horários precisam estar no formato HH:MM (ex: 08:00)" };
    // da para comparar horarios como texto porque estao no formato "hh:mm" ("12:00" > "08:00")
    if (dados.end_time <= dados.start_time) return { status: 400, erro: "O horário de fim precisa ser depois do início" };
    if (typeof dados.is_external_allowed !== "boolean") return { status: 400, erro: "is_external_allowed precisa ser true ou false" };
    return null;
}

// erros do banco que tem mensagem propria nesta tabela
// o postgresql devolve um codigo para cada tipo de erro:
//   23503 = chave estrangeira -> o space_id nao existe na tabela spaces -> 400
//   23p01 = restricao exclude  -> horario encavalado com outro do mesmo espaco -> 409 (conflito)
// os outros erros vao para o tratamento geral (respondererro)
function responderErroDisponibilidade(res, err) {
    if (err.code === "23503") return res.status(400).json({ erro: "O espaço informado não existe" });
    if (err.code === "23P01") return res.status(409).json({ erro: "Esse horário se sobrepõe a outro horário do mesmo espaço nesse dia" });
    responderErro(res, err);
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
 *           example: 1
 *         day_of_week:
 *           type: integer
 *           example: 0
 *         start_time:
 *           type: string
 *           example: "08:00"
 *         end_time:
 *           type: string
 *           example: "12:00"
 *         is_external_allowed:
 *           type: boolean
 *           description: Se não for enviado, fica true (liberado para o público externo)
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
// async + await a consulta ao banco demora um pouco, entao o codigo espera a resposta
router.get("/", async function (req, res) {
    try {
        // ordena por dia da semana e horario, como uma grade de horarios
        const resultado = await pool.query(
            `SELECT ${COLUNAS} FROM space_availability ORDER BY day_of_week, start_time, space_id`
        );
        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
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
router.get("/nome/:nome", async function (req, res) {
    try {
        // busca os espacos pelo nome parcial
        // o select de dentro subconsulta acha os ids dos espacos com esse nome;
        // o select de fora traz os horarios desses espacos
        const resultado = await pool.query(
            `SELECT ${COLUNAS} FROM space_availability
              WHERE space_id IN (SELECT id FROM spaces WHERE ${semAcento("name")} LIKE ${semAcento("$1")})
              ORDER BY space_id, day_of_week, start_time`,
            ["%" + req.params.nome + "%"]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Nenhuma disponibilidade encontrada para esse espaço" });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
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
router.get("/data/:data", async function (req, res) {
    // a matriz e semanal (nao guarda datas), entao transformamos a data no dia da semana dela
    //  "t12:00:00z"  evita que o fuso horario jogue a data para o dia anterior
    const data = new Date(req.params.data + "T12:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.data) || isNaN(data)) return res.status(400).json({ erro: "Data inválida. Use o formato AAAA-MM-DD" });

    const diaDaSemana = data.getUTCDay();

    try {
        const resultado = await pool.query(
            `SELECT ${COLUNAS} FROM space_availability WHERE day_of_week = $1 ORDER BY start_time, space_id`,
            [diaDaSemana]
        );

        if (resultado.rows.length === 0) return res.status(404).json({ erro: `Nenhum horário disponível ${noDia(diaDaSemana)}` });

        res.json(resultado.rows);
    } catch (err) {
        responderErro(res, err);
    }
});


/**
 * @swagger
 * /disponibilidades/agenda/{space_id}/{data}:
 *   get:
 *     summary: Agenda de um espaço em um dia (horários livres e ocupados)
 *     description: |
 *       Divide os horários liberados ao público externo em intervalos (slots) e mostra a situação de cada um:
 *       LIVRE, PENDENTE (reserva aguardando aprovação), OCUPADO (reserva aprovada) ou BLOQUEADO (manutenção/evento).
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: space_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *       - in: path
 *         name: data
 *         required: true
 *         description: Data no formato AAAA-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-10-19
 *       - in: query
 *         name: slot
 *         required: false
 *         description: Tamanho de cada intervalo em minutos (15 a 240). Padrão 60.
 *         schema:
 *           type: integer
 *         example: 60
 *     responses:
 *       200:
 *         description: Agenda do dia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 space_id:
 *                   type: integer
 *                   example: 2
 *                 space_name:
 *                   type: string
 *                   example: Sala de Reunião Ipê
 *                 date:
 *                   type: string
 *                   example: "2026-10-19"
 *                 day_of_week:
 *                   type: integer
 *                   example: 1
 *                 slot_minutes:
 *                   type: integer
 *                   example: 60
 *                 summary:
 *                   type: object
 *                   description: Quantidade de slots em cada situação
 *                   example: { "LIVRE": 8, "PENDENTE": 2, "OCUPADO": 0, "BLOQUEADO": 0 }
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start_time:
 *                         type: string
 *                         example: "09:00"
 *                       end_time:
 *                         type: string
 *                         example: "10:00"
 *                       status:
 *                         type: string
 *                         enum: [LIVRE, PENDENTE, OCUPADO, BLOQUEADO]
 *                         example: PENDENTE
 *                       booking_id:
 *                         type: integer
 *                         nullable: true
 *                         description: Reserva que ocupa o slot (null se não houver)
 *                         example: 14
 *       400:
 *         description: Data, espaço ou slot inválido, ou espaço inativo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Espaço não encontrado ou sem horários liberados nesse dia
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// agenda: e a tela de "horarios livres e ocupados" que o cliente ve antes de reservar
// (pedido na especificacao como "agenda interativa")
// exemplo: get /disponibilidades/agenda/2/2026-10-19?slot=30
//   -> agenda da sala 2 no dia 19/10, dividida em pedacos de 30 minutos
router.get("/agenda/:space_id/:data", async function (req, res) {
    const spaceId = Number(req.params.space_id);
    // slot opcional e vem depois do ? na url (req.query); se nao vier, usa 60 minutos
    const slot = req.query.slot !== undefined ? Number(req.query.slot) : 60;

    // validacoes de formato antes de ir ao banco
    if (!Number.isInteger(spaceId)) return res.status(400).json({ erro: "space_id precisa ser o id de um espaço" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.data) || isNaN(new Date(req.params.data + "T12:00:00Z"))) {
        return res.status(400).json({ erro: "Data inválida. Use o formato AAAA-MM-DD" });
    }
    if (!Number.isInteger(slot) || slot < 15 || slot > 240) return res.status(400).json({ erro: "slot precisa ser um número de minutos entre 15 e 240" });

    try {
        //  confere se o espaco existe e esta ativo espaco em reforma nao aparece para reserva
        const espaco = await pool.query("SELECT id::int AS id, name, is_active FROM spaces WHERE id = $1", [spaceId]);
        if (espaco.rows.length === 0) return res.status(404).json({ erro: "Espaço não encontrado" });
        if (!espaco.rows[0].is_active) return res.status(400).json({ erro: `O espaço "${espaco.rows[0].name}" está inativo e não aceita reservas` });

        // 2) monta a agenda usando a funcao fn_space_agenda, que ja existe no banco
        // ela faz o trabalho pesado:
        //    pega as janelas da matriz de disponibilidade desse dia da semana
        //    so as liberadas ao publico externo, porque e a agenda do cliente
        //   divide em pedacos do tamanho do slot
        //   para cada pedaco, confere se tem reserva ou bloqueio e marca a situacao:
        //       livre     = pode reservar
        //       pendente  = tem reserva esperando aprovacao do gestor
        //       ocupado   = tem reserva aprovada
        //       bloqueado = manutencao ou evento interno
        // o to_char so formata a hora como 09:00
        const resultado = await pool.query(
            `SELECT to_char(slot_inicio, 'HH24:MI') AS start_time,
                    to_char(slot_fim, 'HH24:MI')    AS end_time,
                    situacao                        AS status,
                    booking_id::int AS booking_id
               FROM fn_space_agenda($1, $2::date, $3)`,
            [spaceId, req.params.data, slot]
        );

        //  o espaco nao abre nesse dia da semana
        const diaDaSemana = new Date(req.params.data + "T12:00:00Z").getUTCDay();
        if (resultado.rows.length === 0) {
            return res.status(404).json({ erro: `O espaço "${espaco.rows[0].name}" não tem horários liberados ${noDia(diaDaSemana)}` });
        }

        //  conta quantos slots tem em cada situacao
        // serve para o front-end mostrar um resumo, tipo "8 horarios livres"
        const summary = { LIVRE: 0, PENDENTE: 0, OCUPADO: 0, BLOQUEADO: 0 };
        resultado.rows.forEach(s => { summary[s.status]++; });

        // responde   dados do espa o resumo e a lista de horarios
        res.json({
            space_id: spaceId,
            space_name: espaco.rows[0].name,
            date: req.params.data,
            day_of_week: diaDaSemana,
            slot_minutes: slot,
            summary,
            slots: resultado.rows
        });
    } catch (err) {
        responderErro(res, err);
    }
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
// esta rota fica depois de /nome, /data e /agenda  se viesse antes seria entendido como se nome fosse um id
router.get("/:id", async function (req, res) {
    try {
        const resultado = await pool.query(`SELECT ${COLUNAS} FROM space_availability WHERE id = $1`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Disponibilidade não encontrada" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
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
 *         description: Dados inválidos ou espaço inexistente
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
router.post("/", async function (req, res) {
    const { space_id, day_of_week, start_time, end_time, is_external_allowed } = req.body;

    // monta os dados ja convertidos number transforma "1" em 1
    const dados = {
        space_id: Number(space_id),
        day_of_week: Number(day_of_week),
        start_time,
        end_time,
        is_external_allowed: is_external_allowed ?? true // sem informar, a janela fica liberada para o publico externo
    };

    //  valida o formato se tiver problema ja responde 400 e para aqui
    const problema = validar(dados);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    try {
        //  grava no banco; $1...$5 sao trocados pelos valores da lista
        // returning devolve o registro criado, ja com o id gerado pelo banco
        // se o espaco nao existir ou o horario encavalar com outro, o banco recusa e cai no catch
        const resultado = await pool.query(
            `INSERT INTO space_availability (space_id, day_of_week, start_time, end_time, is_external_allowed)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING ${COLUNAS}`,
            [dados.space_id, dados.day_of_week, dados.start_time, dados.end_time, dados.is_external_allowed]
        );

        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        responderErroDisponibilidade(res, err);
    }
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
 *         description: Dados inválidos ou espaço inexistente
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
router.put("/:id", async function (req, res) {
    try {
        // atualizacao parcial: o usuario pode mandar so o campo que quer mudar
        // por isso primeiro buscamos o registro atual, para completar os campos que nao foram enviados
        // e conseguir validar o horario inteiro
        const atual = await pool.query(`SELECT ${COLUNAS} FROM space_availability WHERE id = $1`, [Number(req.params.id)]);
        if (atual.rows.length === 0) return res.status(404).json({ erro: "Disponibilidade não encontrada" });

        const disponibilidade = atual.rows[0];
        const { space_id, day_of_week, start_time, end_time, is_external_allowed } = req.body;

        // para cada campo se veio no corpo !== undefined usa o novo senao mantem o atual
        const dados = {
            space_id: space_id !== undefined ? Number(space_id) : Number(disponibilidade.space_id),
            day_of_week: day_of_week !== undefined ? Number(day_of_week) : disponibilidade.day_of_week,
            start_time: start_time !== undefined ? start_time : disponibilidade.start_time,
            end_time: end_time !== undefined ? end_time : disponibilidade.end_time,
            is_external_allowed: is_external_allowed !== undefined ? is_external_allowed : disponibilidade.is_external_allowed
        };

        const problema = validar(dados);
        if (problema) return res.status(problema.status).json({ erro: problema.erro });

        const resultado = await pool.query(
            `UPDATE space_availability
                SET space_id = $1, day_of_week = $2, start_time = $3, end_time = $4, is_external_allowed = $5
              WHERE id = $6
              RETURNING ${COLUNAS}`,
            [dados.space_id, dados.day_of_week, dados.start_time, dados.end_time, dados.is_external_allowed, disponibilidade.id]
        );

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErroDisponibilidade(res, err);
    }
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
router.delete("/:id", async function (req, res) {
    try {
        // returning devolve o horario que foi apagado; se nao voltar nada, o id nao existia -> 404
        const resultado = await pool.query(`DELETE FROM space_availability WHERE id = $1 RETURNING ${COLUNAS}`, [Number(req.params.id)]);

        if (resultado.rows.length === 0) return res.status(404).json({ erro: "Disponibilidade não encontrada" });

        res.json(resultado.rows[0]);
    } catch (err) {
        responderErro(res, err);
    }
});


module.exports = router;
