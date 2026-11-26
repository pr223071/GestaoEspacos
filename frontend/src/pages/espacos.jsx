import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Pencil, X, Trash2 } from "lucide-react";
import "../css/espacos.css";
import { fotoDoEspaco } from "../utils/fotosEspacos";

// Constantes e funcoes auxiliares usadas pela tela.
const API_URL = "http://localhost:3080";
const NOMES_TIPO = {
  sala: "Sala de reunião",
  coworking: "Coworking",
  laboratorio: "Laboratório",
  auditorio: "Auditório",
  LAB: "Laboratório",
  COWORKING: "Coworking",
  MEETING_ROOM: "Sala de reunião",
};
const OPCOES_CAPACIDADE = [2, 5, 10, 20];
const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const HORARIOS_VAZIOS = DIAS.map((_, day_of_week) => ({
  day_of_week,
  enabled: false,
  start_time: "08:00",
  end_time: "18:00",
  is_external_allowed: true,
}));
const NOVO_ESPACO = {
  name: "",
  type: "MEETING_ROOM",
  capacity: "1",
  description: "",
  terms_of_use: "",
  buffer_minutes: "0",
  equipment: [],
  availability: HORARIOS_VAZIOS,
};

function mostrarNomeDoTipo(tipo) {
  return NOMES_TIPO[tipo] || tipo;
}
function lerToken() {
  return localStorage.getItem("token");
}
function criarCabecalhos(json = true) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${lerToken()}`,
  };
}

// Tela de consulta, cadastro e edicao dos espacos.
function Espacos() {
  const navigate = useNavigate();
  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}");
    } catch {
      return {};
    }
  }, []);
  const podeGerenciar = String(usuario.role || "").toUpperCase() === "ADMIN";
  const [espacos, setEspacos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [capacidadeMin, setCapacidadeMin] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const [espacoEditando, setEspacoEditando] = useState(null);
  const [form, setForm] = useState(NOVO_ESPACO);

  // Carrega a lista de espacos ativos da API.
  const carregarEspacos = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const response = await fetch(`${API_URL}/spaces/status/true`, {
        headers: criarCabecalhos(false),
      });
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        navigate("/login");
        return;
      }
      if (response.status === 404) {
        setEspacos([]);
        return;
      }
      if (!response.ok)
        throw new Error("Não foi possível carregar os espaços.");
      setEspacos(await response.json());
    } catch (e) {
      setErro(e.message || "Não foi possível conectar ao servidor.");
    } finally {
      setCarregando(false);
    }
  }, [navigate]);

  useEffect(() => {
    carregarEspacos();
  }, [carregarEspacos]);

  // Opcoes e lista filtrada para a exibicao.
  const tipos = [...new Set(espacos.map((espaco) => espaco.type))];
  const espacosFiltrados = espacos.filter((espaco) => {
    const bateNome = espaco.name.toLowerCase().includes(busca.toLowerCase());
    return (
      bateNome &&
      (tipo === "" || espaco.type === tipo) &&
      (capacidadeMin === "" || espaco.capacity >= Number(capacidadeMin))
    );
  });

  function abrirCadastro() {
    setEspacoEditando(null);
    setForm({ ...NOVO_ESPACO, equipment: [], availability: HORARIOS_VAZIOS });
    setErroModal("");
    setModalAberto(true);
  }

  async function abrirEdicao(espaco) {
    setEspacoEditando(espaco);
    setErroModal("");
    setForm({
      ...NOVO_ESPACO,
      ...espaco,
      capacity: String(espaco.capacity),
      buffer_minutes: String(espaco.buffer_minutes ?? 0),
      equipment: [],
    });
    setModalAberto(true);
    try {
      const response = await fetch(`${API_URL}/spaces/${espaco.id}/equipment`, {
        headers: criarCabecalhos(false),
      });
      if (response.ok) {
        const equipamentos = await response.json();
        setForm((atual) => ({ ...atual, equipment: equipamentos }));
      }
      const horariosResponse = await fetch(
        `${API_URL}/spaces/${espaco.id}/availability`,
        { headers: criarCabecalhos(false) },
      );
      if (horariosResponse.ok) {
        const horarios = await horariosResponse.json();
        setForm((atual) => ({
          ...atual,
          availability: HORARIOS_VAZIOS.map((dia) => {
            const cadastrado = horarios.find(
              (h) => Number(h.day_of_week) === dia.day_of_week,
            );
            return cadastrado
              ? {
                  ...dia,
                  ...cadastrado,
                  enabled: true,
                  start_time: String(cadastrado.start_time).slice(0, 5),
                  end_time: String(cadastrado.end_time).slice(0, 5),
                }
              : dia;
          }),
        }));
      }
    } catch {
      /* o formulário continua utilizável mesmo se a lista falhar */
    }
  }

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }
  function atualizarHorario(day, campo, valor) {
    setForm((atual) => ({
      ...atual,
      availability: atual.availability.map((h) =>
        h.day_of_week === day ? { ...h, [campo]: valor } : h,
      ),
    }));
  }
  function atualizarEquipamento(index, campo, valor) {
    setForm((atual) => ({
      ...atual,
      equipment: atual.equipment.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item,
      ),
    }));
  }
  function adicionarEquipamento() {
    setForm((atual) => ({
      ...atual,
      equipment: [
        ...atual.equipment,
        { name: "", description: "", quantity: "1" },
      ],
    }));
  }
  function removerEquipamento(index) {
    setForm((atual) => ({
      ...atual,
      equipment: atual.equipment.filter((_, i) => i !== index),
    }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErroModal("");
    if (!form.name.trim()) return setErroModal("Informe o nome do espaço.");
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1)
      return setErroModal("A capacidade deve ser um número maior que zero.");
    const horariosAtivos = form.availability.filter((h) => h.enabled);
    for (const h of horariosAtivos) {
      if (!h.start_time || !h.end_time || h.end_time <= h.start_time)
        return setErroModal(
          `Confira os horários de ${DIAS[h.day_of_week]}. O fim precisa ser depois do início.`,
        );
    }
    const equipamentos = form.equipment
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        description: item.description || null,
        quantity: Math.max(0, Number(item.quantity) || 0),
      }));
    if (form.equipment.some((item) => !item.name.trim()))
      return setErroModal(
        "Preencha o nome de cada equipamento ou remova a linha vazia.",
      );
    setSalvando(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        capacity: Number(form.capacity),
        description: form.description || null,
        terms_of_use: form.terms_of_use || null,
        buffer_minutes: Number(form.buffer_minutes) || 0,
      };
      const url = espacoEditando
        ? `${API_URL}/spaces/update/${espacoEditando.id}`
        : `${API_URL}/spaces`;
      const response = await fetch(url, {
        method: espacoEditando ? "PUT" : "POST",
        headers: criarCabecalhos(),
        body: JSON.stringify(payload),
      });
      const dados = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          dados.erro || dados.error || "Não foi possível salvar o espaço.",
        );
      const id = espacoEditando?.id || dados.id;
      if (id) {
        const horariosResponse = await fetch(
          `${API_URL}/spaces/${id}/availability`,
          {
            method: "PUT",
            headers: criarCabecalhos(),
            body: JSON.stringify({
              availability: horariosAtivos.map(
                ({
                  day_of_week,
                  start_time,
                  end_time,
                  is_external_allowed,
                }) => ({
                  day_of_week,
                  start_time,
                  end_time,
                  is_external_allowed,
                }),
              ),
            }),
          },
        );
        const horariosDados = await horariosResponse.json().catch(() => ({}));
        if (!horariosResponse.ok)
          throw new Error(
            horariosDados.erro || "Não foi possível salvar os horários.",
          );
      }
      if (id && (equipamentos.length || espacoEditando)) {
        const eqResponse = await fetch(`${API_URL}/spaces/${id}/equipment`, {
          method: "PUT",
          headers: criarCabecalhos(),
          body: JSON.stringify({ equipment: equipamentos }),
        });
        const eqDados = await eqResponse.json().catch(() => ({}));
        if (!eqResponse.ok)
          throw new Error(
            eqDados.erro ||
              eqDados.error ||
              "Espaço salvo, mas houve um erro ao salvar os equipamentos.",
          );
      }
      setModalAberto(false);
      await carregarEspacos();
    } catch (e2) {
      setErroModal(e2.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function reservar(espaco) {
    navigate(`/reservas/nova/${espaco.id}`);
  }

  return (
    <main className="espacos">
      <div className="espacos-cabecalho">
        <div>
          <h1>Espaços disponíveis</h1>
          <p>Consulte os espaços e suas informações.</p>
        </div>
        {podeGerenciar && (
          <button className="espacos-novo" onClick={abrirCadastro}>
            <Plus size={17} /> Cadastrar espaço
          </button>
        )}
      </div>
      <div className="espacos-filtros">
        <div className="espacos-busca">
          <Search size={16} />
          <input
            type="search"
            placeholder="Buscar por nome..."
            aria-label="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select
          aria-label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {mostrarNomeDoTipo(t)}
            </option>
          ))}
        </select>
        <select
          aria-label="Capacidade"
          value={capacidadeMin}
          onChange={(e) => setCapacidadeMin(e.target.value)}
        >
          <option value="">Qualquer capacidade</option>
          {OPCOES_CAPACIDADE.map((n) => (
            <option key={n} value={n}>
              {n}+ pessoas
            </option>
          ))}
        </select>
      </div>
      {carregando && <p className="espacos-aviso">Carregando espaços...</p>}
      {erro && (
        <p className="espacos-aviso erro" role="alert">
          {erro}
        </p>
      )}
      {!carregando && !erro && espacosFiltrados.length === 0 && (
        <p className="espacos-aviso">Nenhum espaço encontrado.</p>
      )}
      <section className="espacos-grade">
        {espacosFiltrados.map((espaco) => (
          <article key={espaco.id} className="espaco-card">
            <div className="espaco-foto">
              {fotoDoEspaco(espaco.name, espaco.type) && (
                <img
                  src={fotoDoEspaco(espaco.name, espaco.type)}
                  alt={espaco.name}
                  loading="lazy"
                />
              )}
            </div>
            <div className="espaco-info">
              <h2>{espaco.name}</h2>
              <p>Tipo: {mostrarNomeDoTipo(espaco.type)}</p>
              <p>Capacidade: {espaco.capacity} pessoas</p>
              {espaco.description && <p>{espaco.description}</p>}
              <div className="espaco-acoes">
                {podeGerenciar && (
                  <button
                    className="espaco-botao secundario"
                    onClick={() => abrirEdicao(espaco)}
                  >
                    <Pencil size={15} /> Editar
                  </button>
                )}
                <button
                  className="espaco-botao"
                  onClick={() => reservar(espaco)}
                >
                  Reservar
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {modalAberto && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !salvando)
              setModalAberto(false);
          }}
        >
          <section
            className="espaco-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-espaco-titulo"
          >
            <header className="modal-cabecalho">
              <div>
                <h2 id="modal-espaco-titulo">
                  {espacoEditando ? "Editar espaço" : "Cadastrar espaço"}
                </h2>
                <p>Preencha os dados e vincule os equipamentos disponíveis.</p>
              </div>
              <button
                type="button"
                className="modal-fechar"
                aria-label="Fechar"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
              >
                <X size={20} />
              </button>
            </header>
            <form onSubmit={salvar}>
              <div className="modal-corpo">
                <div className="form-grid">
                  <label>
                    Nome do espaço
                    <input
                      required
                      maxLength={120}
                      value={form.name}
                      onChange={(e) => atualizarCampo("name", e.target.value)}
                      placeholder="Ex.: Sala de reunião 1"
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={form.type}
                      onChange={(e) => atualizarCampo("type", e.target.value)}
                    >
                      <option value="MEETING_ROOM">Sala de reunião</option>
                      <option value="COWORKING">Coworking</option>
                      <option value="LAB">Laboratório</option>
                    </select>
                  </label>
                  <label>
                    Capacidade
                    <input
                      required
                      type="number"
                      min="1"
                      value={form.capacity}
                      onChange={(e) =>
                        atualizarCampo("capacity", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Intervalo entre reservas (min)
                    <input
                      type="number"
                      min="0"
                      max="240"
                      value={form.buffer_minutes}
                      onChange={(e) =>
                        atualizarCampo("buffer_minutes", e.target.value)
                      }
                    />
                  </label>
                  <label className="form-largo">
                    Descrição
                    <textarea
                      rows="2"
                      value={form.description || ""}
                      onChange={(e) =>
                        atualizarCampo("description", e.target.value)
                      }
                      placeholder="Descreva o espaço"
                    />
                  </label>
                  <label className="form-largo">
                    Termos de uso
                    <textarea
                      rows="2"
                      value={form.terms_of_use || ""}
                      onChange={(e) =>
                        atualizarCampo("terms_of_use", e.target.value)
                      }
                      placeholder="Regras e orientações de uso"
                    />
                  </label>
                </div>
                <div className="equipamentos-cabecalho">
                  <div>
                    <h3>Horários de funcionamento</h3>
                    <p>Marque os dias em que o espaço poderá ser reservado.</p>
                  </div>
                </div>
                <div className="horarios-lista">
                  {form.availability.map((h) => (
                    <div className="horario-linha" key={h.day_of_week}>
                      <label className="horario-dia">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) =>
                            atualizarHorario(
                              h.day_of_week,
                              "enabled",
                              e.target.checked,
                            )
                          }
                        />
                        {DIAS[h.day_of_week]}
                      </label>
                      <label>
                        Início
                        <input
                          type="time"
                          value={h.start_time}
                          disabled={!h.enabled}
                          onChange={(e) =>
                            atualizarHorario(
                              h.day_of_week,
                              "start_time",
                              e.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Fim
                        <input
                          type="time"
                          value={h.end_time}
                          disabled={!h.enabled}
                          onChange={(e) =>
                            atualizarHorario(
                              h.day_of_week,
                              "end_time",
                              e.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="horario-externo">
                        <input
                          type="checkbox"
                          checked={h.is_external_allowed}
                          disabled={!h.enabled}
                          onChange={(e) =>
                            atualizarHorario(
                              h.day_of_week,
                              "is_external_allowed",
                              e.target.checked,
                            )
                          }
                        />
                        Permitir reservas externas
                      </label>
                    </div>
                  ))}
                </div>
                <div className="equipamentos-cabecalho">
                  <div>
                    <h3>Equipamentos</h3>
                    <p>
                      Adicione os equipamentos que fazem parte deste espaço.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="equipamento-adicionar"
                    onClick={adicionarEquipamento}
                  >
                    <Plus size={15} /> Adicionar
                  </button>
                </div>
                {form.equipment.length === 0 && (
                  <p className="equipamentos-vazio">
                    Nenhum equipamento adicionado.
                  </p>
                )}
                {form.equipment.map((item, index) => (
                  <div className="equipamento-linha" key={item.id || index}>
                    <label>
                      Nome
                      <input
                        value={item.name}
                        onChange={(e) =>
                          atualizarEquipamento(index, "name", e.target.value)
                        }
                        placeholder="Ex.: Projetor"
                      />
                    </label>
                    <label>
                      Quantidade
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) =>
                          atualizarEquipamento(
                            index,
                            "quantity",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="equipamento-desc">
                      Descrição
                      <input
                        value={item.description || ""}
                        onChange={(e) =>
                          atualizarEquipamento(
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                        placeholder="Opcional"
                      />
                    </label>
                    <button
                      type="button"
                      className="equipamento-remover"
                      aria-label="Remover equipamento"
                      onClick={() => removerEquipamento(index)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                {erroModal && (
                  <p className="modal-erro" role="alert">
                    {erroModal}
                  </p>
                )}
              </div>
              <footer className="modal-rodape">
                <button
                  type="button"
                  className="modal-cancelar"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="modal-salvar"
                  disabled={salvando}
                >
                  {salvando
                    ? "Salvando..."
                    : espacoEditando
                      ? "Salvar alterações"
                      : "Cadastrar espaço"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Espacos;
