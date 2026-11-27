import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { mascaraCpf, mascaraTelefone, soNumeros } from "../utils/mascaras";
import "../css/perfil.css";

const API_URL = "http://localhost:3080";

const NOME_ROLE = {
  ADMIN: "Administrador",
  CLIENT: "Cliente",
  RECEPTION: "Recepção",
};

function cabecalhos() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

// card do próprio usuário: ver dados, alterar e excluir a conta
// onAtualizado: avisa o Layout para trocar o nome no topo
function PerfilCard({ onFechar, onAtualizado }) {
  const navigate = useNavigate();
  const [modo, setModo] = useState("ver"); // ver | editar | excluir
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState({});
  const [senhaExcluir, setSenhaExcluir] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function sairDaConta() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  }

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch(`${API_URL}/perfil`, { headers: cabecalhos() });
        if (res.status === 401) return sairDaConta();
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.erro || "Não foi possível carregar seu perfil");
        setPerfil(dados);
      } catch (e) {
        setErro(e.message || "Não foi possível conectar ao servidor");
      }
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fecha com Esc
  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  function abrirEdicao() {
    setForm({
      name: perfil.name || "",
      email: perfil.email || "",
      cpf: mascaraCpf(perfil.cpf || ""),
      phone: mascaraTelefone(perfil.phone || ""),
      password: "",
      senha_atual: "",
    });
    setErro("");
    setModo("editar");
  }

  function alterar(e) {
    const { name, value } = e.target;
    let valor = value;
    if (name === "cpf") valor = mascaraCpf(value);
    if (name === "phone") valor = mascaraTelefone(value);
    setForm({ ...form, [name]: valor });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");

    if (soNumeros(form.cpf).length !== 11) return setErro("CPF inválido: deve ter 11 números");
    const tel = soNumeros(form.phone).length;
    if (tel !== 10 && tel !== 11) return setErro("Telefone inválido: informe o DDD + número");
    if (form.password && form.password.length < 6) return setErro("A nova senha deve ter pelo menos 6 caracteres");
    if (form.password && !form.senha_atual) return setErro("Informe a senha atual para trocar a senha");

    const corpo = {
      name: form.name,
      email: form.email,
      cpf: soNumeros(form.cpf),
      phone: soNumeros(form.phone),
    };
    if (form.password) {
      corpo.password = form.password;
      corpo.senha_atual = form.senha_atual;
    }

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/perfil`, {
        method: "PUT",
        headers: cabecalhos(),
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro || "Não foi possível salvar");

      setPerfil(dados);
      const salvo = JSON.parse(localStorage.getItem("usuario") || "{}");
      const novo = { ...salvo, name: dados.name, email: dados.email };
      localStorage.setItem("usuario", JSON.stringify(novo));
      onAtualizado(novo);
      setModo("ver");
    } catch (e) {
      setErro(e.message || "Não foi possível conectar ao servidor");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(e) {
    e.preventDefault();
    setErro("");
    if (!senhaExcluir) return setErro("Digite sua senha para confirmar");

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/perfil`, {
        method: "DELETE",
        headers: cabecalhos(),
        body: JSON.stringify({ senha: senhaExcluir }),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro || "Não foi possível excluir a conta");
      sairDaConta();
    } catch (e) {
      setErro(e.message || "Não foi possível conectar ao servidor");
      setSalvando(false);
    }
  }

  const iniciais = (perfil?.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <div className="modal-overlay perfil-overlay" onMouseDown={onFechar}>
      <div
        className="perfil-card"
        role="dialog"
        aria-modal="true"
        aria-label="Meu perfil"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="perfil-fechar" onClick={onFechar} aria-label="Fechar">
          <X size={16} />
        </button>

        <div className="perfil-topo">
          <span className="perfil-avatar">{iniciais}</span>
          <div>
            <h2>{perfil ? perfil.name : "Carregando..."}</h2>
            {perfil && <span>{NOME_ROLE[String(perfil.role).toUpperCase()] || perfil.role}</span>}
          </div>
        </div>

        {modo === "ver" && perfil && (
          <>
            <dl className="perfil-dados">
              <div><dt>E-mail</dt><dd>{perfil.email}</dd></div>
              <div><dt>CPF</dt><dd>{perfil.cpf ? mascaraCpf(perfil.cpf) : "—"}</dd></div>
              <div><dt>Telefone</dt><dd>{perfil.phone ? mascaraTelefone(perfil.phone) : "—"}</dd></div>
              <div>
                <dt>Cliente desde</dt>
                <dd>{perfil.created_at ? new Date(perfil.created_at).toLocaleDateString("pt-BR") : "—"}</dd>
              </div>
            </dl>

            {String(perfil.role).toUpperCase() === "RECEPTION" ? (
              <p className="perfil-info">Perfil de funcionário: para alterar seus dados, fale com o administrador.</p>
            ) : (
            <div className="perfil-acoes">
              <button type="button" className="perfil-botao" onClick={abrirEdicao}>
                <Pencil size={15} /> Alterar dados
              </button>
              <button
                type="button"
                className="perfil-botao perigo"
                onClick={() => { setErro(""); setSenhaExcluir(""); setModo("excluir"); }}
              >
                <Trash2 size={15} /> Excluir conta
              </button>
            </div>
            )}
          </>
        )}

        {modo === "editar" && (
          <form className="perfil-form" onSubmit={salvar}>
            <label>
              Nome
              <input name="name" value={form.name} onChange={alterar} required />
            </label>
            <label>
              E-mail
              <input name="email" type="email" value={form.email} onChange={alterar} required />
            </label>
            <div className="perfil-linha">
              <label>
                CPF
                <input name="cpf" inputMode="numeric" maxLength={14} placeholder="000.000.000-00"
                  value={form.cpf} onChange={alterar} required />
              </label>
              <label>
                Telefone
                <input name="phone" type="tel" inputMode="numeric" maxLength={15} placeholder="(48) 99999-9999"
                  value={form.phone} onChange={alterar} required />
              </label>
            </div>
            <div className="perfil-linha">
              <label>
                Nova senha
                <input name="password" type={mostrarSenha ? "text" : "password"} placeholder="Deixe vazio para manter"
                  autoComplete="new-password" value={form.password} onChange={alterar} />
              </label>
              <label>
                Senha atual
                <input name="senha_atual" type={mostrarSenha ? "text" : "password"} placeholder="Só se for trocar"
                  autoComplete="current-password" value={form.senha_atual} onChange={alterar} />
              </label>
            </div>
            <button type="button" className="perfil-mostrar" onClick={() => setMostrarSenha(!mostrarSenha)}>
              {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
              {mostrarSenha ? "Esconder senhas" : "Mostrar senhas"}
            </button>

            {erro && <p className="perfil-erro" role="alert">{erro}</p>}

            <div className="perfil-acoes">
              <button type="button" className="perfil-botao secundario" onClick={() => { setErro(""); setModo("ver"); }} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className="perfil-botao" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}

        {modo === "excluir" && (
          <form className="perfil-form" onSubmit={excluir}>
            <p className="perfil-aviso">
              Tem certeza? Sua conta e todo o seu histórico de reservas serão apagados de vez.
              Se tiver reservas ativas, cancele-as antes.
            </p>
            <label>
              Digite sua senha para confirmar
              <input type="password" autoComplete="current-password" value={senhaExcluir}
                onChange={(e) => setSenhaExcluir(e.target.value)} autoFocus />
            </label>

            {erro && <p className="perfil-erro" role="alert">{erro}</p>}

            <div className="perfil-acoes">
              <button type="button" className="perfil-botao secundario" onClick={() => { setErro(""); setModo("ver"); }} disabled={salvando}>
                Voltar
              </button>
              <button type="submit" className="perfil-botao perigo-cheio" disabled={salvando}>
                {salvando ? "Excluindo..." : "Excluir minha conta"}
              </button>
            </div>
          </form>
        )}

        {modo === "ver" && !perfil && erro && <p className="perfil-erro" role="alert">{erro}</p>}
      </div>
    </div>
  );
}

export default PerfilCard;
