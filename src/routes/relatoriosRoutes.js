// =====================================================================
// rotas (so ADMIN, ligado no index.js):
//   get /relatorios/ocupacao?inicio=AAAA-MM-DD&fim=AAAA-MM-DD
//       sem parametros = ultimos 30 dias ate hoje (fim e inclusivo)
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");
const { responderErro } = require("../utils/banco");

const router = express.Router();

// mesmo fuso das outras rotas: o banco guarda em horario de brasilia e converte na ida e na volta
const FUSO = "America/Sao_Paulo";

// limite do periodo, pra consulta nao ficar pesada
const MAX_DIAS = 366;

const dataValida = (valor) =>
  typeof valor === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
  !isNaN(new Date(valor));

// "2026-11-26" a partir de uma data (usa so a parte da data, sem mexer no fuso)
const paraAAAAMMDD = (data) => data.toISOString().slice(0, 10);

// o pg devolve numeric como texto; aqui vira numero com 1 casa decimal
const num = (valor) => Math.round(Number(valor || 0) * 10) / 10;

router.get("/ocupacao", async function (req, res) {
  // periodo padrao: ultimos 30 dias
  const hoje = new Date();
  const inicio =
    req.query.inicio || paraAAAAMMDD(new Date(hoje.getTime() - 29 * 86400000));
  const fim = req.query.fim || paraAAAAMMDD(hoje);

  if (!dataValida(inicio) || !dataValida(fim)) {
    return res
      .status(400)
      .json({ erro: "Datas inválidas. Use o formato AAAA-MM-DD" });
  }
  if (fim < inicio) {
    return res
      .status(400)
      .json({ erro: "A data final precisa ser igual ou depois da inicial" });
  }
  const dias = Math.round((new Date(fim) - new Date(inicio)) / 86400000) + 1;
  if (dias > MAX_DIAS) {
    return res
      .status(400)
      .json({ erro: `O período pode ter no máximo ${MAX_DIAS} dias` });
  }

  // inicio do periodo (00:00 do primeiro dia) e fim (00:00 do dia seguinte ao ultimo), no fuso de brasilia
  const INI = `$1::date::timestamp AT TIME ZONE '${FUSO}'`;
  const FIM = `($2::date + 1)::timestamp AT TIME ZONE '${FUSO}'`;
  const params = [inicio, fim];

  try {
    // as 5 consultas sao independentes, entao rodam juntas
    const [porEspaco, porStatus, porHora, porDiaSemana, porEmpresa] =
      await Promise.all([
        // por espaco: horas disponiveis x horas usadas
        pool.query(
          `WITH dias AS (
                    SELECT d::date AS dia FROM generate_series($1::date, $2::date, interval '1 day') d
                 ),
                 capacidade AS (
                    SELECT sa.space_id,
                           SUM(EXTRACT(EPOCH FROM (sa.end_time - sa.start_time)) / 3600.0) AS horas
                      FROM dias
                      JOIN space_availability sa ON sa.day_of_week = EXTRACT(DOW FROM dias.dia)::int
                     GROUP BY sa.space_id
                 ),
                 uso AS (
                    SELECT b.space_id,
                           COUNT(*) AS reservas,
                           SUM(EXTRACT(EPOCH FROM (LEAST(b.end_datetime, ${FIM}) - GREATEST(b.start_datetime, ${INI}))) / 3600.0) AS horas
                      FROM bookings b
                     WHERE b.status = 'APPROVED'
                       AND b.start_datetime < ${FIM}
                       AND b.end_datetime   > ${INI}
                     GROUP BY b.space_id
                 )
                 SELECT s.id::int AS space_id, s.name, s.type,
                        COALESCE(capacidade.horas, 0) AS horas_disponiveis,
                        COALESCE(uso.horas, 0)        AS horas_uso,
                        COALESCE(uso.reservas, 0)::int AS reservas
                   FROM spaces s
                   LEFT JOIN capacidade ON capacidade.space_id = s.id
                   LEFT JOIN uso        ON uso.space_id = s.id
                  ORDER BY s.name`,
          params,
        ),

        // quantas reservas em cada status (pelo inicio da reserva)
        pool.query(
          `SELECT status, COUNT(*)::int AS total
                   FROM bookings
                  WHERE start_datetime < ${FIM} AND end_datetime > ${INI}
                  GROUP BY status`,
          params,
        ),

        //horarios de pico: quantas reservas aprovadas ocupam cada hora do dia
        // generate_series cria uma linha por hora ocupada pela reserva (no horario de brasilia)
        pool.query(
          `SELECT EXTRACT(HOUR FROM h)::int AS hora, COUNT(*)::int AS reservas
                   FROM bookings b
                  CROSS JOIN LATERAL generate_series(
                        date_trunc('hour', b.start_datetime AT TIME ZONE '${FUSO}'),
                        (b.end_datetime AT TIME ZONE '${FUSO}') - interval '1 second',
                        interval '1 hour') AS h
                  WHERE b.status = 'APPROVED'
                    AND b.start_datetime < ${FIM}
                    AND b.end_datetime   > ${INI}
                  GROUP BY hora
                  ORDER BY hora`,
          params,
        ),

        // dias da semana mais movimentados (0 = domingo ... 6 = sabado)
        pool.query(
          `SELECT EXTRACT(DOW FROM b.start_datetime AT TIME ZONE '${FUSO}')::int AS dia_semana,
                        COUNT(*)::int AS reservas
                   FROM bookings b
                  WHERE b.status = 'APPROVED'
                    AND b.start_datetime < ${FIM}
                    AND b.end_datetime   > ${INI}
                  GROUP BY dia_semana
                  ORDER BY dia_semana`,
          params,
        ),

        //perfil dos solicitantes: quem mais usa (empresa ou pessoa fisica)
        pool.query(
          `SELECT COALESCE(c.trade_name, c.corporate_name, 'Pessoa física') AS nome,
                        CASE WHEN c.id IS NULL THEN 'PESSOA_FISICA' ELSE 'EMPRESA' END AS tipo,
                        COUNT(*)::int AS reservas,
                        SUM(EXTRACT(EPOCH FROM (LEAST(b.end_datetime, ${FIM}) - GREATEST(b.start_datetime, ${INI}))) / 3600.0) AS horas
                   FROM bookings b
                   JOIN users u ON u.id = b.user_id
                   LEFT JOIN companies c ON c.id = u.company_id
                  WHERE b.status = 'APPROVED'
                    AND b.start_datetime < ${FIM}
                    AND b.end_datetime   > ${INI}
                  GROUP BY c.id, c.trade_name, c.corporate_name
                  ORDER BY horas DESC
                  LIMIT 10`,
          params,
        ),
      ]);

    // taxa de ocupacao de cada espaco (null se o espaco nao tem horario cadastrado no periodo)
    const espacos = porEspaco.rows.map((e) => {
      const disponiveis = Number(e.horas_disponiveis);
      const uso = Number(e.horas_uso);
      return {
        space_id: e.space_id,
        name: e.name,
        type: e.type,
        reservas: e.reservas,
        horas_disponiveis: num(disponiveis),
        horas_uso: num(uso),
        taxa_ocupacao:
          disponiveis > 0 ? num(Math.min(uso / disponiveis, 1) * 100) : null,
      };
    });

    const totalDisponiveis = espacos.reduce(
      (soma, e) => soma + e.horas_disponiveis,
      0,
    );
    const totalUso = espacos.reduce((soma, e) => soma + e.horas_uso, 0);

    // todos os status aparecem, mesmo com 0
    const status = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    porStatus.rows.forEach((linha) => {
      status[linha.status] = linha.total;
    });

    res.json({
      periodo: { inicio, fim, dias },
      resumo: {
        horas_disponiveis: num(totalDisponiveis),
        horas_uso: num(totalUso),
        taxa_ocupacao:
          totalDisponiveis > 0
            ? num(Math.min(totalUso / totalDisponiveis, 1) * 100)
            : null,
        reservas_por_status: status,
      },
      por_espaco: espacos,
      por_hora: porHora.rows,
      por_dia_semana: porDiaSemana.rows,
      por_empresa: porEmpresa.rows.map((e) => ({ ...e, horas: num(e.horas) })),
    });
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /relatorios/ocupacao:
 *   get:
 *     summary: Relatório de ocupação (horas de uso, taxa de ocupação, horários de pico e empresas)
 *     description: Só ADMIN. Considera as reservas aprovadas. Sem parâmetros, usa os últimos 30 dias.
 *     tags: [Relatórios]
 *     parameters:
 *       - in: query
 *         name: inicio
 *         schema: { type: string, example: "2026-11-01" }
 *       - in: query
 *         name: fim
 *         schema: { type: string, example: "2026-11-30" }
 *     responses:
 *       200:
 *         description: Métricas do período
 *       400:
 *         description: Datas inválidas ou período maior que 366 dias
 */

// números da tela inicial de funcionário e admin
router.get("/painel", async function (req, res) {
  const AGORA = `(now() AT TIME ZONE '${FUSO}')`;
  const MES = `date_trunc('month', ${AGORA})`;
  const SEIS_MESES = `(${MES} - interval '5 months')`;
  const INICIO = `(b.start_datetime AT TIME ZONE '${FUSO}')`;
  const HORAS = `EXTRACT(EPOCH FROM (b.end_datetime - b.start_datetime)) / 3600.0`;

  try {
    const [resumo, clientes, porMes, porTipo, porEspaco, proximas] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE ${INICIO} >= ${MES} AND ${INICIO} < ${MES} + interval '1 month')::int AS reservas_mes,
                COUNT(*) FILTER (WHERE ${INICIO} >= ${MES} - interval '1 month' AND ${INICIO} < ${MES})::int AS reservas_mes_anterior,
                COALESCE(SUM(${HORAS}) FILTER (WHERE b.status = 'APPROVED' AND ${INICIO} >= ${MES} AND ${INICIO} < ${MES} + interval '1 month'), 0) AS horas_mes,
                COALESCE(SUM(${HORAS}) FILTER (WHERE b.status = 'APPROVED' AND ${INICIO} >= ${MES} - interval '1 month' AND ${INICIO} < ${MES}), 0) AS horas_mes_anterior,
                COUNT(*) FILTER (WHERE b.status = 'PENDING' AND b.end_datetime >= now())::int AS pendentes
           FROM bookings b`,
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE is_active)::int AS ativos,
                COUNT(*) FILTER (WHERE (created_at AT TIME ZONE '${FUSO}') >= ${MES})::int AS novos_mes,
                COUNT(*) FILTER (WHERE (created_at AT TIME ZONE '${FUSO}') >= ${MES} - interval '1 month'
                                   AND (created_at AT TIME ZONE '${FUSO}') < ${MES})::int AS novos_mes_anterior
           FROM users
          WHERE role = 'CLIENT'`,
      ),
      pool.query(
        `SELECT to_char(m.mes, 'YYYY-MM') AS mes,
                COUNT(b.id)::int AS solicitadas,
                COUNT(b.id) FILTER (WHERE b.status = 'APPROVED')::int AS aprovadas
           FROM generate_series(${SEIS_MESES}, ${MES}, interval '1 month') AS m(mes)
           LEFT JOIN bookings b ON ${INICIO} >= m.mes AND ${INICIO} < m.mes + interval '1 month'
          GROUP BY m.mes
          ORDER BY m.mes`,
      ),
      pool.query(
        `SELECT s.type, COUNT(b.id)::int AS reservas
           FROM spaces s
           LEFT JOIN bookings b ON b.space_id = s.id AND b.status = 'APPROVED' AND ${INICIO} >= ${SEIS_MESES}
          GROUP BY s.type
          ORDER BY reservas DESC, s.type`,
      ),
      pool.query(
        `SELECT s.id::int, s.name, COUNT(b.id)::int AS reservas
           FROM spaces s
           LEFT JOIN bookings b ON b.space_id = s.id AND b.status = 'APPROVED' AND ${INICIO} >= ${SEIS_MESES}
          GROUP BY s.id, s.name
          ORDER BY reservas DESC, s.name
          LIMIT 5`,
      ),
      pool.query(
        `SELECT b.id::int, b.start_datetime, b.end_datetime, b.status,
                s.name AS space_name, u.name AS user_name
           FROM bookings b
           JOIN spaces s ON s.id = b.space_id
           JOIN users u ON u.id = b.user_id
          WHERE b.status IN ('PENDING', 'APPROVED') AND b.end_datetime >= now()
          ORDER BY b.start_datetime
          LIMIT 5`,
      ),
    ]);

    const r = resumo.rows[0];
    res.json({
      resumo: {
        reservas_mes: r.reservas_mes,
        reservas_mes_anterior: r.reservas_mes_anterior,
        horas_mes: num(r.horas_mes),
        horas_mes_anterior: num(r.horas_mes_anterior),
        pendentes: r.pendentes,
        clientes_ativos: clientes.rows[0].ativos,
        clientes_novos_mes: clientes.rows[0].novos_mes,
        clientes_novos_mes_anterior: clientes.rows[0].novos_mes_anterior,
      },
      por_mes: porMes.rows,
      por_tipo: porTipo.rows,
      por_espaco: porEspaco.rows,
      proximas: proximas.rows,
    });
  } catch (err) {
    responderErro(res, err);
  }
});

/**
 * @swagger
 * /relatorios/painel:
 *   get:
 *     summary: Números da tela inicial (cartões, reservas por mês, por tipo e espaços mais usados)
 *     description: ADMIN e RECEPTION. Gráficos usam os últimos 6 meses.
 *     tags: [Relatórios]
 *     responses:
 *       200:
 *         description: Resumo do painel
 */

module.exports = router;
