import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Eye, EyeOff } from 'lucide-react';
import '../css/login.css';

// endereço do backend; se um dia mudar a porta, muda só aqui
const API_URL = 'http://localhost:3080';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  // NOVO: controla se a senha aparece ou fica escondida (botão do olho)
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
    <main className="login-pagina">
      {/* LADO ESQUERDO: marca + foto. aria-hidden porque é só decoração */}
      <aside className="login-banner" aria-hidden="true">
        <div className="login-marca">
          <div className="login-logo">
            <Box size={34} strokeWidth={1.8} />
            <span>SGEC</span>
          </div>
          <p className="login-subtitulo">Gestão de Espaços</p>
          <p className="login-tags">Coworking • Laboratórios • Reuniões</p>
        </div>
        <div className="login-foto" />
      </aside>

      {/* LADO DIREITO: o formulário */}
      <section className="login-lado-form">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Bem-vindo!</h1>
          <p className="login-instrucao">Faça login para continuar</p>

          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Senha</label>
          {/* div em volta para posicionar o olho dentro do campo */}
          <div className="login-campo-senha">
            <input
              id="password"
              // troca o tipo do input: "text" mostra a senha, "password" esconde
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button" // "button" para NÃO enviar o formulário ao clicar
              className="login-olho"
              onClick={() => setMostrarSenha(!mostrarSenha)} // inverte true/false
              aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {erro && <p className="login-erro" role="alert">{erro}</p>}

          <button type="submit" className="login-botao" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>

          {/* ainda não existe essa tela; fica de enfeite por enquanto */}
          <button type="button" className="login-esqueci">
            Esqueceu sua senha?
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;