import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Box,
  Home,
  Building2,
  CalendarDays,
  Bell,
  User,
  LogOut,
  UserCircle,
  Plus,
  ClipboardCheck,
  DoorOpen,
  Wrench,
  QrCode,
} from "lucide-react";
import "../css/Layout.css";

// itens do menu: "para" é a URL de cada página.
// "roles" (opcional) limita quem VÊ o item; sem "roles", todos veem.
const MENU = [
  { texto: "Início", icone: Home, para: "/dashboard" },
  { texto: "Espaços", icone: Building2, para: "/espacos" },
  { texto: "Minhas Reservas", icone: CalendarDays, para: "/reservas" },
  { texto: "Gestão de reservas", icone: ClipboardCheck, para: "/gestao/reservas", roles: ["RECEPTION", "ADMIN"] },
  { texto: "Check-in", icone: QrCode, para: "/gestao/checkin", roles: ["RECEPTION", "ADMIN"] },
  { texto: "Salas", icone: DoorOpen, para: "/gestao/salas", roles: ["RECEPTION", "ADMIN"] },
  { texto: "Equipamentos", icone: Wrench, para: "/gestao/equipamentos", roles: ["RECEPTION", "ADMIN"] },
  { texto: "Notificações", icone: Bell, para: "/notificacoes" },
  { texto: "Perfil", icone: User, para: "/perfil" },
  // exemplo: { texto: 'Aprovações', icone: Home, para: '/admin/aprovacoes', roles: ['ADMIN'] },
];

// nome bonito de cada perfil para mostrar no topo
const NOME_ROLE = {
  ADMIN: "Administrador",
  CLIENT: "Cliente",
  RECEPTION: "Recepção",
};

// Moldura das páginas logadas: sidebar + topo.
// O conteúdo de cada página aparece no lugar do <Outlet />.
function Layout() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const role = String(usuario.role || "").toUpperCase(); // ADMIN, CLIENT ou RECEPTION

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  }

  return (
    <div className="layout">
      <aside className="layout-sidebar">
        <div className="layout-logo">
          <Box size={26} strokeWidth={1.8} />
          <span>SGEC</span>
        </div>

        <nav>
          {MENU.filter((item) => !item.roles || item.roles.includes(role)).map(
            (item) => {
              const Icone = item.icone;
              return (
                // NavLink é um link do React Router que sabe se é a página atual.
                // Ele chama a função do className passando  isActive .
                <NavLink
                  key={item.para}
                  to={item.para}
                  className={({ isActive }) =>
                    isActive ? "layout-item ativo" : "layout-item"
                  }
                >
                  <Icone size={18} />
                  {item.texto}
                </NavLink>
              );
            },
          )}
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
              <span>{NOME_ROLE[role] || role}</span>
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
