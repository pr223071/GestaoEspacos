import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Search, LogIn, LogOut } from 'lucide-react';
import '../css/gestao.css';

const API_URL = 'http://localhost:3080';

// a rota de check-in ja manda a "situation" de cada reserva
// aqui so traduzo e coloco a cor (as mesmas da gestao de reservas)
const SITUACAO = {
  AGUARDANDO: { texto: 'Aguardando', classe: 'pendente' },
  EM_USO: { texto: 'Em uso', classe: 'aprovada' },
  CONCLUIDO: { texto: 'Concluído', classe: 'concluido' },
  NAO_COMPARECEU: { texto: 'Não compareceu', classe: 'recusada' },
  CANCELADO: { texto: 'Cancelado', classe: 'cancelada' },
};

// o back ja manda a data em horario de brasilia, tipo "2026-11-26T14:30"
// entao so separo as partes, nao usei new Date pq senao ele mexe no fuso de novo
function formatarData(texto) {
  if (!texto) return '—';
  const [data] = texto.split('T');
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(texto) {
  return texto ? texto.split('T')[1] : '—';
}

// as mensagens de erro do back vem com a data feia ("2026-11-26T12:30")
// aqui eu troco pra "26/11/2026 às 12:30"
function deixarLegivel(texto) {
  return texto.replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/g, '$3/$2/$1 às $4');
}

