import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Box, Home, Building2, CalendarDays, Bell, User, LogOut, UserCircle, Plus,
} from 'lucide-react';
import '../css/Layout.css';

// itens do menu: "para" é a URL de cada página
const MENU = [
  { texto: 'Início', icone: Home, para: '/dashboard' },
  { texto: 'Espaços', icone: Building2, para: '/espacos' },
  { texto: 'Minhas Reservas', icone: CalendarDays, para: '/reservas' },
  { texto: 'Notificações', icone: Bell, para: '/notificacoes' },
  { texto: 'Perfil', icone: User, para: '/perfil' },
];

// Moldura das páginas logadas: sidebar + topo.
// O conteúdo de cada página aparece no lugar do <Outlet />.
function Layout() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  function sair() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="layout-sidebar">
        <div className="layout-logo">
          <Box size={26} strokeWidth={1.8} />
          <span>SGEC</span>
        </div>

        <nav>
          {MENU.map((item) => {
            const Icone = item.icone;
            return (
              // NavLink é um link do React Router que sabe se é a página atual.
              // Ele chama a função do className passando { isActive }.
              <NavLink
                key={item.para}
                to={item.para}
                className={({ isActive }) => (isActive ? 'layout-item ativo' : 'layout-item')}
              >
                <Icone size={18} />
                {item.texto}
              </NavLink>
            );
          })}
        </nav>

        <button className="layout-item layout-sair" onClick={sair}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <div className="layout-conteudo">
        <header className="layout-topo">
          <div className="layout-usuario">
            <UserCircle size={34} strokeWidth={1.5} />
            <div>
              <strong>{usuario.name}</strong>
              <span>{usuario.role === 'client' ? 'Cliente' : usuario.role}</span>
            </div>
          </div>
          <button className="layout-mais" aria-label="Nova reserva">
            <Plus size={20} />
          </button>
        </header>

        {/* aqui entra a página da rota atual (Dashboard, Espaços...) */}
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;