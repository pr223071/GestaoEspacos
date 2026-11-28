import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock, Users, Timer, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import '../css/painel.css';

const API_URL = 'http://localhost:3080';

const STATUS = { PENDING: 'Pendente', APPROVED: 'Aprovada', REJECTED: 'Recusada', CANCELLED: 'Cancelada' };

// cor fixa por tipo de espaço (a cor segue o tipo, não a posição)
const TIPOS = {
  MEETING_ROOM: { nome: 'Sala de reunião', cor: 'var(--serie-1)' },
  COWORKING: { nome: 'Coworking', cor: 'var(--serie-2)' },
  LAB: { nome: 'Laboratório', cor: 'var(--serie-3)' },
  AUDITORIUM: { nome: 'Auditório', cor: 'var(--serie-4)' },
};
const tipo = (t) => TIPOS[t] || { nome: t, cor: 'var(--grafico-contexto)' };

const formatar = (n) => Number(n || 0).toLocaleString('pt-BR');

function nomeMes(aaaamm, formato = 'short') {
  const [ano, mes] = aaaamm.split('-').map(Number);
  const texto = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: formato });
  return texto.replace('.', '').replace(/^./, (c) => c.toUpperCase());
}

// arredonda o topo do eixo para um número "bonito" (5, 10, 20, 50...)
function topoDoEixo(maior) {
  if (maior <= 4) return 4;
  const passo = Math.pow(10, Math.floor(Math.log10(maior / 4)));
  const opcoes = [1, 2, 2.5, 5, 10].map((m) => m * passo);
  const escolhido = opcoes.find((p) => p * 4 >= maior);
  return escolhido * 4;
}

function Variacao({ atual, anterior }) {
  if (!anterior) return atual > 0 ? <span className="painel-variacao neutra">novo</span> : null;
  const pct = Math.round(((atual - anterior) / anterior) * 1000) / 10;
  const subiu = pct >= 0;
  const Icone = subiu ? TrendingUp : TrendingDown;
  return (
    <span className={subiu ? 'painel-variacao sobe' : 'painel-variacao desce'}>
      <Icone size={13} /> {subiu ? '+' : ''}{String(pct).replace('.', ',')}%
    </span>
  );
}

