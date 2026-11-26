import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock, Bell, ArrowUpRight } from 'lucide-react';
import '../css/home.css';
import { fotoDoEspaco } from '../utils/fotosEspacos';

// DADOS DE EXEMPLO: por enquanto fixos aqui.
// Depois do middleware, eles vão vir do backend com fetch (rota de reservas).
const RESUMO = { ativas: 2, pendentes: 1, notificacoes: 0 };
const PROXIMAS_RESERVAS = [
  { id: 1, espaco: 'Sala de Reunião 1', data: '24/10/2026', inicio: '14:00', fim: '16:00', status: 'Aprovada' },
];

// os 3 cartões do resumo; o primeiro fica em destaque (preto)
const CARTOES = [
  { titulo: 'Reservas ativas', valor: RESUMO.ativas, icone: CalendarCheck, detalhe: 'confirmadas para os próximos dias' },
  { titulo: 'Reservas pendentes', valor: RESUMO.pendentes, icone: Clock, detalhe: 'aguardando aprovação' },
  { titulo: 'Notificações', valor: RESUMO.notificacoes, icone: Bell, detalhe: 'não lidas' },
];

// a sidebar e o topo agora ficam no Layout; aqui é só o conteúdo
function Home() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const primeiroNome = (usuario.name || '').split(' ')[0];

  return (
    <main className="home-principal">
      <h1>
        Bem-vindo de volta, <strong>{primeiroNome}!</strong>
      </h1>
      <p className="home-sub">Aqui está um resumo das suas atividades.</p>

      <section className="home-cards">
        {CARTOES.map((cartao, i) => {
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

        {PROXIMAS_RESERVAS.length === 0 && (
          <p className="home-vazio">Você não tem reservas futuras.</p>
        )}

        {PROXIMAS_RESERVAS.length > 0 && (
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
              {PROXIMAS_RESERVAS.map((reserva) => (
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

export default Home;
