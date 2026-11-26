import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/login';
import Dashboard from './pages/home';
import Espacos from './pages/espacos';
import Reservas from './pages/reservas';

// abre o token e devolve o payload id, role, exp, ou null se estiver mal formado
function lerToken(token) {
  try {
    // o token tem 3 partes separadas por ponto; a do meio é o payload em base64
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// "porteiro" das páginas protegidas.
// Sem "roles": qualquer usuário logado entra.
// Com "roles" (ex.: roles={['ADMIN']}): só esses perfis entram.
function RotaProtegida({ children, roles }) {
  const token = localStorage.getItem('token');
  const payload = token ? lerToken(token) : null;

  // exp vem em segundos; Date.now() vem em milissegundos, por isso o * 1000
  const valido = payload && payload.exp * 1000 > Date.now();

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
        <Route path="/login" element={<Login />} />

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

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;