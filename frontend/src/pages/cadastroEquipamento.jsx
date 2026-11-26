import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import '../css/gestao.css';

const API_URL = 'http://localhost:3080';

const FORM_VAZIO = { space_id: '', name: '', quantity: '1', description: '' };

// tela do funcionario pra cadastrar equipamento numa sala e ver os que ja tem
function CadastroEquipamento() {
  const navigate = useNavigate();

  const [equipamentos, setEquipamentos] = useState([]);
  const [salas, setSalas] = useState([]); // pro select de sala
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  // filtro da lista de baixo, '' é todas as salas
  const [filtroSala, setFiltroSala] = useState('');

  useEffect(() => {
    async function buscarDados() {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

      try {
        // Promise.all faz as duas buscas juntas e espera as duas acabarem
        const [respEquip, respSalas] = await Promise.all([
          fetch(`${API_URL}/reservas-equipamentos/equipamentos`, { headers }),
          fetch(`${API_URL}/spaces`, { headers }),
        ]);

        if (respEquip.status === 401 || respSalas.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        if (!respEquip.ok) {
          setErro('Não foi possível carregar os equipamentos');
          return;
        }

        setEquipamentos(await respEquip.json());
        // se nao tiver sala a rota manda 404, ai fica vazio
        setSalas(respSalas.ok ? await respSalas.json() : []);
      } catch {
        setErro('Não foi possível conectar ao servidor');
      } finally {
        setCarregando(false);
      }
    }

    buscarDados();
  }, [navigate]);

  function mudarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);

    try {
      const response = await fetch(`${API_URL}/reservas-equipamentos/equipamentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...form,
          space_id: Number(form.space_id),
          quantity: Number(form.quantity || 1),
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        navigate('/login');
        return;
      }

      const dados = await response.json();

      if (!response.ok) {
        setErro(dados.erro || 'Não foi possível cadastrar o equipamento');
        return;
      }

      setEquipamentos((lista) => [...lista, dados]);
      setMensagem(`Equipamento "${dados.name}" cadastrado em "${dados.space_name}".`);
      // deixa a sala escolhida pq geralmente cadastra varios itens na mesma sala
      setForm({ ...FORM_VAZIO, space_id: form.space_id });
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setSalvando(false);
    }
  }

  const salasOrdenadas = [...salas].sort((a, b) => a.name.localeCompare(b.name));

  // o id as vezes vem numero e as vezes texto, com String() compara certo nos dois
  const equipamentosFiltrados = equipamentos
    .filter((eq) => filtroSala === '' || String(eq.space_id) === filtroSala)
    .sort((a, b) => a.space_name.localeCompare(b.space_name) || a.name.localeCompare(b.name));

  return (
    <main className="gestao">
      <h1>Cadastro de equipamentos</h1>
      <p className="gestao-sub">Cadastre os equipamentos de cada sala (projetor, kit de solda...).</p>

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}
      {mensagem && <p className="gestao-mensagem sucesso" role="status">{mensagem}</p>}

      <section className="gestao-cartao">
        <h2>Novo equipamento</h2>

        <form className="gestao-form" onSubmit={handleSubmit}>
          <div className="gestao-campo">
            <label htmlFor="space_id">Sala *</label>
            <select id="space_id" name="space_id" value={form.space_id} onChange={mudarCampo} required>
              <option value="">Selecione a sala</option>
              {salasOrdenadas.map((sala) => (
                <option key={sala.id} value={sala.id}>{sala.name}</option>
              ))}
            </select>
          </div>

          <div className="gestao-campo">
            <label htmlFor="name">Nome *</label>
            <input id="name" name="name" value={form.name} onChange={mudarCampo} required />
          </div>

          <div className="gestao-campo">
            <label htmlFor="quantity">Quantidade</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              value={form.quantity}
              onChange={mudarCampo}
            />
          </div>

          <div className="gestao-campo inteiro">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" name="description" value={form.description} onChange={mudarCampo} />
          </div>

          <div className="gestao-form-rodape">
            <button type="submit" className="gestao-botao" disabled={salvando}>
              <Plus size={16} />
              {salvando ? 'Salvando...' : 'Cadastrar equipamento'}
            </button>
          </div>
        </form>
      </section>

      <section className="gestao-cartao">
        <h2>Equipamentos cadastrados</h2>

        <div className="gestao-abas">
          <select aria-label="Filtrar por sala" value={filtroSala} onChange={(e) => setFiltroSala(e.target.value)}>
            <option value="">Todas as salas</option>
            {salasOrdenadas.map((sala) => (
              <option key={sala.id} value={String(sala.id)}>{sala.name}</option>
            ))}
          </select>
        </div>

        {carregando && <p className="gestao-aviso">Carregando equipamentos...</p>}
        {!carregando && equipamentosFiltrados.length === 0 && (
          <p className="gestao-aviso">Nenhum equipamento encontrado.</p>
        )}

        {!carregando && equipamentosFiltrados.length > 0 && (
          <div className="gestao-tabela-caixa">
            <table className="gestao-tabela">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Sala</th>
                  <th>Quantidade</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {equipamentosFiltrados.map((eq) => (
                  <tr key={eq.id}>
                    <td><strong>{eq.name}</strong></td>
                    <td>{eq.space_name}</td>
                    <td>{eq.quantity}</td>
                    <td className="suave">{eq.description || '—'}</td>
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

export default CadastroEquipamento;
