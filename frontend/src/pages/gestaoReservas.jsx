// =====================================================================
// TELA DE GESTAO DE RESERVAS (parte do funcionario)
// aqui o funcionario (RECEPTION) ou o adm ve todas as reservas dos clientes
// e consegue aprovar, recusar (com motivo) ou cancelar
// quando aprova, o proprio banco ja cria o qr code do check-in sozinho (tem um trigger la)
// =====================================================================

// useState guarda as coisas da tela, useEffect roda quando a tela abre
// Fragment é tipo uma "div invisivel", serve pra devolver 2 linhas da tabela juntas
import { Fragment, useEffect, useState } from 'react';
// useNavigate serve pra mandar o usuario pra outra pagina (no caso o login quando o token vence)
import { useNavigate } from 'react-router-dom';
// icones dos botoes (lupa, check, x e o de proibido)
import { Search, Check, X, Ban } from 'lucide-react';
// css compartilhado com as outras telas do funcionario
import '../css/gestao.css';

// endereço do back-end
const API_URL = 'http://localhost:3080';

// o status vem do banco em ingles, aqui eu traduzo e escolho a cor da etiqueta
// a "classe" é o nome da classe no css (gestao.css) que pinta a etiqueta
const STATUS = {
  PENDING: { texto: 'Pendente', classe: 'pendente' },
  APPROVED: { texto: 'Aprovada', classe: 'aprovada' },
  REJECTED: { texto: 'Recusada', classe: 'recusada' },
  CANCELLED: { texto: 'Cancelada', classe: 'cancelada' },
};

// abas lá de cima pra filtrar por status, o '' é pra mostrar todas
const ABAS = [
  { valor: 'PENDING', texto: 'Pendentes' },
  { valor: 'APPROVED', texto: 'Aprovadas' },
  { valor: 'REJECTED', texto: 'Recusadas' },
  { valor: 'CANCELLED', texto: 'Canceladas' },
  { valor: '', texto: 'Todas' },
];

// o banco salva em UTC entao tem que converter pro horario de brasilia senao fica 3h errado
const FUSO = 'America/Sao_Paulo';

// transforma a data do banco em "26/11/2026"
function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO });
}

// transforma a data do banco em "14:30"
function formatarHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
}

