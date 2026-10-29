import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login';
import Dashboard from './pages/home';

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
    // limpa o que sobrou do login antigo
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
        <Route
          path="/dashboard"
          element={
            <RotaProtegida>
              <Dashboard />
            </RotaProtegida>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;