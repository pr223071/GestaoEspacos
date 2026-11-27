import { useEffect, useState } from "react";
import { Plus, Save, Search, X } from "lucide-react";
import { chamarApi } from "../utils/api";
import { mascaraCpf, mascaraTelefone, soNumeros } from "../utils/mascaras";
import "../css/gestao.css";

const NOME_PERFIL = {
  ADMIN: "Administrador",
  CLIENT: "Cliente",
  RECEPTION: "Recepção",
};

const FORM_VAZIO = {
  name: "",
  email: "",
  cpf: "",
  phone: "",
  role: "CLIENT",
  password: "",
};

// tela do adm pra cadastrar, alterar e inativar usuarios
// (inativar = is_active false: a pessoa nao consegue mais logar, mas o historico fica)
function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState("");

  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null); // null = criando um novo
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // o adm nao pode inativar nem tirar o proprio perfil de ADMIN (ia se trancar pra fora)
  // (o id pode vir numero ou texto, entao a comparacao usa String)
  const meuId = String(JSON.parse(localStorage.getItem("usuario") || "{}").id);

  useEffect(() => {
    async function buscarUsuarios() {
      try {
        const resp = await chamarApi("/clients");
        if (!resp.ok) {
          setErro(
            resp.dados?.error ||
              resp.dados?.erro ||
              "Não foi possível carregar os usuários",
          );
          return;
        }
        setUsuarios(resp.dados);
      } catch {
        setErro("Não foi possível conectar ao servidor");
      } finally {
        setCarregando(false);
      }
    }
    buscarUsuarios();
  }, []);

  function mudarCampo(e) {
    const { name, value } = e.target;
    if (name === "cpf") return setForm({ ...form, cpf: mascaraCpf(value) });
    if (name === "phone")
      return setForm({ ...form, phone: mascaraTelefone(value) });
    setForm({ ...form, [name]: value });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro("");
  }

  function editar(u) {
    setEditandoId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      cpf: mascaraCpf(u.cpf),
      phone: mascaraTelefone(u.phone),
      role: u.role,
      password: "",
    });
    setErro("");
    setMensagem("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    setSalvando(true);

    const corpo = {
      name: form.name.trim(),
      email: form.email.trim(),
      cpf: soNumeros(form.cpf),
      phone: soNumeros(form.phone),
      role: form.role,
    };

    try {
      let resp;
      if (editandoId === null) {
        // a rota POST /clients exige a senha
        resp = await chamarApi("/clients", {
          method: "POST",
          body: JSON.stringify({ ...corpo, password: form.password }),
        });
      } else {
        resp = await chamarApi(`/clients/update/${editandoId}`, {
          method: "PUT",
          body: JSON.stringify(corpo),
        });
      }

      if (!resp.ok) {
        setErro(resp.dados?.erro || "Não foi possível salvar o usuário");
        return;
      }

      if (editandoId === null) {
        setUsuarios((lista) => [...lista, resp.dados]);
        setMensagem(`Usuário "${resp.dados.name}" cadastrado.`);
      } else {
        setUsuarios((lista) =>
          lista.map((u) => (u.id === editandoId ? resp.dados : u)),
        );
        setMensagem(`Usuário "${resp.dados.name}" atualizado.`);
      }
      setEditandoId(null);
      setForm(FORM_VAZIO);
    } catch {
      setErro("Não foi possível conectar ao servidor");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(u) {
    setErro("");
    setMensagem("");
    try {
      const resp = await chamarApi(`/clients/update/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      if (!resp.ok) {
        setErro(resp.dados?.erro || "Não foi possível alterar o usuário");
        return;
      }
      setUsuarios((lista) =>
        lista.map((x) => (x.id === u.id ? resp.dados : x)),
      );
      setMensagem(
        `Usuário "${u.name}" ${resp.dados.is_active ? "reativado" : "inativado"}.`,
      );
    } catch {
      setErro("Não foi possível conectar ao servidor");
    }
  }

  const textoBusca = busca.trim().toLowerCase();
  const lista = usuarios
    .filter((u) => filtroPerfil === "" || u.role === filtroPerfil)
    .filter(
      (u) =>
        textoBusca === "" ||
        u.name.toLowerCase().includes(textoBusca) ||
        u.email.toLowerCase().includes(textoBusca),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="gestao">
      <h1>Usuários</h1>
      <p className="gestao-sub">
        Cadastre, altere e inative os usuários do sistema (clientes, recepção e
        administradores).
      </p>

      {erro && (
        <p className="gestao-mensagem erro" role="alert">
          {erro}
        </p>
      )}
      {mensagem && (
        <p className="gestao-mensagem sucesso" role="status">
          {mensagem}
        </p>
      )}

      <section className="gestao-cartao">
        <h2>
          {editandoId === null
            ? "Novo usuário"
            : `Editando o usuário #${editandoId}`}
        </h2>

        <form className="gestao-form" onSubmit={handleSubmit}>
          <div className="gestao-campo">
            <label htmlFor="name">Nome *</label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={mudarCampo}
              required
            />
          </div>

          <div className="gestao-campo">
            <label htmlFor="email">E-mail *</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={mudarCampo}
              required
            />
          </div>

          <div className="gestao-campo">
            <label htmlFor="cpf">CPF *</label>
            <input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              value={form.cpf}
              onChange={mudarCampo}
              placeholder="000.000.000-00"
              required
            />
          </div>

          <div className="gestao-campo">
            <label htmlFor="phone">Telefone *</label>
            <input
              id="phone"
              name="phone"
              inputMode="tel"
              value={form.phone}
              onChange={mudarCampo}
              placeholder="(48) 99999-9999"
              required
            />
          </div>

          <div className="gestao-campo">
            <label htmlFor="role">Perfil *</label>
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={mudarCampo}
              disabled={editandoId !== null && String(editandoId) === meuId}
            >
              {Object.entries(NOME_PERFIL).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </div>

          {editandoId === null && (
            <div className="gestao-campo">
              <label htmlFor="password">Senha *</label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={4}
                value={form.password}
                onChange={mudarCampo}
                required
              />
              <small>Mínimo de 4 caracteres.</small>
            </div>
          )}

          <div className="gestao-form-rodape">
            {editandoId !== null && (
              <button
                type="button"
                className="gestao-acao cancelar"
                onClick={cancelarEdicao}
              >
                <X size={14} /> Cancelar edição
              </button>
            )}
            <button type="submit" className="gestao-botao" disabled={salvando}>
              {editandoId === null ? <Plus size={16} /> : <Save size={16} />}
              {salvando
                ? "Salvando..."
                : editandoId === null
                  ? "Cadastrar usuário"
                  : "Salvar alterações"}
            </button>
          </div>
        </form>
      </section>

      <section className="gestao-cartao">
        <h2>Usuários cadastrados</h2>

        <div className="gestao-abas">
          <label className="gestao-busca">
            <Search size={15} />
            <input
              type="search"
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por perfil"
            value={filtroPerfil}
            onChange={(e) => setFiltroPerfil(e.target.value)}
          >
            <option value="">Todos os perfis</option>
            {Object.entries(NOME_PERFIL).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>

        {carregando && <p className="gestao-aviso">Carregando usuários...</p>}
        {!carregando && lista.length === 0 && (
          <p className="gestao-aviso">Nenhum usuário encontrado.</p>
        )}

        {!carregando && lista.length > 0 && (
          <div className="gestao-tabela-caixa">
            <table className="gestao-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>CPF</th>
                  <th>Telefone</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td className="suave">{u.email}</td>
                    <td>{mascaraCpf(u.cpf)}</td>
                    <td>{mascaraTelefone(u.phone)}</td>
                    <td>{NOME_PERFIL[u.role] || u.role}</td>
                    <td>
                      <span
                        className={`gestao-status ${u.is_active ? "aprovada" : "cancelada"}`}
                      >
                        {u.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className="gestao-acoes">
                        <button
                          type="button"
                          className="gestao-acao cancelar"
                          onClick={() => editar(u)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={
                            u.is_active
                              ? "gestao-acao recusar"
                              : "gestao-acao aprovar"
                          }
                          disabled={String(u.id) === meuId}
                          title={
                            String(u.id) === meuId
                              ? "Você não pode inativar a própria conta"
                              : undefined
                          }
                          onClick={() => alternarAtivo(u)}
                        >
                          {u.is_active ? "Inativar" : "Reativar"}
                        </button>
                      </div>
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

export default Usuarios;