// tela do funcionario, aqui ele aprova, recusa e cancela as reservas
function GestaoReservas() {
  const navigate = useNavigate();
  // pega quem ta logado (salvo no login), uso o id dele pra salvar quem aprovou/recusou
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  // ----- estados da tela -----
  const [reservas, setReservas] = useState([]); // todas as reservas que vieram do back
  const [carregando, setCarregando] = useState(true); // mostra "carregando..." enquanto busca
  const [erro, setErro] = useState(''); // aviso vermelho
  const [mensagem, setMensagem] = useState(''); // aviso verde (deu certo)

  const [aba, setAba] = useState('PENDING'); // já abre nas pendentes que é o que importa
  const [busca, setBusca] = useState(''); // o que digitou na busca

  // qual reserva ta sendo recusada (pra abrir a caixinha do motivo) e o motivo que digitou
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState('');

  // reserva que ta salvando agora, pra travar os botoes dela e nao clicar 2x
  const [processando, setProcessando] = useState(null);

  // se o token venceu, apaga o login e manda pra tela de login
  function sair() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  }

  // assim que a tela abre, busca todas as reservas no back (GET /reservas)
  useEffect(() => {
    async function buscarReservas() {
      try {
        // manda o token junto pq a rota precisa estar logado
        const response = await fetch(`${API_URL}/reservas`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        // 401 = token vencido ou invalido, ai volta pro login
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

        // deu certo, guarda a lista
        setReservas(await response.json());
      } catch {
        // cai aqui se o back tiver desligado
        setErro('Não foi possível conectar ao servidor');
      } finally {
        // dando certo ou errado, para de mostrar o "carregando"
        setCarregando(false);
      }
    }

    buscarReservas();
  }, [navigate]);

  // muda o status da reserva no back (aprovar, recusar ou cancelar)
  // é a mesma funçao pros 3 botoes, so muda o novoStatus
  async function alterarStatus(reserva, novoStatus, motivoRecusa) {
    setErro('');
    setMensagem('');
    setProcessando(reserva.id); // trava os botoes dessa reserva

    // monta o que vai mandar pro back
    const corpo = { status: novoStatus };
    // salva quem aprovou ou recusou
    if (novoStatus === 'APPROVED' || novoStatus === 'REJECTED') corpo.reviewed_by = usuario.id;
    // na recusa manda o motivo junto (o cliente vai ver)
    if (novoStatus === 'REJECTED') corpo.rejection_reason = motivoRecusa;

    try {
      // PUT /reservas/:id atualiza a reserva
      // o back confere se quem ta logado é funcionario ou adm, cliente nao consegue aprovar
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
      // aviso verde tipo "Reserva de Ana Lima em "Sala Ipê" aprovada."
      setMensagem(`Reserva de ${reserva.user_name} em "${reserva.space_name}" ${STATUS[novoStatus].texto.toLowerCase()}.`);
      // fecha a caixinha do motivo
      setRecusando(null);
      setMotivo('');
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setProcessando(null); // destrava os botoes
    }
  }

  // botao "confirmar recusa": nao deixa recusar sem escrever o motivo
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

  // quantas tao pendentes, aparece na bolinha laranja da aba
  const pendentes = reservas.filter((r) => r.status === 'PENDING').length;

  // filtra pela aba e pela busca e deixa em ordem de data
  const termo = busca.toLowerCase();
  const reservasFiltradas = reservas
    .filter((r) => aba === '' || r.status === aba) // so as da aba escolhida ('' = todas)
    .filter((r) => r.space_name.toLowerCase().includes(termo) || r.user_name.toLowerCase().includes(termo)) // busca por espaço ou cliente
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)); // mais cedo primeiro

  // ----- daqui pra baixo é o que aparece na tela -----
  return (
    <main className="gestao">
      <h1>Gestão de reservas</h1>
      <p className="gestao-sub">Aprove, recuse ou cancele as reservas dos clientes.</p>

      {/* abas de status, a que ta selecionada fica com a classe "ativa" */}
      <div className="gestao-abas">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            className={aba === a.valor ? 'gestao-aba ativa' : 'gestao-aba'}
            onClick={() => setAba(a.valor)}
          >
            {a.texto}
            {/* bolinha com o numero de pendentes, so na aba pendentes */}
            {a.valor === 'PENDING' && pendentes > 0 && <span className="gestao-contador">{pendentes}</span>}
          </button>
        ))}
      </div>

      {/* campo de busca, filtra na hora enquanto digita */}
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

      {/* avisos: vermelho se deu erro, verde se deu certo */}
      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}
      {mensagem && <p className="gestao-mensagem sucesso" role="status">{mensagem}</p>}

      <section className="gestao-cartao">
        {carregando && <p className="gestao-aviso">Carregando reservas...</p>}

        {!carregando && reservasFiltradas.length === 0 && (
          <p className="gestao-aviso">Nenhuma reserva encontrada.</p>
        )}

        {/* tabela com as reservas */}
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
                  const ocupado = processando === reserva.id; // true enquanto essa ta salvando

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
                          {/* se foi recusada mostra o motivo embaixo */}
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
                                {/* recusar nao salva direto, primeiro abre a caixinha pra digitar o motivo */}
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
                            {/* recusada ou cancelada nao tem mais o que fazer */}
                            {(reserva.status === 'REJECTED' || reserva.status === 'CANCELLED') && (
                              <span className="suave">—</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* linha extra que aparece embaixo da reserva quando clica em recusar */}
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
                              {/* voltar so fecha a caixinha, nao muda nada */}
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
