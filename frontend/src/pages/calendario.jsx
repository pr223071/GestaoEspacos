// =====================================================================
// CALENDÁRIO DE RESERVAS - paulo
// mostra a agenda de uma sala com os horarios livres e ocupados, em 3 visoes:
//   - mês:    cada quadradinho é um dia, mostra quantos horarios ocupados e se ainda tem livre
//   - semana: 7 colunas com os horarios de cada dia
//   - dia:    lista do dia inteiro, clicando num horario LIVRE ja abre a tela de reserva preenchida
//
// de onde vem os dados: GET /reservas/agenda/:sala?de=...&ate=...
//   horarios  -> quando a sala funciona em cada dia da semana
//   ocupados  -> reservas pendentes e aprovadas (nao vem o nome de quem reservou, so se é sua)
//   bloqueios -> manutençao/evento cadastrado pelo adm ou recepçao
// o "livre" eu calculo aqui: é o horario de funcionamento tirando o que ta ocupado/bloqueado
//
// cores: verde = livre | vermelho = ocupado | azul = reserva sua | cinza = bloqueado
// =====================================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// funçao do enzo que coloca o token e manda pro login se vencer
import { chamarApi } from '../utils/api';
import '../css/gestao.css';
import '../css/calendario.css';

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const VISOES = [
  { valor: 'mes', texto: 'Mês' },
  { valor: 'semana', texto: 'Semana' },
  { valor: 'dia', texto: 'Dia' },
];

// ---------- ajudantes de data ----------
// trabalho com a data como texto "2026-11-28" pra nao ter problema de fuso horario