function GraficoBarras({ meses }) {
  const topo = topoDoEixo(Math.max(0, ...meses.flatMap((m) => [m.solicitadas, m.aprovadas])));
  const marcas = [0, 1, 2, 3, 4].map((i) => (topo / 4) * i);
  const altura = (v) => `${(v / topo) * 100}%`;

  return (
    <>
      <div className="painel-legenda">
        <span><i style={{ background: 'var(--grafico-contexto)' }} /> Solicitadas</span>
        <span><i style={{ background: 'var(--destaque)' }} /> Aprovadas</span>
      </div>

      <div className="barras" aria-hidden="true">
        <div className="barras-eixo">
          {marcas.map((m) => (
            <span key={m} style={{ bottom: altura(m) }}>{formatar(m)}</span>
          ))}
        </div>
        <div className="barras-area">
          {marcas.map((m) => (
            <div key={m} className={m === 0 ? 'barras-linha base' : 'barras-linha'} style={{ bottom: altura(m) }} />
          ))}
          {meses.map((m) => (
            <div key={m.mes} className="barras-grupo" tabIndex={0}>
              <div className="barras-par">
                <span className="barra contexto" style={{ height: altura(m.solicitadas) }} />
                <span className="barra" style={{ height: altura(m.aprovadas) }} />
              </div>
              <span className="barras-mes">{nomeMes(m.mes)}</span>
              <div className="painel-dica">
                <strong>{nomeMes(m.mes, 'long')}</strong>
                <span><i style={{ background: 'var(--grafico-contexto)' }} /> Solicitadas <b>{m.solicitadas}</b></span>
                <span><i style={{ background: 'var(--destaque)' }} /> Aprovadas <b>{m.aprovadas}</b></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Reservas por mês</caption>
        <thead><tr><th>Mês</th><th>Solicitadas</th><th>Aprovadas</th></tr></thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes}><td>{nomeMes(m.mes, 'long')}</td><td>{m.solicitadas}</td><td>{m.aprovadas}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function GraficoRosca({ tipos }) {
  const [ativo, setAtivo] = useState(null);
  const total = tipos.reduce((s, t) => s + t.reservas, 0);
  const raio = 48;
  const volta = 2 * Math.PI * raio;
  const espaco = tipos.filter((t) => t.reservas > 0).length > 1 ? 2 : 0;

  const tamanhos = tipos.map((t) => (total ? (t.reservas / total) * volta : 0));
  const fatias = tipos.map((t, i) => ({
    ...t,
    tamanho: tamanhos[i],
    inicio: tamanhos.slice(0, i).reduce((s, n) => s + n, 0),
  }));

  const destaque = ativo !== null ? fatias[ativo] : null;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <>
      <div className="rosca">
        <svg viewBox="0 0 120 120" role="img" aria-label="Reservas aprovadas por tipo de espaço">
          <circle cx="60" cy="60" r={raio} className="rosca-trilho" />
          {fatias.map((f, i) =>
            f.tamanho > 0 ? (
              <circle
                key={f.type}
                cx="60"
                cy="60"
                r={raio}
                className={ativo !== null && ativo !== i ? 'rosca-fatia apagada' : 'rosca-fatia'}
                stroke={tipo(f.type).cor}
                strokeDasharray={`${Math.max(f.tamanho - espaco, 0.5)} ${volta}`}
                strokeDashoffset={-f.inicio}
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
              />
            ) : null,
          )}
        </svg>
        <div className="rosca-centro">
          <strong>{destaque ? destaque.reservas : total}</strong>
          <span>{destaque ? tipo(destaque.type).nome : 'reservas'}</span>
        </div>
      </div>

      {total === 0 && <p className="painel-vazio">Nenhuma reserva aprovada nos últimos 6 meses.</p>}

      <ul className="rosca-lista">
        {tipos.map((t, i) => (
          <li
            key={t.type}
            className={ativo === i ? 'ativo' : ''}
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
          >
            <i style={{ background: tipo(t.type).cor }} />
            <span>{tipo(t.type).nome}</span>
            <b>{t.reservas}</b>
            <em>{pct(t.reservas)}%</em>
          </li>
        ))}
      </ul>
    </>
  );
}

function EspacosMaisUsados({ espacos }) {
  const maior = Math.max(1, ...espacos.map((e) => e.reservas));
  if (espacos.length === 0) return <p className="painel-vazio">Nenhum espaço cadastrado.</p>;
  return (
    <ul className="ranking">
      {espacos.map((e) => (
        <li key={e.id}>
          <div>
            <span>{e.name}</span>
            <b>{e.reservas}</b>
          </div>
          <span className="ranking-trilho">
            <span style={{ width: `${(e.reservas / maior) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// tela inicial de funcionário e admin
function PainelEquipe({ primeiroNome }) {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch(`${API_URL}/relatorios/painel`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.erro || 'Não foi possível carregar o painel');
        setDados(json);
      } catch (e) {
        setErro(e.message || 'Não foi possível conectar ao servidor');
      }
    }
    carregar();
  }, [navigate]);

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const cabecalho = (
    <>
      <h1>
        Bem-vindo de volta, <strong>{primeiroNome}!</strong>
      </h1>
      <p className="home-sub">{hoje.replace(/^./, (c) => c.toUpperCase())}</p>
    </>
  );

  if (erro || !dados) {
    return (
      <main className="home-principal">
        {cabecalho}
        <p className="painel-vazio painel-carregando">{erro || 'Carregando...'}</p>
      </main>
    );
  }

  const r = dados.resumo;
  const cartoes = [
    {
      titulo: 'Reservas no mês',
      valor: formatar(r.reservas_mes),
      icone: CalendarCheck,
      detalhe: 'vs mês passado',
      variacao: <Variacao atual={r.reservas_mes} anterior={r.reservas_mes_anterior} />,
    },
    {
      titulo: 'Horas reservadas',
      valor: `${String(r.horas_mes).replace('.', ',')} h`,
      icone: Timer,
      detalhe: 'aprovadas, vs mês passado',
      variacao: <Variacao atual={r.horas_mes} anterior={r.horas_mes_anterior} />,
    },
    {
      titulo: 'Aguardando aprovação',
      valor: formatar(r.pendentes),
      icone: Clock,
      detalhe: 'reservas pendentes',
      ir: '/gestao/reservas',
    },
    {
      titulo: 'Clientes ativos',
      valor: formatar(r.clientes_ativos),
      icone: Users,
      detalhe: `${r.clientes_novos_mes} novos este mês`,
      variacao: <Variacao atual={r.clientes_novos_mes} anterior={r.clientes_novos_mes_anterior} />,
    },
  ];

  const hora = { hour: '2-digit', minute: '2-digit' };

  return (
    <main className="home-principal">
      {cabecalho}

      <div className="painel">
        {cartoes.map((c, i) => {
          const Icone = c.icone;
          return (
            <div
              key={c.titulo}
              className={c.ir ? 'painel-cartao clicavel' : 'painel-cartao'}
              style={{ animationDelay: `${i * 70}ms` }}
              onClick={c.ir ? () => navigate(c.ir) : undefined}
            >
              <div className="painel-cartao-topo">
                <span className="painel-icone"><Icone size={19} strokeWidth={1.8} /></span>
                {c.variacao}
              </div>
              <span className="painel-cartao-titulo">{c.titulo}</span>
              <div className="painel-cartao-valor">
                <strong>{c.valor}</strong>
                <small>{c.detalhe}</small>
              </div>
            </div>
          );
        })}

        <section className="painel-bloco painel-tipos">
          <h2>Reservas por tipo</h2>
          <p>Aprovadas nos últimos 6 meses</p>
          <GraficoRosca tipos={dados.por_tipo} />
        </section>

        <section className="painel-bloco painel-meses">
          <h2>Reservas por mês</h2>
          <p>Últimos 6 meses</p>
          <GraficoBarras meses={dados.por_mes} />
        </section>

        <section className="painel-bloco painel-espacos">
          <h2>Espaços mais usados</h2>
          <p>Reservas aprovadas nos últimos 6 meses</p>
          <EspacosMaisUsados espacos={dados.por_espaco} />
        </section>
      </div>

      <section className="home-reservas">
        <div className="home-reservas-topo">
          <h2>Próximas reservas</h2>
          <button className="home-ver-todas" onClick={() => navigate('/gestao/reservas')}>
            Gestão de reservas <ArrowUpRight size={15} />
          </button>
        </div>

        {dados.proximas.length === 0 ? (
          <p className="home-vazio">Nenhuma reserva futura no sistema.</p>
        ) : (
          <div className="painel-tabela">
            <table className="home-tabela">
              <thead>
                <tr><th>Espaço</th><th>Cliente</th><th>Data</th><th>Horário</th><th>Status</th></tr>
              </thead>
              <tbody>
                {dados.proximas.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.space_name}</strong></td>
                    <td>{b.user_name}</td>
                    <td>{new Date(b.start_datetime).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {new Date(b.start_datetime).toLocaleTimeString('pt-BR', hora)} -{' '}
                      {new Date(b.end_datetime).toLocaleTimeString('pt-BR', hora)}
                    </td>
                    <td><em className="home-status">{STATUS[b.status] || b.status}</em></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default PainelEquipe;
