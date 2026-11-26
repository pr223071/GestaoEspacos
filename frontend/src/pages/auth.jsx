import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import Login from './login';
import Signup from './signup';
import '../css/auth.css';

// tela única de entrada: /login e /signup usam ESTE componente.
// como ele não é recriado ao trocar de rota, o CSS consegue animar:
// o painel da logo desliza para o outro lado, o formulário troca de lado
// e as cores passam de preto (login) para branco (cadastro).
function Auth() {
  const { pathname } = useLocation();
  const modo = pathname === '/login' ? 'login' : 'signup';

  // quando o cadastro dá certo, o login abre com o e-mail já preenchido
  const [emailCadastrado, setEmailCadastrado] = useState('');

  return (
    <main className="auth" data-modo={modo}>
      <div className="auth-palco">
        {/* lado esquerdo: cadastro (fica escondido atrás do painel no modo login) */}
        <div className="auth-card auth-card--signup" inert={modo !== 'signup'}>
          <Signup onCadastrado={setEmailCadastrado} />
        </div>

        {/* lado direito: login (fica escondido atrás do painel no modo cadastro) */}
        <div className="auth-card auth-card--login" inert={modo !== 'login'}>
          {/* a key recria o form quando chega um e-mail novo do cadastro */}
          <Login key={emailCadastrado} emailCadastrado={emailCadastrado} />
        </div>

        {/* o painel que desliza por cima: marca, linhas e logo */}
        <aside className="auth-painel" aria-hidden="true">
          <p className="auth-marca">
            SGEC<sup>®</sup>
          </p>

          {/* linhas finas do fundo (vertical, horizontal e diagonais) */}
          <svg className="auth-linhas" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="50" y1="0" x2="50" y2="100" />
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="0" y1="12" x2="50" y2="50" />
            <line x1="0" y1="88" x2="50" y2="50" />
          </svg>

          <Logo className="auth-logo" size={170} />

          <p className="auth-rodape">© SGEC 2026. Todos os direitos reservados.</p>
        </aside>
      </div>
    </main>
  );
}

export default Auth;
