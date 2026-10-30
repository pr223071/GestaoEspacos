import { User } from 'lucide-react';
import '../css/home.css';

// DADOS DE EXEMPLO: por enquanto fixos aqui.
// Depois do middleware, eles vão vir do backend com fetch (rota de reservas).
const RESUMO = { ativas: 2, pendentes: 1, notificacoes: 0 };
const PROXIMAS_RESERVAS = [
  { id: 1, espaco: 'Sala de Reunião 1', data: '24/10/2026', inicio: '14:00', fim: '16:00', status: 'Aprovada' },
];

// a sidebar e o topo agora ficam no Layout; aqui é só o conteúdo
function Home() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const primeiroNome = (usuario.name || '').split(' ')[0];

  return (
    <main className="home-principal">
      <h1>Olá, {primeiroNome}!</h1>
      <p className="home-sub">Aqui está um resumo das suas atividades.</p>

      <section className="home-cards">
        <div className="home-card azul">
          <strong>{RESUMO.ativas}</strong>
          <span>Reservas ativas</span>
        </div>
        <div className="home-card laranja">
          <strong>{RESUMO.pendentes}</strong>
          <span>Reservas pendentes</span>
        </div>
        <div className="home-card azul">
          <strong>{RESUMO.notificacoes}</strong>
          <span>Notificações</span>
        </div>
      </section>

      <section className="home-reservas">
        <h2>Próximas reservas</h2>

        {PROXIMAS_RESERVAS.length === 0 && (
          <p className="home-vazio">Você não tem reservas futuras.</p>
        )}

        {PROXIMAS_RESERVAS.map((reserva) => (
          <article key={reserva.id} className="home-reserva">
            <div className="home-reserva-info">
              <User size={20} />
              <div>
                <strong>{reserva.espaco}</strong>
                <span>
                  {reserva.data} • {reserva.inicio} - {reserva.fim}
                </span>
                <em className="home-status">{reserva.status}</em>
              </div>
            </div>
            <div className="home-reserva-foto" />
          </article>
        ))}

        <button className="home-ver-todas">Ver todas</button>
      </section>
    </main>
  );
}

export default Home;