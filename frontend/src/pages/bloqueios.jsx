import { useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { chamarApi, formatarDataHora } from '../utils/api';
import '../css/gestao.css';

const FORM_VAZIO = { space_id: '', start_datetime: '', end_datetime: '', reason: '' };

// tela do adm pra bloquear uma sala por um periodo (manutencao, evento interno...)
// enquanto o bloqueio existir o banco nao aceita reservas nesse periodo
function Bloqueios() {
  const [bloqueios, setBloqueios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null); // null = criando um novo
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [filtroSala, setFiltroSala] = useState('');
  // "agora" no mesmo formato dos bloqueios (AAAA-MM-DDTHH:MM); calculado uma vez ao abrir a tela
  const [agoraTexto] = useState(() => {
    const d = new Date();
    const dois = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
  });

  useEffect(() => {
    async function buscarDados() {
      try {
        const [respBloqueios, respSalas] = await Promise.all([
          chamarApi('/bloqueios'),
          chamarApi('/spaces'),
        ]);
        if (!respBloqueios.ok) {
          setErro(respBloqueios.dados?.erro || 'Não foi possível carregar os bloqueios');
          return;
        }
        setBloqueios(respBloqueios.dados);
        // se não tiver sala a rota manda 404, aí fica vazio
        setSalas(respSalas.ok ? respSalas.dados : []);
      } catch {
        setErro('Não foi possível conectar ao servidor');
      } finally {
        setCarregando(false);
      }
    }
    buscarDados();
  }, []);

  function mudarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro('');
  }

  function editar(bloqueio) {
    setEditandoId(bloqueio.id);
    setForm({
      space_id: String(bloqueio.space_id),
      start_datetime: bloqueio.start_datetime,
      end_datetime: bloqueio.end_datetime,
      reason: bloqueio.reason,
    });
    setErro('');
    setMensagem('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const corpo = {
      space_id: Number(form.space_id),
      start_datetime: form.start_datetime,
      end_datetime: form.end_datetime,
      reason: form.reason,
    };
    // quem criou fica registrado so na criacao; na edicao mantem o original
    if (editandoId === null && usuario.id) corpo.created_by = Number(usuario.id);

    try {
      const resp = await chamarApi(editandoId === null ? '/bloqueios' : `/bloqueios/${editandoId}`, {
        method: editandoId === null ? 'POST' : 'PUT',
        body: JSON.stringify(corpo),
      });

      if (!resp.ok) {
        // 409 = ja existem reservas nesse periodo (a api diz quais)
        setErro(resp.dados?.erro || 'Não foi possível salvar o bloqueio');
        return;
      }

      if (editandoId === null) {
        setBloqueios((lista) => [...lista, resp.dados]);
        setMensagem('Bloqueio cadastrado. O espaço não aceita reservas nesse período.');
      } else {
        setBloqueios((lista) => lista.map((b) => (b.id === editandoId ? resp.dados : b)));
        setMensagem('Bloqueio atualizado.');
      }
      setEditandoId(null);
      setForm(FORM_VAZIO);
    } catch {
      setErro('Não foi possível conectar ao servidor');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(bloqueio) {
    if (!window.confirm('Remover este bloqueio? O espaço volta a aceitar reservas nesse período.')) return;
    setErro('');
    setMensagem('');

    try {
      const resp = await chamarApi(`/bloqueios/${bloqueio.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        setErro(resp.dados?.erro || 'Não foi possível remover o bloqueio');
        return;
      }
      setBloqueios((lista) => lista.filter((b) => b.id !== bloqueio.id));
      if (editandoId === bloqueio.id) cancelarEdicao();
      setMensagem('Bloqueio removido.');
    } catch {
      setErro('Não foi possível conectar ao servidor');
    }
  }

  const nomeDaSala = (id) => salas.find((s) => String(s.id) === String(id))?.name || `Sala ${id}`;
  const salasOrdenadas = [...salas].sort((a, b) => a.name.localeCompare(b.name));

  // os mais recentes primeiro (o texto AAAA-MM-DDTHH:MM da pra comparar direto)
  const lista = bloqueios
    .filter((b) => filtroSala === '' || String(b.space_id) === filtroSala)
    .sort((a, b) => b.start_datetime.localeCompare(a.start_datetime));

  function situacao(b) {
    if (b.end_datetime <= agoraTexto) return { texto: 'Encerrado', classe: 'cancelada' };
    if (b.start_datetime <= agoraTexto) return { texto: 'Em andamento', classe: 'recusada' };
    return { texto: 'Agendado', classe: 'pendente' };
  }

  return (
    <main className="gestao">
      <h1>Bloqueios</h1>
      <p className="gestao-sub">
        Feche uma sala para manutenção ou evento interno. Nesse período ninguém consegue reservá-la.
      </p>

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}
      {mensagem && <p className="gestao-mensagem sucesso" role="status">{mensagem}</p>}

      <section className="gestao-cartao">
        <h2>{editandoId === null ? 'Novo bloqueio' : `Editando o bloqueio #${editandoId}`}</h2>

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
            <label htmlFor="start_datetime">Início *</label>
            <input id="start_datetime" name="start_datetime" type="datetime-local" value={form.start_datetime} onChange={mudarCampo} required />
          </div>

          <div className="gestao-campo">
            <label htmlFor="end_datetime">Fim *</label>
            <input id="end_datetime" name="end_datetime" type="datetime-local" value={form.end_datetime} onChange={mudarCampo} required />
          </div>

          <div className="gestao-campo inteiro">
            <label htmlFor="reason">Motivo *</label>
            <textarea id="reason" name="reason" value={form.reason} onChange={mudarCampo} placeholder="Ex.: manutenção das bancadas" required />
          </div>

          <div className="gestao-form-rodape">
            {editandoId !== null && (
              <button type="button" className="gestao-acao cancelar" onClick={cancelarEdicao}>
                <X size={14} /> Cancelar edição
              </button>
            )}
            <button type="submit" className="gestao-botao" disabled={salvando}>
              {editandoId === null ? <Plus size={16} /> : <Save size={16} />}
              {salvando ? 'Salvando...' : editandoId === null ? 'Bloquear sala' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>

      <section className="gestao-cartao">
        <h2>Bloqueios cadastrados</h2>

        <div className="gestao-abas">
          <select aria-label="Filtrar por sala" value={filtroSala} onChange={(e) => setFiltroSala(e.target.value)}>
            <option value="">Todas as salas</option>
            {salasOrdenadas.map((sala) => (
              <option key={sala.id} value={String(sala.id)}>{sala.name}</option>
            ))}
          </select>
        </div>

        {carregando && <p className="gestao-aviso">Carregando bloqueios...</p>}
        {!carregando && lista.length === 0 && <p className="gestao-aviso">Nenhum bloqueio encontrado.</p>}

        {!carregando && lista.length > 0 && (
          <div className="gestao-tabela-caixa">
            <table className="gestao-tabela">
              <thead>
                <tr>
                  <th>Sala</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Motivo</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((b) => {
                  const s = situacao(b);
                  return (
                    <tr key={b.id}>
                      <td><strong>{nomeDaSala(b.space_id)}</strong></td>
                      <td>{formatarDataHora(b.start_datetime)}</td>
                      <td>{formatarDataHora(b.end_datetime)}</td>
                      <td className="suave">{b.reason}</td>
                      <td><span className={`gestao-status ${s.classe}`}>{s.texto}</span></td>
                      <td>
                        <div className="gestao-acoes">
                          <button type="button" className="gestao-acao cancelar" onClick={() => editar(b)}>Editar</button>
                          <button type="button" className="gestao-acao recusar" onClick={() => remover(b)}>Remover</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default Bloqueios;
