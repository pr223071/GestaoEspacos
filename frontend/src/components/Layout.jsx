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
  ArrowRight,
} from "lucide-react";
import Logo from "./Logo";
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
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const role = String(usuario.role || "").toUpperCase(); // ADMIN, CLIENT ou RECEPTION
  const equipe = role === "ADMIN" || role === "RECEPTION";

  // telas de gestão (as do adm/recepção) usam as cores invertidas
  const invertido = pathname.startsWith("/gestao");

  const menuVisivel = MENU.filter((item) => !item.roles || item.roles.includes(role));
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
    <div className={invertido ? "layout tema-invertido" : "layout"}>
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
              style={{ transform: `translateY(${indiceAtivo * (ALTURA_ITEM + ESPACO_ITEM)}px)` }}
            />
          )}

          {menuVisivel.map((item) => {
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
                <Icone size={18} strokeWidth={1.8} />
                {item.texto}
              </NavLink>
            );
          })}
        </nav>

        {/* cartão de atalho no fim da sidebar */}
        <div className="layout-atalho">
          <span className="layout-atalho-icone">
            <Logo size={18} />
          </span>
          {equipe ? (
            <>
              <strong>Check-in rápido</strong>
              <p>Valide o QR code de quem chegou e registre a entrada.</p>
              <button type="button" onClick={() => navigate("/gestao/checkin")}>
                Abrir check-in <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <strong>Reserve um espaço</strong>
              <p>Salas de reunião, laboratórios e áreas de coworking.</p>
              <button type="button" onClick={() => navigate("/espacos")}>
                Ver espaços <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="layout-conteudo">
        <header className="layout-topo">
          <div className="layout-topo-titulo">
            <strong>{paginaAtual ? paginaAtual.texto : "SGEC"}</strong>
            <span>{hoje}</span>
          </div>

          <div className="layout-topo-direita">
            {invertido && <span className="layout-modo">Modo gestão</span>}

            <button type="button" className="layout-nova" onClick={() => navigate("/espacos")}>
              <Plus size={16} /> Nova reserva
            </button>

            <div className="layout-usuario">
              <span className="layout-avatar">{iniciais(usuario.name)}</span>
              <div>
                <strong>{usuario.name}</strong>
                <span>{NOME_ROLE[role] || role}</span>
              </div>
            </div>

            <button type="button" className="layout-sair" onClick={sair} aria-label="Sair" title="Sair">
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
    </div>
  );
}

export default Layout;
