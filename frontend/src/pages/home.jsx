import { useNavigate } from 'react-router-dom';
import {
  Box, Home as IconeInicio, Building2, CalendarDays, Bell, User, LogOut, UserCircle, Plus,
} from 'lucide-react';
import './home.css';

// itens do menu lateral. Fica numa lista para gerar os botões com .map()
// em vez de repetir o mesmo JSX cinco vezes
const MENU = [
  { texto: 'Início', icone: IconeInicio },
  { texto: 'Espaços', icone: Building2 },
  { texto: 'Minhas Reservas', icone: CalendarDays },
  { texto: 'Notificações', icone: Bell },
  { texto: 'Perfil', icone: User },
];

// DADOS DE EXEMPLO: por enquanto fixos aqui.
// Depois do middleware, eles vão vir do backend com fetch (rota de reservas).
const RESUMO = { ativas: 2, pendentes: 1, notificacoes: 0 };
const PROXIMAS_RESERVAS = [
  { id: 1, espaco: 'Sala de Reunião 1', data: '24/10/2026', inicio: '14:00', fim: '16:00', status: 'Aprovada' },
];

function Home() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  // pega só o primeiro nome: "Enzo Hingst" -> "Enzo"
  const primeiroNome = (usuario.name || '').split(' ')[0];

  function sair() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  }

  return (
    <div className="home">
      {/* ===== MENU LATERAL ===== */}
      <aside className="home-sidebar">
        <div className="home-logo">
          <Box size={26} strokeWidth={1.8} />
          <span>SGEC</span>
        </div>

        <nav>
          {/* .map percorre a lista e cria um botão para cada item.
              "key" é obrigatório em listas: o React usa para identificar cada item */}
          {MENU.map((item, posicao) => {
            const Icone = item.icone; // componente precisa de nome com maiúscula
            return (
              <button
                key={item.texto}
                // o primeiro item (Início) fica destacado
                className={posicao === 0 ? 'home-menu-item ativo' : 'home-menu-item'}
              >
                <Icone size={18} />
                {item.texto}
              </button>
            );
          })}
        </nav>

        {/* margin-top: auto no CSS empurra o Sair para o fim da barra */}
        <button className="home-menu-item home-sair" onClick={sair}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      {/* ===== CONTEÚDO ===== */}
      <div className="home-conteudo">
        <header className="home-topo">
          <div className="home-usuario">
            <UserCircle size={34} strokeWidth={1.5} />
            <div>
              <strong>{usuario.name}</strong>
              <span>{usuario.role === 'client' ? 'Cliente' : usuario.role}</span>
            </div>
          </div>
          <button className="home-mais" aria-label="Nova reserva">
            <Plus size={20} />
          </button>
        </header>

        <main className="home-principal">
          <h1>Olá, {primeiroNome}!</h1>
          <p className="home-sub">Aqui está um resumo das suas atividades.</p>

          {/* cards do resumo */}
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

          {/* lista de reservas */}
          <section className="home-reservas">
            <h2>Próximas reservas</h2>

            {/* se a lista estiver vazia, mostra um aviso no lugar */}
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
      </div>
    </div>
  );
}

export default Home;