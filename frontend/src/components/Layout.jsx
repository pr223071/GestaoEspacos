import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Building2,
  CalendarDays,
  Bell,
  User,
  LogOut,
  Plus,
  ClipboardCheck,
  DoorOpen,
  Wrench,
  QrCode,
  Users,
  CalendarX,
  ChartColumn,
  CalendarRange,
} from "lucide-react";
import Logo from "./Logo";
import PerfilCard from "./PerfilCard";
import "../css/Layout.css";

// itens do menu: "para" é a URL de cada página.
// "roles" (opcional) limita quem VÊ o item; sem "roles", todos veem.
const MENU = [
  { texto: "Início", icone: Home, para: "/dashboard" },
  { texto: "Espaços", icone: Building2, para: "/espacos" },
  { texto: "Minhas Reservas", icone: CalendarDays, para: "/reservas", roles: ["CLIENT", "ADMIN"] },
  // paulo: calendario com os horarios livres e ocupados de cada sala (todo mundo ve)
  { texto: "Calendário", icone: CalendarRange, para: "/calendario" },
  // ----- telas do funcionario (o roles faz so funcionario e adm verem esses itens no menu) -----
  {
    texto: "Gestão de reservas",
    icone: ClipboardCheck,
    para: "/gestao/reservas",
    roles: ["RECEPTION", "ADMIN"],
  },
  {
    texto: "Check-in",
    icone: QrCode,
    para: "/gestao/checkin",
    roles: ["RECEPTION", "ADMIN"],
  },
  {
    texto: "Salas",
    icone: DoorOpen,
    para: "/gestao/salas",
    roles: ["RECEPTION", "ADMIN"],
  },
  {
    texto: "Equipamentos",
    icone: Wrench,
    para: "/gestao/equipamentos",
    roles: ["RECEPTION", "ADMIN"],
  },
  {
    texto: "Bloqueios",
    icone: CalendarX,
    para: "/admin/bloqueios",
    roles: ["RECEPTION", "ADMIN"],
  },
  {
    texto: "Usuários",
    icone: Users,
    para: "/admin/usuarios",
    roles: ["RECEPTION", "ADMIN"],
  },
  {
    texto: "Relatórios",
    icone: ChartColumn,
    para: "/admin/relatorios",
    roles: ["RECEPTION", "ADMIN"],
  },
  { texto: "Notificações", icone: Bell, para: "/notificacoes" },
  { texto: "Perfil", icone: User, para: "/perfil", abreCard: true }, // abre o card em vez de trocar de página
  // exemplo: { texto: 'Aprovações', icone: Home, para: '/admin/aprovacoes', roles: ['ADMIN'] },
];

// altura de cada item do menu + o espaço entre eles (tem que bater com o Layout.css)
// é usado para posicionar a "pílula" preta que desliza até o item ativo
const ALTURA_ITEM = 42;
const ESPACO_ITEM = 4;

// nome bonito de cada perfil para mostrar no topo
const NOME_ROLE = {
  ADMIN: "Administrador",
  CLIENT: "Cliente",
  RECEPTION: "Recepção",
};

// iniciais para o "avatar" redondo (ex.: "Maria Silva" -> "MS")
function iniciais(nome) {
  return (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}

// Moldura das páginas logadas: sidebar + topo.
// O conteúdo de cada página aparece no lugar do <Outlet />.
function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [usuario, setUsuario] = useState(() =>
    JSON.parse(localStorage.getItem("usuario") || "{}"),
  );
  const [perfilAberto, setPerfilAberto] = useState(false);
  const role = String(usuario.role || "").toUpperCase(); // ADMIN, CLIENT ou RECEPTION

  const menuVisivel = MENU.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
  // qual item está ativo (também vale para subpáginas, ex.: /reservas/nova/3)
  const indiceAtivo = menuVisivel.findIndex(
    (item) => pathname === item.para || pathname.startsWith(item.para + "/"),
  );
  const paginaAtual = menuVisivel[indiceAtivo];

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  }

  return (
    <div className="layout">
      <aside className="layout-sidebar">
        <div className="layout-logo">
          <Logo size={30} />
          <span>SGEC</span>
        </div>

        <nav className="layout-menu">
          {/* pílula que desliza para trás do item ativo */}
          {indiceAtivo >= 0 && (
            <span
              className="layout-indicador"
              aria-hidden="true"
              style={{
                transform: `translateY(${indiceAtivo * (ALTURA_ITEM + ESPACO_ITEM)}px)`,
              }}
            />
          )}

          {menuVisivel.map((item) => {
            const Icone = item.icone;
            if (item.abreCard) {
              return (
                <button
                  key={item.para}
                  type="button"
                  className={
                    perfilAberto ? "layout-item aberto" : "layout-item"
                  }
                  onClick={() => setPerfilAberto(true)}
                >
                  <Icone size={18} strokeWidth={1.8} />
                  {item.texto}
                </button>
              );
            }
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
                <Icone size={18} strokeWidth={1.8} />
                {item.texto}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="layout-conteudo">
        <header className="layout-topo">
          <div className="layout-topo-titulo">
            <strong>{paginaAtual ? paginaAtual.texto : "SGEC"}</strong>
            <span>{hoje}</span>
          </div>

          <div className="layout-topo-direita">
            <button
              type="button"
              className="layout-nova"
              onClick={() => navigate("/espacos")}
            >
              <Plus size={16} /> Nova reserva
            </button>

            <button
              type="button"
              className="layout-usuario"
              onClick={() => setPerfilAberto(true)}
              title="Meu perfil"
            >
              <span className="layout-avatar">{iniciais(usuario.name)}</span>
              <div>
                <strong>{usuario.name}</strong>
                <span>{NOME_ROLE[role] || role}</span>
              </div>
            </button>

            <button
              type="button"
              className="layout-sair"
              onClick={sair}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* aqui entra a página da rota atual (Dashboard, Espaços...).
            a key faz a página "entrar" com animação toda vez que a rota muda */}
        <div className="layout-pagina" key={pathname}>
          <Outlet />
        </div>
      </div>

      {perfilAberto && (
        <PerfilCard
          onFechar={() => setPerfilAberto(false)}
          onAtualizado={setUsuario}
        />
      )}
    </div>
  );
}

export default Layout;
