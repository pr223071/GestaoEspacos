import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Check, X, Ban } from 'lucide-react';
import '../css/gestao.css';

const API_URL = 'http://localhost:3080';

// o status vem do banco em ingles, aqui eu traduzo e escolho a cor da etiqueta
const STATUS = {
  PENDING: { texto: 'Pendente', classe: 'pendente' },
  APPROVED: { texto: 'Aprovada', classe: 'aprovada' },
  REJECTED: { texto: 'Recusada', classe: 'recusada' },
  CANCELLED: { texto: 'Cancelada', classe: 'cancelada' },
};

// abas lá de cima, o '' é pra mostrar todas
const ABAS = [
  { valor: 'PENDING', texto: 'Pendentes' },
  { valor: 'APPROVED', texto: 'Aprovadas' },
  { valor: 'REJECTED', texto: 'Recusadas' },
  { valor: 'CANCELLED', texto: 'Canceladas' },
  { valor: '', texto: 'Todas' },
];

// o banco salva em UTC entao tem que converter pro horario de brasilia senao fica 3h errado
const FUSO = 'America/Sao_Paulo';

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO });
}

function formatarHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
}

// tela do funcionario, aqui ele aprova, recusa e cancela as reservas
function GestaoReservas() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [aba, setAba] = useState('PENDING'); // já abre nas pendentes que é o que importa
  const [busca, setBusca] = useState('');

  // qual reserva ta sendo recusada (pra abrir a caixinha do motivo) e o motivo que digitou
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState('');

  // reserva que ta salvando agora, pra travar os botoes dela e nao clicar 2x
  const [processando, setProcessando] = useState(null);

  // se o token venceu manda pro login
  function sair() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  }

  useEffect(() => {
    async function buscarReservas() {
      try {
        const response = await fetch(`${API_URL}/reservas`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        if (!response.ok) {
          setErro('Não foi possível carregar as reservas');
          return;
        }

        setReservas(await response.json());
      } catch {
        setErro('Não foi possível conectar ao servidor');
      } finally {
        setCarregando(false);
      }
    }

    buscarReservas();
  }, [navigate]);

  // muda o status da reserva no back (aprovar, recusar ou cancelar)
  async function alterarStatus(reserva, novoStatus, motivoRecusa) {
    setErro('');
    setMensagem('');
    setProcessando(reserva.id);

    const corpo = { status: novoStatus };
    // salva quem aprovou ou recusou
    if (novoStatus === 'APPROVED' || novoStatus === 'REJECTED') corpo.reviewed_by = usuario.id;
    if (novoStatus === 'REJECTED') corpo.rejection_reason = motivoRecusa;

    try {
      const response = await fetch(`${API_URL}/reservas/${reserva.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(corpo),
      });

      if (response.status === 401) {
        sair();
        return;
      }

      const dados = await response.json();

      // se o banco barrar (tipo horario ja ocupado) mostra o motivo que ele mandou
      if (!response.ok) {
        setErro(dados.erro || 'Não foi possível atualizar a reserva');
        return;
      }

      // o PUT volta sem o nome do espaço e do cliente
      // entao junto o que ja tinha com o que voltou
      setReservas((lista) => lista.map((r) => (r.id === reserva.id ? { ...r, ...dados } : r)));
      setMensagem(`Reserva de ${reserva.user_name} em "${reserva.space_name}" ${STATUS[novoStatus].texto.toLowerCase()}.`);
      setRecusando(null);
      setMotivo('');
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setProcessando(null);
    }
  }

  function confirmarRecusa(reserva) {
    if (!motivo.trim()) {
      setErro('Informe o motivo da recusa.');
      return;
    }
    alterarStatus(reserva, 'REJECTED', motivo.trim());
  }

  function cancelar(reserva) {
    // cancelar nao tem volta entao pergunta antes
    const ok = window.confirm(`Cancelar a reserva de ${reserva.user_name} em "${reserva.space_name}" no dia ${formatarData(reserva.start_datetime)}?`);
    if (ok) alterarStatus(reserva, 'CANCELLED');
  }

  const pendentes = reservas.filter((r) => r.status === 'PENDING').length;

  // filtra pela aba e pela busca e deixa em ordem de data
  const termo = busca.toLowerCase();
  const reservasFiltradas = reservas
    .filter((r) => aba === '' || r.status === aba)
    .filter((r) => r.space_name.toLowerCase().includes(termo) || r.user_name.toLowerCase().includes(termo))
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

  return (
    <main className="gestao">
      <h1>Gestão de reservas</h1>
      <p className="gestao-sub">Aprove, recuse ou cancele as reservas dos clientes.</p>

      <div className="gestao-abas">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            className={aba === a.valor ? 'gestao-aba ativa' : 'gestao-aba'}
            onClick={() => setAba(a.valor)}
          >
            {a.texto}
            {a.valor === 'PENDING' && pendentes > 0 && <span className="gestao-contador">{pendentes}</span>}
          </button>
        ))}
      </div>

      <div className="gestao-busca">
        <Search size={16} />
        <input
          type="search"
          placeholder="Buscar por espaço ou cliente..."
          aria-label="Buscar por espaço ou cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}
      {mensagem && <p className="gestao-mensagem sucesso" role="status">{mensagem}</p>}

      <section className="gestao-cartao">
        {carregando && <p className="gestao-aviso">Carregando reservas...</p>}

        {!carregando && reservasFiltradas.length === 0 && (
          <p className="gestao-aviso">Nenhuma reserva encontrada.</p>
        )}

        {!carregando && reservasFiltradas.length > 0 && (
          <div className="gestao-tabela-caixa">
            <table className="gestao-tabela">
              <thead>
                <tr>
                  <th>Espaço</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Pessoas</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {reservasFiltradas.map((reserva) => {
                  const status = STATUS[reserva.status];
                  const ocupado = processando === reserva.id;

                  return (
                    // usei Fragment pq cada reserva pode ter 2 linhas (a normal e a do motivo da recusa)
                    <Fragment key={reserva.id}>
                      <tr>
                        <td><strong>{reserva.space_name}</strong></td>
                        <td>{reserva.user_name}</td>
                        <td>{formatarData(reserva.start_datetime)}</td>
                        <td className="suave">
                          {formatarHora(reserva.start_datetime)} - {formatarHora(reserva.end_datetime)}
                        </td>
                        <td>{reserva.attendees}</td>
                        <td>
                          <span className={`gestao-status ${status.classe}`}>{status.texto}</span>
                          {reserva.status === 'REJECTED' && reserva.rejection_reason && (
                            <div className="suave">Motivo: {reserva.rejection_reason}</div>
                          )}
                        </td>
                        <td>
                          {/* so mostra o botao que o banco deixa fazer:
                              pendente da pra aprovar, recusar ou cancelar, aprovada so cancelar */}
                          <div className="gestao-acoes">
                            {reserva.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  className="gestao-acao aprovar"
                                  disabled={ocupado}
                                  onClick={() => alterarStatus(reserva, 'APPROVED')}
                                >
                                  <Check size={14} /> Aprovar
                                </button>
                                <button
                                  type="button"
                                  className="gestao-acao recusar"
                                  disabled={ocupado}
                                  onClick={() => {
                                    setRecusando(reserva.id);
                                    setMotivo('');
                                    setErro('');
                                    // limpa o aviso verde da acao anterior, senao ele ficava junto com o erro
                                    setMensagem('');
                                  }}
                                >
                                  <X size={14} /> Recusar
                                </button>
                              </>
                            )}
                            {(reserva.status === 'PENDING' || reserva.status === 'APPROVED') && (
                              <button
                                type="button"
                                className="gestao-acao cancelar"
                                disabled={ocupado}
                                onClick={() => cancelar(reserva)}
                              >
                                <Ban size={14} /> Cancelar
                              </button>
                            )}
                            {(reserva.status === 'REJECTED' || reserva.status === 'CANCELLED') && (
                              <span className="suave">—</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {recusando === reserva.id && (
                        <tr className="gestao-recusa">
                          <td colSpan={7}>
                            <div className="gestao-recusa-caixa">
                              <input
                                type="text"
                                placeholder="Motivo da recusa (o cliente vai ver)"
                                aria-label="Motivo da recusa"
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="gestao-acao recusar"
                                disabled={ocupado}
                                onClick={() => confirmarRecusa(reserva)}
                              >
                                Confirmar recusa
                              </button>
                              <button
                                type="button"
                                className="gestao-acao cancelar"
                                onClick={() => setRecusando(null)}
                              >
                                Voltar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default GestaoReservas;