// data de hoje no formato que o input date usa (AAAA-MM-DD), em horario de brasilia
function hoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// tela da recepçao, valida o qr code do cliente e marca a entrada e a saida
function Checkin() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  // codigo que digitou (o leitor de qr code usb tambem "digita" e da enter sozinho)
  const [codigo, setCodigo] = useState('');
  const [encontrado, setEncontrado] = useState(null); // o check-in que achou pelo codigo
  const [buscando, setBuscando] = useState(false);

  // lista do dia
  const [data, setData] = useState(hoje());
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [processando, setProcessando] = useState(null); // qual ta salvando agora
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const sair = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  }, [navigate]);

  // busca as reservas do dia, roda de novo toda vez que troca o dia
  useEffect(() => {
    async function buscarLista() {
      try {
        const response = await fetch(`${API_URL}/checkins/data/${data}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (response.status === 401) {
          sair();
          return;
        }

        // se nao tiver nada no dia o back manda 404, ai so deixo vazio
        if (response.status === 404) {
          setLista([]);
          return;
        }

        if (!response.ok) {
          setErro('Não foi possível carregar os check-ins do dia');
          return;
        }

        setLista(await response.json());
      } catch {
        setErro('Não foi possível conectar ao servidor');
      } finally {
        setCarregando(false);
      }
    }

    buscarLista();
  }, [data, sair]);

  // troca o dia (o useEffect de cima busca de novo sozinho)
  function mudarData(e) {
    setCarregando(true);
    setData(e.target.value);
  }

  // procura a reserva pelo codigo do qr code
  async function buscarCodigo(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setEncontrado(null);

    const texto = codigo.trim();
    if (!texto) {
      setErro('Digite ou leia o código do QR Code.');
      return;
    }

    setBuscando(true);
    try {
      const response = await fetch(`${API_URL}/checkins/token/${encodeURIComponent(texto)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.status === 401) {
        sair();
        return;
      }

      const dados = await response.json();

      if (!response.ok) {
        setErro(dados.erro ? deixarLegivel(dados.erro) : 'Código não encontrado');
        return;
      }

      setEncontrado(dados);
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setBuscando(false);
    }
  }

  // marca a entrada ou a saida, o "tipo" é 'entrada' ou 'saida' igual o nome da rota
  async function registrar(checkin, tipo) {
    setErro('');
    setMensagem('');
    setProcessando(checkin.qr_token);

    try {
      const response = await fetch(`${API_URL}/checkins/token/${checkin.qr_token}/${tipo}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        // salva quem validou
        body: JSON.stringify({ validated_by: usuario.id }),
      });

      if (response.status === 401) {
        sair();
        return;
      }

      const dados = await response.json();

      // quando nao pode o back fala o motivo (tipo "Ainda é cedo" ou "já foi registrada")
      if (!response.ok) {
        setErro(dados.erro ? deixarLegivel(dados.erro) : 'Não foi possível registrar');
        return;
      }

      const acao = tipo === 'entrada' ? 'Entrada' : 'Saída';
      setMensagem(`${acao} de ${dados.user_name} em "${dados.space_name}" registrada às ${formatarHora(tipo === 'entrada' ? dados.checkin_at : dados.checkout_at)}.`);

      // atualiza o cartao da busca e a linha da tabela com o que voltou
      if (encontrado && encontrado.qr_token === dados.qr_token) setEncontrado(dados);
      setLista((atual) => atual.map((c) => (c.qr_token === dados.qr_token ? dados : c)));

      // limpa o campo pro proximo cliente
      setCodigo('');
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setProcessando(null);
    }
  }

  // botao certo pra cada situaçao: aguardando mostra entrada, em uso mostra saida
  function botoes(checkin) {
    const ocupado = processando === checkin.qr_token;

    if (checkin.situation === 'AGUARDANDO') {
      return (
        <button type="button" className="gestao-acao aprovar" disabled={ocupado} onClick={() => registrar(checkin, 'entrada')}>
          <LogIn size={14} /> Registrar entrada
        </button>
      );
    }

    if (checkin.situation === 'EM_USO') {
      return (
        <button type="button" className="gestao-acao cancelar" disabled={ocupado} onClick={() => registrar(checkin, 'saida')}>
          <LogOut size={14} /> Registrar saída
        </button>
      );
    }

    return <span className="suave">—</span>;
  }

  const contagem = {
    aguardando: lista.filter((c) => c.situation === 'AGUARDANDO').length,
    emUso: lista.filter((c) => c.situation === 'EM_USO').length,
  };

  return (
    <main className="gestao">
      <h1>Check-in</h1>
      <p className="gestao-sub">Valide o QR Code do cliente e registre a entrada e a saída do espaço.</p>

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}
      {mensagem && <p className="gestao-mensagem sucesso" role="status">{mensagem}</p>}

      <section className="gestao-cartao">
        <h2>Validar QR Code</h2>

        <form className="checkin-busca" onSubmit={buscarCodigo}>
          <div className="gestao-busca">
            <QrCode size={16} />
            <input
              type="text"
              placeholder="Leia o QR Code ou digite o código"
              aria-label="Código do QR Code"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="gestao-botao" disabled={buscando}>
            <Search size={16} />
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
        <small className="gestao-aviso">Com leitor de QR Code (USB), basta clicar no campo e ler: o código entra sozinho.</small>

        {encontrado && (
          <div className="checkin-resultado">
            <div>
              <strong>{encontrado.user_name}</strong>
              <span>{encontrado.space_name}</span>
              <span className="suave">
                {formatarData(encontrado.start_datetime)} · {formatarHora(encontrado.start_datetime)} - {formatarHora(encontrado.end_datetime)}
              </span>
              {encontrado.checkin_at && (
                <span className="suave">
                  Entrada: {formatarHora(encontrado.checkin_at)}
                  {encontrado.checkout_at && ` · Saída: ${formatarHora(encontrado.checkout_at)}`}
                  {encontrado.validated_by_name && ` · validado por ${encontrado.validated_by_name}`}
                </span>
              )}
            </div>
            <div className="checkin-resultado-acoes">
              <span className={`gestao-status ${SITUACAO[encontrado.situation].classe}`}>
                {SITUACAO[encontrado.situation].texto}
              </span>
              {botoes(encontrado)}
            </div>
          </div>
        )}
      </section>

      <section className="gestao-cartao">
        <div className="checkin-topo-lista">
          <h2>
            Reservas do dia
            {!carregando && lista.length > 0 && (
              <span className="checkin-resumo">
                {contagem.aguardando} aguardando · {contagem.emUso} em uso
              </span>
            )}
          </h2>
          <input type="date" aria-label="Dia" value={data} onChange={mudarData} />
        </div>

        {carregando && <p className="gestao-aviso">Carregando...</p>}
        {!carregando && lista.length === 0 && (
          <p className="gestao-aviso">Nenhuma reserva aprovada nesse dia.</p>
        )}

        {!carregando && lista.length > 0 && (
          <div className="gestao-tabela-caixa">
            <table className="gestao-tabela">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Espaço</th>
                  <th>Cliente</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="suave">{formatarHora(c.start_datetime)} - {formatarHora(c.end_datetime)}</td>
                    <td><strong>{c.space_name}</strong></td>
                    <td>{c.user_name}</td>
                    <td>{c.checkin_at ? formatarHora(c.checkin_at) : '—'}</td>
                    <td>{c.checkout_at ? formatarHora(c.checkout_at) : '—'}</td>
                    <td>
                      <span className={`gestao-status ${SITUACAO[c.situation].classe}`}>{SITUACAO[c.situation].texto}</span>
                    </td>
                    {/* os botoes na lista sao pra quando o cliente esquece o qr code
                        (ai a recepçao confere o documento e marca direto aqui) */}
                    <td><div className="gestao-acoes">{botoes(c)}</div></td>
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

export default Checkin;
