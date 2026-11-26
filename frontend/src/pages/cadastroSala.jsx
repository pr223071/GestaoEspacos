import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import '../css/gestao.css';

const API_URL = 'http://localhost:3080';

// tipos aceitos pelo banco (enum space_type) e o texto que aparece na tela
const TIPOS = [
  { valor: 'MEETING_ROOM', texto: 'Sala de reunião' },
  { valor: 'COWORKING', texto: 'Coworking' },
  { valor: 'LAB', texto: 'Laboratório' },
];

function nomeDoTipo(tipo) {
  const encontrado = TIPOS.find((t) => t.valor === tipo);
  return encontrado ? encontrado.texto : tipo;
}

// formulário vazio; usado no começo e para limpar depois de salvar
const FORM_VAZIO = {
  name: '',
  type: 'MEETING_ROOM',
  capacity: '',
  buffer_minutes: '0',
  description: '',
  terms_of_use: '',
};

// Tela do funcionário: cadastrar sala (espaço) e ver as que já existem
function CadastroSala() {
  const navigate = useNavigate();

  const [salas, setSalas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // um objeto só para o formulário inteiro; cada input muda a sua chave
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    async function buscarSalas() {
      try {
        const response = await fetch(`${API_URL}/spaces`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        // o back-end responde 404 quando ainda não tem nenhuma sala: lista vazia
        if (response.status === 404) {
          setSalas([]);
          return;
        }

        if (!response.ok) {
          setErro('Não foi possível carregar as salas');
          return;
        }

        setSalas(await response.json());
      } catch {
        setErro('Não foi possível conectar ao servidor');
      } finally {
        setCarregando(false);
      }
    }

    buscarSalas();
  }, [navigate]);

  // atualiza só o campo que mudou; o "name" do input diz qual chave do form é
  function mudarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);

    try {
      const response = await fetch(`${API_URL}/spaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...form,
          capacity: Number(form.capacity),
          buffer_minutes: Number(form.buffer_minutes || 0),
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        navigate('/login');
        return;
      }

      const dados = await response.json();

      // 409 = o banco não aceita duas salas com o mesmo nome
      if (response.status === 409) {
        setErro(`Já existe uma sala chamada "${form.name}".`);
        return;
      }

      if (!response.ok) {
        // a rota de espaços usa "erro" em algumas respostas e "error" em outras
        setErro(dados.erro || dados.error || 'Não foi possível cadastrar a sala');
        return;
      }

      setSalas((lista) => [...lista, dados]);
      setMensagem(`Sala "${dados.name}" cadastrada.`);
      setForm(FORM_VAZIO);
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setSalvando(false);
    }
  }

  // mostra as salas em ordem alfabética
  const salasOrdenadas = [...salas].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="gestao">
      <h1>Cadastro de salas</h1>
      <p className="gestao-sub">Cadastre os espaços que os clientes podem reservar.</p>

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}
      {mensagem && <p className="gestao-mensagem sucesso" role="status">{mensagem}</p>}

      <section className="gestao-cartao">
        <h2>Nova sala</h2>

        <form className="gestao-form" onSubmit={handleSubmit}>
          <div className="gestao-campo">
            <label htmlFor="name">Nome *</label>
            <input id="name" name="name" value={form.name} onChange={mudarCampo} required />
          </div>

          <div className="gestao-campo">
            <label htmlFor="type">Tipo *</label>
            <select id="type" name="type" value={form.type} onChange={mudarCampo}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.texto}</option>
              ))}
            </select>
          </div>

          <div className="gestao-campo">
            <label htmlFor="capacity">Capacidade (pessoas) *</label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={mudarCampo}
              required
            />
          </div>

          <div className="gestao-campo">
            <label htmlFor="buffer_minutes">Intervalo entre reservas (min)</label>
            <input
              id="buffer_minutes"
              name="buffer_minutes"
              type="number"
              min="0"
              max="240"
              value={form.buffer_minutes}
              onChange={mudarCampo}
            />
            <small>Tempo livre entre uma reserva e outra (limpeza, preparação). De 0 a 240.</small>
          </div>

          <div className="gestao-campo inteiro">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" name="description" value={form.description} onChange={mudarCampo} />
          </div>

          <div className="gestao-campo inteiro">
            <label htmlFor="terms_of_use">Termos de uso</label>
            <textarea id="terms_of_use" name="terms_of_use" value={form.terms_of_use} onChange={mudarCampo} />
          </div>

          <div className="gestao-form-rodape">
            <button type="submit" className="gestao-botao" disabled={salvando}>
              <Plus size={16} />
              {salvando ? 'Salvando...' : 'Cadastrar sala'}
            </button>
          </div>
        </form>
      </section>

      <section className="gestao-cartao">
        <h2>Salas cadastradas</h2>

        {carregando && <p className="gestao-aviso">Carregando salas...</p>}
        {!carregando && salas.length === 0 && <p className="gestao-aviso">Nenhuma sala cadastrada.</p>}

        {!carregando && salas.length > 0 && (
          <div className="gestao-tabela-caixa">
            <table className="gestao-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Capacidade</th>
                  <th>Intervalo</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {salasOrdenadas.map((sala) => (
                  <tr key={sala.id}>
                    <td><strong>{sala.name}</strong></td>
                    <td>{nomeDoTipo(sala.type)}</td>
                    <td>{sala.capacity} {sala.capacity === 1 ? 'pessoa' : 'pessoas'}</td>
                    <td className="suave">{sala.buffer_minutes} min</td>
                    <td>
                      <span className={`gestao-status ${sala.is_active ? 'aprovada' : 'cancelada'}`}>
                        {sala.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default CadastroSala;
