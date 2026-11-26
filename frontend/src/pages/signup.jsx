import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { mascaraCpf, mascaraTelefone, soNumeros } from '../utils/mascaras';

// endereço do backend; se um dia mudar a porta, muda só aqui
const API_URL = 'http://localhost:3080';

// formulário de cadastro (tema branco). Ele fica dentro da tela Auth (pages/auth.jsx).
// onCadastrado: avisa a tela Auth qual e-mail foi criado, para o login já abrir preenchido
function Signup({ onCadastrado }) {
  // um objeto só com todos os campos do formulário
  const [form, setForm] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    password: '',
    confirmar: '',
  });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const navigate = useNavigate();

  // atualiza só o campo que mudou (usa o "name" do input)
  // cpf e telefone já ganham a máscara enquanto digita
  function alterar(e) {
    const { name, value } = e.target;
    let valor = value;
    if (name === 'cpf') valor = mascaraCpf(value);
    if (name === 'phone') valor = mascaraTelefone(value);
    setForm({ ...form, [name]: valor });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    if (soNumeros(form.cpf).length !== 11) {
      setErro('CPF inválido: deve ter 11 números');
      return;
    }
    const tel = soNumeros(form.phone);
    if (tel.length !== 10 && tel.length !== 11) {
      setErro('Telefone inválido: informe o DDD + número');
      return;
    }
    if (form.password.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (form.password !== form.confirmar) {
      setErro('As senhas não conferem');
      return;
    }

    setCarregando(true);
    try {
      // mesma rota de criação de cliente; sem token o backend força role CLIENT
      const response = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          // no banco cpf e telefone ficam só com números
          cpf: soNumeros(form.cpf),
          phone: soNumeros(form.phone),
          password: form.password,
          role: 'CLIENT',
        }),
      });

      const dados = await response.json();

      if (!response.ok) {
        setErro(dados.erro || dados.error || 'Não foi possível criar a conta');
        return;
      }

      // conta criada: limpa o form e desliza para o login com o e-mail preenchido
      onCadastrado(form.email);
      setForm({ name: '', email: '', cpf: '', phone: '', password: '', confirmar: '' });
      navigate('/login');
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-meio">
        <h1 className="auth-titulo">Cadastro</h1>

        <div className="auth-grade">
          <div className="auth-campo">
            <label htmlFor="cad-nome">Nome completo</label>
            <input id="cad-nome" name="name" type="text" placeholder="Seu nome"
              autoComplete="name" value={form.name} onChange={alterar} required />
          </div>

          <div className="auth-campo">
            <label htmlFor="cad-email">E-mail</label>
            <input id="cad-email" name="email" type="email" placeholder="seu@email.com"
              autoComplete="email" value={form.email} onChange={alterar} required />
          </div>

          <div className="auth-campo">
            <label htmlFor="cad-cpf">CPF</label>
            <input id="cad-cpf" name="cpf" type="text" inputMode="numeric"
              placeholder="000.000.000-00" maxLength={14}
              value={form.cpf} onChange={alterar} required />
          </div>

          <div className="auth-campo">
            <label htmlFor="cad-tel">Telefone</label>
            <input id="cad-tel" name="phone" type="tel" inputMode="numeric" placeholder="(48) 99999-9999" maxLength={15}
              autoComplete="tel" value={form.phone} onChange={alterar} required />
          </div>

          <div className="auth-campo">
            <label htmlFor="cad-senha">Senha</label>
            <div className="auth-campo-senha">
              <input id="cad-senha" name="password"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                value={form.password} onChange={alterar} required />
              <button type="button" className="auth-olho"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}>
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="auth-campo">
            <label htmlFor="cad-confirmar">Confirmar senha</label>
            <input id="cad-confirmar" name="confirmar"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Repita a senha" autoComplete="new-password"
              value={form.confirmar} onChange={alterar} required />
          </div>
        </div>

        {erro && <p className="auth-erro" role="alert">{erro}</p>}

        <button type="submit" className="auth-botao" disabled={carregando}>
          {carregando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>

      <p className="auth-troca">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </form>
  );
}

export default Signup;
