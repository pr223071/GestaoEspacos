import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff } from 'lucide-react';

// endereço do backend; se um dia mudar a porta, muda só aqui
const API_URL = 'http://localhost:3080';

// formulário de login (tema preto). Ele fica dentro da tela Auth (pages/auth.jsx).
// emailCadastrado: vem preenchido quando a pessoa acabou de criar a conta
function Login({ emailCadastrado }) {
  // "lembrar de mim" guarda só o e-mail neste navegador, nunca a senha
  const emailLembrado = localStorage.getItem('emailLembrado') || '';

  const [email, setEmail] = useState(emailCadastrado || emailLembrado);
  const [password, setPassword] = useState('');
  const [lembrar, setLembrar] = useState(Boolean(emailLembrado));
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const dados = await response.json();

      if (!response.ok) {
        setErro(dados.erro || 'Não foi possível entrar');
        return;
      }

      if (lembrar) localStorage.setItem('emailLembrado', email);
      else localStorage.removeItem('emailLembrado');

      localStorage.setItem('token', dados.token);
      localStorage.setItem('usuario', JSON.stringify(dados.usuario));
      navigate('/dashboard');
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <nav className="auth-topo">
        <Link to="/signup">Criar uma conta</Link>
      </nav>

      <div className="auth-meio">
        <h1 className="auth-titulo">Login</h1>

        {emailCadastrado && (
          <p className="auth-sucesso" role="status">Conta criada! Agora é só entrar.</p>
        )}

        <div className="auth-grade">
          <div className="auth-campo">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="auth-check">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
              />
              <span className="auth-check-bola">{lembrar && <Check size={10} strokeWidth={3} />}</span>
              Lembrar de mim
            </label>
          </div>

          <div className="auth-campo">
            <label htmlFor="login-senha">Senha</label>
            <div className="auth-campo-senha">
              <input
                id="login-senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Sua senha"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button" // "button" para NÃO enviar o formulário ao clicar
                className="auth-olho"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* ainda não existe essa tela; fica de enfeite por enquanto */}
            <button type="button" className="auth-link-pequeno">Esqueceu?</button>
          </div>
        </div>

        {erro && <p className="auth-erro" role="alert">{erro}</p>}

        <button type="submit" className="auth-botao" disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </form>
  );
}

export default Login;