// Date -> "2026-11-28"
function paraTexto(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "2026-11-28" -> Date (meio-dia, assim somar dias nunca pula por causa de horario de verao)
function paraData(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

// soma (ou tira, se for negativo) dias de uma data em texto
function somarDias(texto, dias) {
  const d = paraData(texto);
  d.setDate(d.getDate() + dias);
  return paraTexto(d);
}

// "09:30" -> 570 (minutos desde a meia-noite), facilita comparar horarios
function minutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// 570 -> "09:30"
function hora(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// primeiro e ultimo dia que aparecem na tela, conforme a visao
// no mes pego a semana inteira do dia 1 ate a semana inteira do ultimo dia (pra fechar a grade)
function periodoDaVisao(visao, dataRef) {
  const d = paraData(dataRef);
  if (visao === 'dia') return { de: dataRef, ate: dataRef };
  if (visao === 'semana') {
    const domingo = somarDias(dataRef, -d.getDay());
    return { de: domingo, ate: somarDias(domingo, 6) };
  }
  const primeiro = paraTexto(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const ultimo = paraTexto(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  return {
    de: somarDias(primeiro, -paraData(primeiro).getDay()),
    ate: somarDias(ultimo, 6 - paraData(ultimo).getDay()),
  };
}

// ---------- a conta dos horarios livres ----------
// monta a lista de "pedaços" de um dia: os ocupados, os bloqueados e os livres que sobram
// cada pedaço: { ini, fim (em minutos), tipo: 'livre' | 'ocupado' | 'minha' | 'bloqueio', texto }
function pedacosDoDia(dia, agenda, agora) {
  if (!agenda) return [];
  const semana = paraData(dia).getDay();

  // 1) horario que a sala funciona nesse dia da semana
  const funcionamento = agenda.horarios
    .filter((h) => Number(h.day_of_week) === semana)
    .map((h) => ({ ini: minutos(h.inicio), fim: minutos(h.fim) }));

  // 2) o que ta ocupado nesse dia (se a reserva/bloqueio pega mais de um dia, corto so a parte desse dia)
  const cortar = (inicio, fim) => {
    const [dIni, hIni] = inicio.split('T');
    const [dFim, hFim] = fim.split('T');
    if (dIni > dia || dFim < dia) return null; // nao encosta nesse dia
    return { ini: dIni < dia ? 0 : minutos(hIni), fim: dFim > dia ? 24 * 60 : minutos(hFim) };
  };
  const ocupados = [
    ...agenda.ocupados.map((o) => {
      const p = cortar(o.inicio, o.fim);
      return p && { ...p, tipo: o.minha ? 'minha' : 'ocupado', texto: o.minha ? 'Sua reserva' : o.status === 'PENDING' ? 'Ocupado (aguardando aprovação)' : 'Ocupado' };
    }),
    ...agenda.bloqueios.map((b) => {
      const p = cortar(b.inicio, b.fim);
      return p && { ...p, tipo: 'bloqueio', texto: `Bloqueado${b.motivo ? `: ${b.motivo}` : ''}` };
    }),
  ].filter(Boolean);

  // 3) livre = funcionamento menos os ocupados
  // vou "andando" pelo horario de funcionamento e pulando cada pedaço ocupado
  // se o dia ja passou nao tem livre; se é hoje, o livre so começa de agora pra frente
  const hoje = paraTexto(agora);
  const livres = [];
  if (dia >= hoje) {
    const minimo = dia === hoje ? agora.getHours() * 60 + agora.getMinutes() : 0;
    for (const f of funcionamento) {
      let cursor = Math.max(f.ini, minimo);
      const noMeio = ocupados.filter((o) => o.fim > f.ini && o.ini < f.fim).sort((a, b) => a.ini - b.ini);
      for (const o of noMeio) {
        if (o.ini > cursor) livres.push({ ini: cursor, fim: Math.min(o.ini, f.fim), tipo: 'livre', texto: 'Livre' });
        cursor = Math.max(cursor, o.fim);
      }
      if (cursor < f.fim) livres.push({ ini: cursor, fim: f.fim, tipo: 'livre', texto: 'Livre' });
    }
  }

  // junta tudo em ordem de horario (ignoro pedaço de menos de 15 min, nao da pra reservar)
  return [...ocupados, ...livres.filter((l) => l.fim - l.ini >= 15)].sort((a, b) => a.ini - b.ini);
}

function Calendario() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [espacos, setEspacos] = useState([]);
  const [visao, setVisao] = useState('mes');
  const [dataRef, setDataRef] = useState(paraTexto(new Date())); // dia que serve de referencia pra visao
  const [agenda, setAgenda] = useState(null);
  const [erro, setErro] = useState('');
  // o "agora" fica guardado no estado (o lint nao deixa chamar new Date() direto no meio do render)
  const [agora] = useState(() => new Date());

  // a sala escolhida fica no endereço (?espaco=2), assim o link "ver no calendario" da reserva ja abre nela
  const espacoId = params.get('espaco') || (espacos[0] ? String(espacos[0].id) : '');
  const { de, ate } = periodoDaVisao(visao, dataRef);

  // carrega as salas ativas pro select
  useEffect(() => {
    chamarApi('/spaces/status/true').then(({ ok, dados }) => {
      if (ok && Array.isArray(dados)) setEspacos(dados);
      else setErro('Não foi possível carregar os espaços.');
    });
  }, []);

  // busca a agenda sempre que muda a sala ou o periodo da tela
  useEffect(() => {
    if (!espacoId) return;
    let ativo = true;
    chamarApi(`/reservas/agenda/${espacoId}?de=${de}&ate=${ate}`).then(({ ok, dados }) => {
      if (!ativo) return;
      if (ok) {
        setAgenda(dados);
        setErro('');
      } else setErro(dados?.erro || 'Não foi possível carregar a agenda.');
    });
    return () => {
      ativo = false;
    };
  }, [espacoId, de, ate]);

  // lista de dias que aparecem na tela (do "de" ate o "ate")
  const dias = useMemo(() => {
    const lista = [];
    for (let d = de; d <= ate; d = somarDias(d, 1)) lista.push(d);
    return lista;
  }, [de, ate]);

  // setas: anda 1 mes, 1 semana ou 1 dia pra frente/tras
  function andar(direcao) {
    if (visao === 'dia') return setDataRef(somarDias(dataRef, direcao));
    if (visao === 'semana') return setDataRef(somarDias(dataRef, 7 * direcao));
    const d = paraData(dataRef);
    setDataRef(paraTexto(new Date(d.getFullYear(), d.getMonth() + direcao, 1, 12)));
  }

  // clicou num dia no mes ou na semana -> abre a visao do dia
  function abrirDia(dia) {
    setDataRef(dia);
    setVisao('dia');
  }

  // clicou num horario livre -> vai pra tela de reserva com data e horario ja preenchidos
  function reservar(dia, pedaco) {
    navigate(`/reservas/nova/${espacoId}?data=${dia}&inicio=${hora(pedaco.ini)}&fim=${hora(pedaco.fim)}`);
  }

  // titulo do periodo tipo "novembro de 2026", "22/11 a 28/11" ou "sábado, 28/11/2026"
  const ref = paraData(dataRef);
  const tituloMinusculo =
    visao === 'mes'
      ? `${MESES[ref.getMonth()]} de ${ref.getFullYear()}`
      : visao === 'semana'
        ? `${de.split('-').reverse().slice(0, 2).join('/')} a ${ate.split('-').reverse().join('/')}`
        : ref.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  // so a primeira letra maiuscula ("Dezembro de 2026", e nao "Dezembro De 2026")
  const titulo = tituloMinusculo.charAt(0).toUpperCase() + tituloMinusculo.slice(1);

  const hoje = paraTexto(agora);
  const mesAtual = ref.getMonth();

  return (
    <main className="gestao calendario">
      <h1>Calendário</h1>
      <p className="gestao-sub">Veja os horários livres e ocupados de cada espaço. Clique num horário livre para reservar.</p>

      {/* barra de cima: sala, visao (mes/semana/dia) e as setas */}
      <div className="cal-barra">
        <select
          className="cal-select"
          aria-label="Espaço"
          value={espacoId}
          onChange={(e) => setParams({ espaco: e.target.value })}
        >
          {espacos.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="gestao-abas cal-visoes">
          {VISOES.map((v) => (
            <button key={v.valor} type="button" className={visao === v.valor ? 'gestao-aba ativa' : 'gestao-aba'} onClick={() => setVisao(v.valor)}>
              {v.texto}
            </button>
          ))}
        </div>

        <div className="cal-navegar">
          <button type="button" aria-label="Anterior" onClick={() => andar(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="cal-hoje" onClick={() => setDataRef(hoje)}>Hoje</button>
          <button type="button" aria-label="Próximo" onClick={() => andar(1)}><ChevronRight size={18} /></button>
          <strong className="cal-titulo">{titulo}</strong>
        </div>
      </div>

      {/* legenda das cores */}
      <div className="cal-legenda">
        <span><i className="livre" /> Livre</span>
        <span><i className="ocupado" /> Ocupado</span>
        <span><i className="minha" /> Sua reserva</span>
        <span><i className="bloqueio" /> Bloqueado</span>
      </div>

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}

      <section className="gestao-cartao">
        {!agenda && !erro && <p className="gestao-aviso">Carregando agenda...</p>}

        {/* ===== VISÃO MÊS ===== */}
        {agenda && visao === 'mes' && (
          <div className="cal-mes">
            {DIAS_CURTOS.map((d) => <div key={d} className="cal-cabecalho">{d}</div>)}
            {dias.map((dia) => {
              const pedacos = pedacosDoDia(dia, agenda, agora);
              const ocupados = pedacos.filter((p) => p.tipo !== 'livre');
              const temLivre = pedacos.some((p) => p.tipo === 'livre');
              const fechado = !agenda.horarios.some((h) => Number(h.day_of_week) === paraData(dia).getDay());
              const classes = ['cal-dia', paraData(dia).getMonth() !== mesAtual && 'fora', dia === hoje && 'hoje', dia < hoje && 'passado'].filter(Boolean).join(' ');
              return (
                <button key={dia} type="button" className={classes} onClick={() => abrirDia(dia)}>
                  <span className="cal-numero">{Number(dia.slice(8))}</span>
                  {/* mostra ate 2 horarios ocupados, se tiver mais mostra "+N" */}
                  {ocupados.slice(0, 2).map((p, i) => (
                    <span key={i} className={`cal-chip ${p.tipo}`}>{hora(p.ini)}–{hora(p.fim)}</span>
                  ))}
                  {ocupados.length > 2 && <span className="cal-mais">+{ocupados.length - 2}</span>}
                  {fechado ? <span className="cal-fechado">Fechado</span> : temLivre && <span className="cal-chip livre">Livre</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ===== VISÃO SEMANA ===== */}
        {agenda && visao === 'semana' && (
          <div className="cal-semana">
            {dias.map((dia) => {
              const pedacos = pedacosDoDia(dia, agenda, agora);
              return (
                <div key={dia} className={dia === hoje ? 'cal-coluna hoje' : 'cal-coluna'}>
                  <button type="button" className="cal-coluna-topo" onClick={() => abrirDia(dia)}>
                    {DIAS_CURTOS[paraData(dia).getDay()]} <strong>{dia.slice(8)}/{dia.slice(5, 7)}</strong>
                  </button>
                  {pedacos.length === 0 && <span className="cal-fechado">Sem horários</span>}
                  {pedacos.map((p, i) =>
                    p.tipo === 'livre' ? (
                      <button key={i} type="button" className="cal-bloco livre" onClick={() => reservar(dia, p)} title="Reservar esse horário">
                        {hora(p.ini)}–{hora(p.fim)}
                      </button>
                    ) : (
                      <span key={i} className={`cal-bloco ${p.tipo}`} title={p.texto}>
                        {hora(p.ini)}–{hora(p.fim)}
                      </span>
                    ),
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== VISÃO DIA ===== */}
        {agenda && visao === 'dia' && (
          <ul className="cal-dia-lista">
            {pedacosDoDia(dataRef, agenda, agora).length === 0 && (
              <li className="gestao-aviso">Nenhum horário disponível nesse dia (o espaço não funciona ou o dia já passou).</li>
            )}
            {pedacosDoDia(dataRef, agenda, agora).map((p, i) => (
              <li key={i} className={`cal-linha ${p.tipo}`}>
                <span className="cal-linha-hora">{hora(p.ini)} – {hora(p.fim)}</span>
                <span className="cal-linha-texto">{p.texto}</span>
                {/* so o livre tem botao de reservar */}
                {p.tipo === 'livre' && (
                  <button type="button" className="gestao-botao" onClick={() => reservar(dataRef, p)}>
                    Reservar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default Calendario;
