import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock, Bell, ArrowUpRight } from 'lucide-react';
import '../css/home.css';
import { fotoDoEspaco } from '../utils/fotosEspacos';
import PainelEquipe from '../components/PainelEquipe';

const API_URL = 'http://localhost:3080';

const STATUS = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Recusada',
  CANCELLED: 'Cancelada',
};

// transforma uma reserva do backend no formato da tabela
function paraLinha(r) {
  const inicio = new Date(r.start_datetime);
  const fim = new Date(r.end_datetime);
  const hora = { hour: '2-digit', minute: '2-digit' };
  return {
    id: r.id,
    espaco: r.space_name,
    data: inicio.toLocaleDateString('pt-BR'),
    inicio: inicio.toLocaleTimeString('pt-BR', hora),
    fim: fim.toLocaleTimeString('pt-BR', hora),
    status: STATUS[r.status] || r.status,
  };
}

// a sidebar e o topo agora ficam no Layout; aqui é só o conteúdo
function HomeCliente() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const primeiroNome = (usuario.name || '').split(' ')[0];

  // tudo começa vazio: um usuário novo não tem reserva nenhuma
  const [reservas, setReservas] = useState([]);
  const [notificacoes, setNotificacoes] = useState(0);
  const [carregando, setCarregando] = useState(Boolean(usuario.id));
  const [erro, setErro] = useState('');

  // busca as reservas e notificações SÓ do usuário logado
  useEffect(() => {
    if (!usuario.id) return;
    const cabecalhos = { Authorization: `Bearer ${localStorage.getItem('token')}` };

    async function carregar() {
      try {
        const [resReservas, resNotificacoes] = await Promise.all([
          fetch(`${API_URL}/reservas/usuario/${usuario.id}`, { headers: cabecalhos }),
          fetch(`${API_URL}/notificacoes/usuario/${usuario.id}`, { headers: cabecalhos }),
        ]);

        if (resReservas.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        const dadosReservas = await resReservas.json().catch(() => []);
        if (!resReservas.ok) throw new Error(dadosReservas.erro || 'Não foi possível carregar suas reservas');
        setReservas(Array.isArray(dadosReservas) ? dadosReservas : []);

        // notificação é um extra: se der erro (ex.: 404 sem nenhuma), fica 0
        const dadosNotificacoes = resNotificacoes.ok ? await resNotificacoes.json().catch(() => []) : [];
        setNotificacoes(Array.isArray(dadosNotificacoes) ? dadosNotificacoes.length : 0);
      } catch (e) {
        setErro(e.message || 'Não foi possível conectar ao servidor');
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [usuario.id, navigate]);

  // calcula o resumo a partir das reservas de verdade
  const agora = new Date();
  const futuras = reservas.filter((r) => new Date(r.end_datetime) >= agora);
  const ativas = futuras.filter((r) => r.status === 'APPROVED').length;
  const pendentes = futuras.filter((r) => r.status === 'PENDING').length;

  // próximas reservas (aprovadas ou pendentes), da mais perto para a mais longe
  const proximasReservas = futuras
    .filter((r) => r.status === 'APPROVED' || r.status === 'PENDING')
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
    .slice(0, 5)
    .map(paraLinha);

  // os 3 cartões do resumo; o primeiro fica em destaque (preto)
  const cartoes = [
    { titulo: 'Reservas ativas', valor: ativas, icone: CalendarCheck, detalhe: 'confirmadas para os próximos dias' },
    { titulo: 'Reservas pendentes', valor: pendentes, icone: Clock, detalhe: 'aguardando aprovação' },
    { titulo: 'Notificações', valor: notificacoes, icone: Bell, detalhe: 'recebidas' },
  ];

  return (
    <main className="home-principal">
      <h1>
        Bem-vindo de volta, <strong>{primeiroNome}!</strong>
      </h1>
      <p className="home-sub">Aqui está um resumo das suas atividades.</p>

      <section className="home-cards">
        {cartoes.map((cartao, i) => {
          const Icone = cartao.icone;
          return (
            <div
              key={cartao.titulo}
              className={i === 0 ? 'home-card destaque' : 'home-card'}
              // cada cartão entra um pouquinho depois do anterior
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="home-card-topo">
                <span>{cartao.titulo}</span>
                <span className="home-card-icone">
                  <Icone size={18} strokeWidth={1.8} />
                </span>
              </div>
              <strong>{cartao.valor}</strong>
              <small>{cartao.detalhe}</small>
            </div>
          );
        })}
      </section>

      <section className="home-reservas">
        <div className="home-reservas-topo">
          <h2>Próximas reservas</h2>
          <button className="home-ver-todas" onClick={() => navigate('/reservas')}>
            Ver todas <ArrowUpRight size={15} />
          </button>
        </div>

        {carregando && <p className="home-vazio">Carregando...</p>}
        {!carregando && erro && <p className="home-vazio">{erro}</p>}

        {!carregando && !erro && proximasReservas.length === 0 && (
          <p className="home-vazio">Você não tem reservas futuras.</p>
        )}

        {!carregando && !erro && proximasReservas.length > 0 && (
          <table className="home-tabela">
            <thead>
              <tr>
                <th>Espaço</th>
                <th>Data</th>
                <th>Horário</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {proximasReservas.map((reserva) => (
                <tr key={reserva.id}>
                  <td>
                    <div className="home-espaco">
                      <span
                        className="home-reserva-foto"
                        style={
                          fotoDoEspaco(reserva.espaco)
                            ? { backgroundImage: `url(${fotoDoEspaco(reserva.espaco)})` }
                            : undefined
                        }
                      />
                      <strong>{reserva.espaco}</strong>
                    </div>
                  </td>
                  <td>{reserva.data}</td>
                  <td>
                    {reserva.inicio} - {reserva.fim}
                  </td>
                  <td>
                    <em className="home-status">{reserva.status}</em>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

// funcionário e admin veem o painel com gráficos; cliente vê as próprias reservas
function Home() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const role = String(usuario.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'RECEPTION') {
    return <PainelEquipe primeiroNome={(usuario.name || '').split(' ')[0]} />;
  }
  return <HomeCliente />;
}

export default Home;
