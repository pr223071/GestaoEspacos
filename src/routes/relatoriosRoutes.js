// =====================================================================
// rotas de relatorios (metricas de uso) - enzo
//
// a especificacao pede "metricas e relatorios: horas de uso e taxa de ocupacao"
// e a tela de relatorios pede "taxas, horarios de pico e perfil das empresas"
//
// regras usadas nos calculos:
//   - horas de uso = soma das horas das reservas APROVADAS no periodo
//   - horas disponiveis = soma das janelas da matriz de disponibilidade
//     (space_availability) de cada dia do periodo
//   - taxa de ocupacao = horas de uso / horas disponiveis * 100
//
// as consultas ao banco sao SELECTs simples (sem JOIN, sem apelido de tabela);
// os calculos (somas, agrupamentos, taxas) sao feitos aqui no javascript
//
// rotas (so ADMIN, ligado no index.js):
//   get /relatorios/ocupacao?inicio=AAAA-MM-DD&fim=AAAA-MM-DD
//       sem parametros = ultimos 30 dias ate hoje (fim e inclusivo)
// =====================================================================

const express = require("express");
const { pool } = require("../config/db");
const { responderErro } = require("../utils/banco");

const router = express.Router();

// horario de brasilia = utc - 3h (o brasil nao usa mais horario de verao)
// o banco guarda em utc; aqui a gente desloca 3h pra ler dia e hora "de brasilia"
const OFFSET_MS = 3 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

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

// "08:30:00" -> 8.5 (horas)
function horasDoDia(texto) {
  const [hora, minuto] = String(texto).split(":");
  return Number(hora) + Number(minuto) / 60;
}

