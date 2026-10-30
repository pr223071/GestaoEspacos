import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/login';
import Dashboard from './pages/home';
import Espacos from './pages/espacos';

// lê o token e diz se ele ainda está dentro da validade
function tokenValido(token) {
  try {
    // o token tem 3 partes separadas por ponto; a do meio é o payload em base64
    const payload = JSON.parse(atob(token.split('.')[1]));

    // exp vem em segundos; Date.now() vem em milissegundos, por isso o * 1000
    return payload.exp * 1000 > Date.now();
  } catch {
    // token mal formado conta como inválido
    return false;
  }
}

// "porteiro" das páginas protegidas: sem token ou com token vencido, manda para o login
function RotaProtegida({ children }) {
  const token = localStorage.getItem('token');

  if (!token || !tokenValido(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    return <Navigate to="/login" replace />;
  }

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
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;