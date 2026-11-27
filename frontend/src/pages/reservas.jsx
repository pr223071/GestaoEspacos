import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QrCode, XCircle } from "lucide-react";
import QrCodeReserva from "../components/QrCodeReserva";
import "../css/reservas.css";

// Funcoes auxiliares: autenticacao, datas e textos exibidos na tela.
const API_URL = "http://localhost:3080";
const lerToken = () => localStorage.getItem("token");
const criarCabecalhos = (json = true) => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${lerToken()}`,
});
const dataDeHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatarDataHora = (value) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const formatarHora = (valor) => String(valor || "").slice(0, 5);
const status = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  CANCELLED: "Cancelada",
};

// Esta tela tem dois modos: solicitar reserva (com spaceId) ou ver minhas reservas.
function Reservas() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  // Dados carregados da API e valores preenchidos pelo usuario.
  const [espaco, setEspaco] = useState(null);
  const [disponibilidade, setDisponibilidade] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [data, setData] = useState(dataDeHoje());
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("10:00");
  const [pessoas, setPessoas] = useState("1");
  const [observacoes, setObservacoes] = useState("");
  const [carregando, setCarregando] = useState(Boolean(spaceId));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  // id da reserva que ta com o qr code aberto (null = fechado)
  const [qrAberto, setQrAberto] = useState(null);
  const fecharQr = useCallback(() => setQrAberto(null), []);
  // id da reserva que está pedindo confirmação de cancelamento
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);

  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}");
    } catch {
      return {};
    }
  })();

  // Busca as reservas do usuario que esta conectado.
  const carregarMinhasReservas = useCallback(async () => {
    if (!usuario.id) return;
    try {
      const response = await fetch(
        `${API_URL}/reservas/usuario/${usuario.id}`,
        { headers: criarCabecalhos(false) },
      );
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        navigate("/login");
        return;
      }
      const dados = await response.json().catch(() => []);
      if (!response.ok)
        throw new Error(
          dados.erro || "Não foi possível carregar suas reservas.",
        );
      setReservas(dados);
    } catch (e) {
      setErro(e.message);
    }
  }, [navigate, usuario.id]);

  // o dono cancela a própria reserva
  async function cancelarReserva(id) {
    setErro("");
    setSucesso("");
    setCancelandoId(id);
    try {
      const response = await fetch(`${API_URL}/reservas/${id}/cancelar`, {
        method: "PUT",
        headers: criarCabecalhos(false),
      });
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        navigate("/login");
        return;
      }
      const dados = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(dados.erro || "Não foi possível cancelar a reserva.");
      setSucesso("Reserva cancelada.");
      await carregarMinhasReservas();
    } catch (e) {
      setErro(e.message);
    } finally {
      setCancelandoId(null);
      setConfirmandoId(null);
    }
  }

  // pode cancelar se estiver pendente ou aprovada e ainda não começou
  const podeCancelar = (r) =>
    (r.status === "PENDING" || r.status === "APPROVED") && new Date(r.start_datetime) > new Date();

  useEffect(() => {
    if (!spaceId) {
      carregarMinhasReservas();
      return;
    }
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro("");
      try {
        const response = await fetch(`${API_URL}/spaces/id/${spaceId}`, {
          headers: criarCabecalhos(false),
        });
        const dados = await response.json().catch(() => []);
        if (!response.ok)
          throw new Error(
            dados.erro || dados.error || "Não foi possível carregar o espaço.",
          );
        if (ativo) setEspaco(Array.isArray(dados) ? dados[0] : dados);
        const disponibilidadeResponse = await fetch(
          `${API_URL}/spaces/${spaceId}/availability`,
          { headers: criarCabecalhos(false) },
        );
        if (disponibilidadeResponse.ok && ativo)
          setDisponibilidade(await disponibilidadeResponse.json());
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [spaceId, carregarMinhasReservas]);

  // Envia o formulario para criar uma nova reserva.
  async function reservar(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    if (!data || !inicio || !fim || inicio >= fim)
      return setErro("A hora inicial deve ser anterior à hora final.");
    if (Number(pessoas) < 1 || !Number.isInteger(Number(pessoas)))
      return setErro("Informe uma quantidade válida de pessoas.");
    const start_datetime = `${data}T${inicio}:00-03:00`;
    const end_datetime = `${data}T${fim}:00-03:00`;
    setSalvando(true);
    try {
      const response = await fetch(`${API_URL}/reservas`, {
        method: "POST",
        headers: criarCabecalhos(),
        body: JSON.stringify({
          space_id: Number(spaceId),
          user_id: Number(usuario.id),
          start_datetime,
          end_datetime,
          attendees: Number(pessoas),
          notes: observacoes.trim() || null,
        }),
      });
      const dados = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        navigate("/login");
        return;
      }
      if (!response.ok)
        throw new Error(dados.erro || "Não foi possível criar a reserva.");
      setSucesso(
        `Solicitação de reserva #${dados.id} enviada! Status: ${status[dados.status] || dados.status || "Pendente"}.`,
      );
      setObservacoes("");
      await carregarMinhasReservas();
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setSalvando(false);
    }
  }

  if (spaceId)
    return (
      <main className="reservas-pagina">
        <Link className="reservas-voltar" to="/espacos">
          ← Voltar aos espaços
        </Link>
        <header className="reservas-titulo">
          <h1>Reservar espaço</h1>
          <p>
            Escolha a data e o período desejado. Sua solicitação ficará pendente
            até ser aprovada.
          </p>
        </header>
        {carregando && <p>Carregando espaço…</p>}
        {erro && (
          <p className="reservas-alerta erro" role="alert">
            {erro}
          </p>
        )}
        {espaco && (
          <section className="reserva-form-card">
            <h2>{espaco.name}</h2>
            <p>Capacidade: {espaco.capacity} pessoas</p>
            <div className="reservas-disponibilidade">
              <strong>Horários disponíveis na semana</strong>
              {disponibilidade.length ? (
                <ul>
                  {disponibilidade.map((h, i) => (
                    <li key={`${h.day_of_week}-${h.start_time}-${i}`}>
                      {DIAS[Number(h.day_of_week)]}: {formatarHora(h.start_time)}–
                      {formatarHora(h.end_time)}
                      {h.is_external_allowed === false ? " (uso interno)" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Não há horários cadastrados para este espaço.</p>
              )}
            </div>
            {espaco.terms_of_use && (
              <p className="reservas-regras">
                Regras de uso: {espaco.terms_of_use}
              </p>
            )}
            <form onSubmit={reservar} className="reserva-form">
              <label>
                Data
                <input
                  type="date"
                  min={dataDeHoje()}
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </label>
              <label>
                Horário de início
                <input
                  type="time"
                  required
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </label>
              <label>
                Horário de término
                <input
                  type="time"
                  required
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                />
              </label>
              <label>
                Quantidade de pessoas
                <input
                  type="number"
                  min="1"
                  max={espaco.capacity}
                  required
                  value={pessoas}
                  onChange={(e) => setPessoas(e.target.value)}
                />
              </label>
              <label className="reserva-largo">
                Observações (opcional)
                <textarea
                  rows="3"
                  maxLength="1000"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informe o motivo ou algum detalhe da reserva"
                />
              </label>
              {sucesso && (
                <p className="reservas-alerta sucesso" role="status">
                  {sucesso}
                </p>
              )}
              <button
                className="reserva-submit"
                type="submit"
                disabled={salvando || carregando}
              >
                {salvando ? "Enviando…" : "Solicitar reserva"}
              </button>
            </form>
          </section>
        )}
      </main>
    );

  return (
    <main className="reservas-pagina">
      <header className="reservas-titulo">
        <h1>Minhas reservas</h1>
        <p>Acompanhe as solicitações e o status das suas reservas.</p>
        <Link className="reserva-submit link-botao" to="/espacos">
          Encontrar um espaço
        </Link>
      </header>
      {erro && (
        <p className="reservas-alerta erro" role="alert">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="reservas-alerta sucesso" role="status">
          {sucesso}
        </p>
      )}
      {reservas.length === 0 ? (
        <p className="reservas-vazio">Você ainda não tem reservas.</p>
      ) : (
        <div className="reservas-lista">
          {reservas.map((r) => (
            <article className="reserva-item" key={r.id}>
              <div>
                <h2>{r.space_name || `Espaço #${r.space_id}`}</h2>
                <p>
                  {formatarDataHora(r.start_datetime)} –{" "}
                  {new Date(r.end_datetime).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {r.notes && <p>{r.notes}</p>}
              </div>
              <div className="reserva-lado">
                {/* so reserva aprovada tem qr code (o banco cria ele na aprovacao) */}
                {r.status === "APPROVED" && (
                  <button
                    type="button"
                    className="reserva-qr-botao"
                    onClick={() => setQrAberto(r.id)}
                  >
                    <QrCode size={14} /> Ver QR Code
                  </button>
                )}
                {podeCancelar(r) && confirmandoId !== r.id && (
                  <button
                    type="button"
                    className="reserva-cancelar-botao"
                    onClick={() => setConfirmandoId(r.id)}
                  >
                    <XCircle size={14} /> Cancelar
                  </button>
                )}
                {confirmandoId === r.id && (
                  <span className="reserva-confirmar">
                    Cancelar esta reserva?
                    <button
                      type="button"
                      className="reserva-cancelar-botao sim"
                      onClick={() => cancelarReserva(r.id)}
                      disabled={cancelandoId === r.id}
                    >
                      {cancelandoId === r.id ? "Cancelando…" : "Sim"}
                    </button>
                    <button
                      type="button"
                      className="reserva-cancelar-botao nao"
                      onClick={() => setConfirmandoId(null)}
                      disabled={cancelandoId === r.id}
                    >
                      Não
                    </button>
                  </span>
                )}
                <span
                  className={`reserva-status status-${String(r.status).toLowerCase()}`}
                >
                  {status[r.status] || r.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
      {qrAberto && <QrCodeReserva reservaId={qrAberto} onFechar={fecharQr} />}
    </main>
  );
}
export default Reservas;
