import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Check, X, Ban } from 'lucide-react';
import '../css/gestao.css';

const API_URL = 'http://localhost:3080';

// o status vem do banco em inglês; aqui vira o texto da tela e a cor da etiqueta
const STATUS = {
  PENDING: { texto: 'Pendente', classe: 'pendente' },
  APPROVED: { texto: 'Aprovada', classe: 'aprovada' },
  REJECTED: { texto: 'Recusada', classe: 'recusada' },
  CANCELLED: { texto: 'Cancelada', classe: 'cancelada' },
};

// abas do topo; '' = mostrar todas
const ABAS = [
  { valor: 'PENDING', texto: 'Pendentes' },
  { valor: 'APPROVED', texto: 'Aprovadas' },
  { valor: 'REJECTED', texto: 'Recusadas' },
  { valor: 'CANCELLED', texto: 'Canceladas' },
  { valor: '', texto: 'Todas' },
];

// o banco guarda a data em UTC; mostramos no horário de Brasília
const FUSO = 'America/Sao_Paulo';

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO });
}

function formatarHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
}

// Tela do funcionário: aprovar, recusar e cancelar reservas
function GestaoReservas() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [aba, setAba] = useState('PENDING'); // abre mostrando o que precisa de ação
  const [busca, setBusca] = useState('');

  // id da reserva que está sendo recusada (abre a caixa do motivo) e o motivo digitado
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState('');

  // id da reserva que está sendo salva, para desabilitar os botões dela
  const [processando, setProcessando] = useState(null);

  // sem token válido não tem o que fazer aqui: volta para o login
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

  // troca o status de uma reserva no back-end (aprovar, recusar ou cancelar)
  async function alterarStatus(reserva, novoStatus, motivoRecusa) {
    setErro('');
    setMensagem('');
    setProcessando(reserva.id);

    const corpo = { status: novoStatus };
    // quem aprovou/recusou fica registrado na reserva
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

      // o banco recusa quando a regra não deixa (ex.: horário já ocupado); mostra o motivo
      if (!response.ok) {
        setErro(dados.erro || 'Não foi possível atualizar a reserva');
        return;
      }

      // o PUT devolve a reserva sem os nomes do espaço e do cliente,
      // então juntamos o que já tínhamos com o que voltou
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
    // cancelar não tem volta, por isso pergunta antes
    const ok = window.confirm(`Cancelar a reserva de ${reserva.user_name} em "${reserva.space_name}" no dia ${formatarData(reserva.start_datetime)}?`);
    if (ok) alterarStatus(reserva, 'CANCELLED');
  }

  const pendentes = reservas.filter((r) => r.status === 'PENDING').length;

  // lista da tela: filtra pela aba e pela busca e ordena pela data da reserva
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
                    // Fragment: cada reserva pode ter 2 linhas (a dela + a do motivo da recusa)
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
                          {/* só aparecem as ações que o banco aceita para cada status:
                              pendente -> aprovar, recusar ou cancelar; aprovada -> cancelar */}
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
