// =====================================================================
// TELA DE CADASTRO DE SALAS (parte do funcionario)
// em cima tem o formulario pra cadastrar uma sala nova
// embaixo a tabela com todas as salas que ja existem
// o funcionario e o adm podem cadastrar, mas editar e apagar sala é so o adm (isso ta travado no back)
// =====================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// icone de "+" do botao de cadastrar
import { Plus } from 'lucide-react';
import '../css/gestao.css';

// endereço do back-end
const API_URL = 'http://localhost:3080';

// tipos que o banco aceita (enum space_type) e o nome que aparece pro usuario
// o "valor" é o que vai pro banco, o "texto" é o que aparece no select
const TIPOS = [
  { valor: 'MEETING_ROOM', texto: 'Sala de reunião' },
  { valor: 'COWORKING', texto: 'Coworking' },
  { valor: 'LAB', texto: 'Laboratório' },
];

// recebe o tipo em ingles (ex: "LAB") e devolve o nome bonito ("Laboratório") pra tabela
function nomeDoTipo(tipo) {
  const encontrado = TIPOS.find((t) => t.valor === tipo);
  return encontrado ? encontrado.texto : tipo;
}

// form vazio, uso no começo e pra limpar depois que salva
// os nomes dos campos sao iguais aos que o back espera, assim da pra mandar o form direto
const FORM_VAZIO = {
  name: '', // nome da sala
  type: 'MEETING_ROOM', // tipo (ja vem marcado sala de reuniao)
  capacity: '', // quantas pessoas cabem
  buffer_minutes: '0', // intervalo entre uma reserva e outra
  description: '', // descriçao
  terms_of_use: '', // regras de uso que o cliente ve na hora de reservar
};

// tela do funcionario pra cadastrar sala e ver as que ja tem
function CadastroSala() {
  const navigate = useNavigate();

  const [salas, setSalas] = useState([]); // lista de salas que veio do back
  const [carregando, setCarregando] = useState(true);

  // deixei o form todo num objeto so, cada input muda o seu campo
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false); // trava o botao enquanto salva
  const [erro, setErro] = useState(''); // aviso vermelho
  const [mensagem, setMensagem] = useState(''); // aviso verde

  // quando a tela abre busca as salas que ja existem (GET /spaces)
  useEffect(() => {
    async function buscarSalas() {
      try {
        const response = await fetch(`${API_URL}/spaces`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        // token vencido, volta pro login
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        // o back manda 404 quando nao tem nenhuma sala, ai so deixo a lista vazia
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

  // muda so o campo que mexeu, o "name" do input fala qual é
  // ex: digitou no input name="capacity", ai muda so o form.capacity
  function mudarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // quando clica em "cadastrar sala"
  async function handleSubmit(e) {
    e.preventDefault(); // nao deixa a pagina recarregar (padrao do form)
    setErro('');
    setMensagem('');
    setSalvando(true);

    try {
      // POST /spaces cria a sala
      const response = await fetch(`${API_URL}/spaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        // o input sempre devolve texto, entao converto capacidade e intervalo pra numero
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

      // 409 é quando ja tem sala com esse nome
      if (response.status === 409) {
        setErro(`Já existe uma sala chamada "${form.name}".`);
        return;
      }

      if (!response.ok) {
        // a rota de espaços as vezes manda "erro" e as vezes "error", entao pego os dois
        setErro(dados.erro || dados.error || 'Não foi possível cadastrar a sala');
        return;
      }

      // deu certo: coloca a sala nova na tabela sem precisar buscar tudo de novo
      setSalas((lista) => [...lista, dados]);
      setMensagem(`Sala "${dados.name}" cadastrada.`);
      setForm(FORM_VAZIO); // limpa o form pra cadastrar outra
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setSalvando(false);
    }
  }

  // deixa as salas em ordem alfabetica
  const salasOrdenadas = [...salas].sort((a, b) => a.name.localeCompare(b.name));

  // ----- o que aparece na tela -----
  return (
    <main className="gestao">
      <h1>Cadastro de salas</h1>
      <p className="gestao-sub">Cadastre os espaços que os clientes podem reservar.</p>

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}
      {mensagem && <p className="gestao-mensagem sucesso" role="status">{mensagem}</p>}

      {/* ===== formulario de sala nova ===== */}
      <section className="gestao-cartao">
        <h2>Nova sala</h2>

        <form className="gestao-form" onSubmit={handleSubmit}>
          <div className="gestao-campo">
            <label htmlFor="name">Nome *</label>
            <input id="name" name="name" value={form.name} onChange={mudarCampo} required />
          </div>

          {/* select montado com a lista TIPOS lá de cima */}
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

          {/* o intervalo é pra dar tempo de limpar a sala entre uma reserva e outra
              o banco usa isso pra nao deixar marcar reserva colada na outra */}
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

          {/* "inteiro" faz o campo ocupar a linha toda no css */}
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

      {/* ===== tabela das salas que ja existem ===== */}
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
                    {/* "1 pessoa" ou "6 pessoas" */}
                    <td>{sala.capacity} {sala.capacity === 1 ? 'pessoa' : 'pessoas'}</td>
                    <td className="suave">{sala.buffer_minutes} min</td>
                    <td>
                      {/* verde se ta ativa, cinza se ta inativa */}
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
