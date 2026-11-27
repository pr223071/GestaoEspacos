import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './pages/auth';
import Dashboard from './pages/home';
import Espacos from './pages/espacos';
import Reservas from './pages/reservas';
import GestaoReservas from './pages/gestaoReservas';
import CadastroSala from './pages/cadastroSala';
import CadastroEquipamento from './pages/cadastroEquipamento';
import Checkin from './pages/checkin';
import Bloqueios from './pages/bloqueios';
import Usuarios from './pages/usuarios';
import Relatorios from './pages/relatorios';

// quem pode abrir as telas de gestao (funcionario e adm)
const EQUIPE = ['RECEPTION', 'ADMIN'];

// abre o token e devolve o payload id, role, exp, ou null se estiver mal formado
function lerToken(token) {
  try {
    // o token tem 3 partes separadas por ponto; a do meio é o payload em base64
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// ve se o token ainda nao venceu
// tive que tirar de dentro do componente pq o react nao deixa usar Date.now() no render
// (o lint dava erro de "impure function")
function dentroDaValidade(payload) {
  // exp vem em segundos; Date.now() vem em milissegundos, por isso o * 1000
  return payload.exp * 1000 > Date.now();
}

// "porteiro" das páginas protegidas.
// Sem "roles": qualquer usuário logado entra.
// Com "roles" (ex.: roles={['ADMIN']}): só esses perfis entram.
function RotaProtegida({ children, roles }) {
  const token = localStorage.getItem('token');
  const payload = token ? lerToken(token) : null;

  const valido = payload && dentroDaValidade(payload);

  if (!valido) {
    console.log('sem login ou token vencido -> /login');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    return <Navigate to="/login" replace />;
  }

  // a role vem de dentro do token (assinado pelo backend), não do localStorage
  const role = String(payload.role).toUpperCase();

  if (roles && !roles.includes(role)) {
    console.log(`${role} não pode ver esta página (permitido: ${roles.join(', ')}) -> /dashboard`);
    return <Navigate to="/dashboard" replace />;
  }

  if (role === 'ADMIN') console.log('É ADMIN');
  else if (role === 'RECEPTION') console.log('É RECEPTION');
  else if (role === 'CLIENT') console.log('É CLIENT');

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* a primeira tela ao abrir o site é o cadastro */}
        <Route path="/" element={<Navigate to="/signup" replace />} />
        {/* login e cadastro dividem a mesma tela (pages/auth.jsx),
            assim a troca entre eles é animada em vez de recarregar */}
        <Route element={<Auth />}>
          <Route path="/signup" />
          <Route path="/login" />
        </Route>

        {/* ROTAS ANINHADAS: todas as rotas aqui dentro passam pelo porteiro
            e aparecem dentro do Layout (sidebar + topo), no lugar do <Outlet /> */}
        <Route
          element={
            <RotaProtegida>
              <Layout />
            </RotaProtegida>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/espacos" element={<Espacos />} />
          <Route path="/reservas" element={<Reservas />} />
          <Route path="/reservas/nova/:spaceId" element={<Reservas />} />

          {/* telas do funcionario (o adm tambem pode ver) */}
          <Route path="/gestao/reservas" element={<RotaProtegida roles={EQUIPE}><GestaoReservas /></RotaProtegida>} />
          <Route path="/gestao/salas" element={<RotaProtegida roles={EQUIPE}><CadastroSala /></RotaProtegida>} />
          <Route path="/gestao/equipamentos" element={<RotaProtegida roles={EQUIPE}><CadastroEquipamento /></RotaProtegida>} />
          <Route path="/gestao/checkin" element={<RotaProtegida roles={EQUIPE}><Checkin /></RotaProtegida>} />

          {/* bloqueios, usuarios e relatorios (funcionario e adm) */}
          <Route path="/admin/bloqueios" element={<RotaProtegida roles={EQUIPE}><Bloqueios /></RotaProtegida>} />
          <Route path="/admin/usuarios" element={<RotaProtegida roles={EQUIPE}><Usuarios /></RotaProtegida>} />
          <Route path="/admin/relatorios" element={<RotaProtegida roles={EQUIPE}><Relatorios /></RotaProtegida>} />

          {/* EXEMPLO de rota só para um perfil (quando a página existir):
          <Route
            path="/admin/aprovacoes"
            element={<RotaProtegida roles={['ADMIN']}><Aprovacoes /></RotaProtegida>}
          />
          <Route
            path="/recepcao"
            element={<RotaProtegida roles={['ADMIN', 'RECEPTION']}><Recepcao /></RotaProtegida>}
          /> */}
        </Route>

        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;