router.get("/ocupacao", async function (req, res) {
  // periodo padrao: ultimos 30 dias
  const hoje = new Date();
  const inicio =
    req.query.inicio || paraAAAAMMDD(new Date(hoje.getTime() - 29 * DIA_MS));
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
  const dias = Math.round((new Date(fim) - new Date(inicio)) / DIA_MS) + 1;
  if (dias > MAX_DIAS) {
    return res
      .status(400)
      .json({ erro: `O período pode ter no máximo ${MAX_DIAS} dias` });
  }

  // comeco do periodo (00:00 do primeiro dia) e fim (00:00 do dia seguinte ao ultimo), em utc
  const comecoPeriodo = new Date(`${inicio}T00:00:00Z`).getTime() + OFFSET_MS;
  const fimPeriodo =
    new Date(`${fim}T00:00:00Z`).getTime() + DIA_MS + OFFSET_MS;

  try {
    // consultas simples, cada uma em uma tabela so; rodam juntas
    const [reservas, espacosBanco, janelas, usuarios, empresas] =
      await Promise.all([
        // reservas que encostam no periodo
        pool.query(
          `SELECT id, space_id, user_id, status, start_datetime, end_datetime
             FROM bookings
            WHERE start_datetime < $2 AND end_datetime > $1`,
          [new Date(comecoPeriodo), new Date(fimPeriodo)],
        ),
        pool.query(`SELECT id, name, type FROM spaces ORDER BY name`),
        pool.query(
          `SELECT space_id, day_of_week, start_time, end_time FROM space_availability`,
        ),
        pool.query(`SELECT id, company_id FROM users`),
        pool.query(`SELECT id, trade_name, corporate_name FROM companies`),
      ]);

    // ---------- horas disponiveis de cada espaco ----------
    // para cada dia do periodo, soma as janelas cadastradas pro dia da semana dele
    const disponiveisPorEspaco = new Map(); // space_id -> horas
    for (let i = 0; i < dias; i++) {
      const diaSemana = new Date(
        new Date(inicio).getTime() + i * DIA_MS,
      ).getUTCDay();
      for (const janela of janelas.rows) {
        if (janela.day_of_week !== diaSemana) continue;
        const horas =
          horasDoDia(janela.end_time) - horasDoDia(janela.start_time);
        const id = Number(janela.space_id);
        disponiveisPorEspaco.set(
          id,
          (disponiveisPorEspaco.get(id) || 0) + horas,
        );
      }
    }

    // ---------- reservas: status, horas, picos e empresas ----------
    const status = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    const usoPorEspaco = new Map(); // space_id -> { horas, reservas }
    const porHora = new Map(); // 0..23 -> reservas
    const porDiaSemana = new Map(); // 0..6 -> reservas
    const usoPorSolicitante = new Map(); // nome -> { nome, tipo, reservas, horas }

    // id do usuario -> id da empresa, e id da empresa -> nome
    const empresaDoUsuario = new Map(
      usuarios.rows.map((u) => [Number(u.id), u.company_id]),
    );
    const nomeDaEmpresa = new Map(
      empresas.rows.map((e) => [
        Number(e.id),
        e.trade_name || e.corporate_name,
      ]),
    );

    for (const reserva of reservas.rows) {
      status[reserva.status] = (status[reserva.status] || 0) + 1;
      if (reserva.status !== "APPROVED") continue;

      const comeco = new Date(reserva.start_datetime).getTime();
      const termino = new Date(reserva.end_datetime).getTime();

      // horas dentro do periodo (reserva que passa da borda conta so a parte de dentro)
      const horas =
        (Math.min(termino, fimPeriodo) - Math.max(comeco, comecoPeriodo)) /
        HORA_MS;

      const espaco = usoPorEspaco.get(Number(reserva.space_id)) || {
        horas: 0,
        reservas: 0,
      };
      espaco.horas += horas;
      espaco.reservas += 1;
      usoPorEspaco.set(Number(reserva.space_id), espaco);

      // dia da semana pelo inicio da reserva (horario de brasilia)
      const diaSemana = new Date(comeco - OFFSET_MS).getUTCDay();
      porDiaSemana.set(diaSemana, (porDiaSemana.get(diaSemana) || 0) + 1);

      // horarios de pico: soma 1 em cada hora que a reserva ocupa
      let hora = Math.floor((comeco - OFFSET_MS) / HORA_MS) * HORA_MS;
      while (hora < termino - OFFSET_MS) {
        const horaDoDia = new Date(hora).getUTCHours();
        porHora.set(horaDoDia, (porHora.get(horaDoDia) || 0) + 1);
        hora += HORA_MS;
      }

      // perfil dos solicitantes: empresa (pelo usuario) ou pessoa fisica
      const idEmpresa = empresaDoUsuario.get(Number(reserva.user_id));
      const emEmpresa = idEmpresa !== null && idEmpresa !== undefined;
      const nome = emEmpresa
        ? nomeDaEmpresa.get(Number(idEmpresa)) || `Empresa ${idEmpresa}`
        : "Pessoa física";
      const chave = emEmpresa ? `empresa-${idEmpresa}` : "pessoa-fisica";
      const solicitante = usoPorSolicitante.get(chave) || {
        nome,
        tipo: emEmpresa ? "EMPRESA" : "PESSOA_FISICA",
        reservas: 0,
        horas: 0,
      };
      solicitante.reservas += 1;
      solicitante.horas += horas;
      usoPorSolicitante.set(chave, solicitante);
    }

    // ---------- monta a resposta ----------
    // taxa de ocupacao de cada espaco (null se o espaco nao tem horario cadastrado no periodo)
    const espacos = espacosBanco.rows.map((espaco) => {
      const id = Number(espaco.id);
      const disponiveis = disponiveisPorEspaco.get(id) || 0;
      const uso = usoPorEspaco.get(id) || { horas: 0, reservas: 0 };
      return {
        space_id: id,
        name: espaco.name,
        type: espaco.type,
        reservas: uso.reservas,
        horas_disponiveis: num(disponiveis),
        horas_uso: num(uso.horas),
        taxa_ocupacao:
          disponiveis > 0
            ? num(Math.min(uso.horas / disponiveis, 1) * 100)
            : null,
      };
    });

    const totalDisponiveis = espacos.reduce(
      (soma, e) => soma + e.horas_disponiveis,
      0,
    );
    const totalUso = espacos.reduce((soma, e) => soma + e.horas_uso, 0);

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
      por_hora: [...porHora.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([hora, total]) => ({ hora, reservas: total })),
      por_dia_semana: [...porDiaSemana.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([dia, total]) => ({ dia_semana: dia, reservas: total })),
      por_empresa: [...usoPorSolicitante.values()]
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10)
        .map((s) => ({ ...s, horas: num(s.horas) })),
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

module.exports = router;
