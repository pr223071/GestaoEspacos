// ===========================================================
// Gestão de Espaços - front-end
// Tudo que aparece na tela é desenhado por este arquivo a
// partir dos dados da API. O que muda de uma entidade para
// outra (rota, campos do formulário, colunas...) fica na
// configuração ENTIDADES.
// ===========================================================


// ================== CONFIGURAÇÃO ==================

const API = "http://localhost:3080";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // semana começando na segunda
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const TIPOS = { COWORKING: "Coworking", LAB: "Laboratório", MEETING_ROOM: "Sala de reunião", AUDITORIUM: "Auditório" };
const STATUS = {
    PENDING: { texto: "Pendente", cor: "warning" },
    APPROVED: { texto: "Aprovada", cor: "success" },
    REJECTED: { texto: "Rejeitada", cor: "danger" },
    CANCELLED: { texto: "Cancelada", cor: "" }
};
const PERFIS = {
    ADMIN: { texto: "Administrador", cor: "primary" },
    RECEPTION: { texto: "Recepção", cor: "warning" },
    CLIENT: { texto: "Cliente", cor: "" }
};
const ROTULO_BUSCA = { nome: "Nome", id: "ID", data: "Data" };

// ícones (desenhos SVG) usados na tela
const ICONES = {
    inicio: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
    reservas: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    espacos: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    disponiveis: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    empresas: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10"/><path d="M3 21h18M8 7h4M8 11h4M8 15h4"/>',
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    offline: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.55a11 11 0 0 1 5.17-2.39M19 12.55a11 11 0 0 0-2.1-1.37M1.42 9a16 16 0 0 1 4.7-2.88M22.58 9A16 16 0 0 0 10.7 5.07M12 20h.01"/>',
    COWORKING: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
    LAB: '<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
    MEETING_ROOM: '<path d="M3 4h18M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4M12 16v5M8 21h8"/>',
    AUDITORIUM: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',
    OUTRO: '<rect x="3" y="3" width="18" height="18" rx="2"/>'
};

function icone(nome) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome] || ICONES.OUTRO}</svg>`;
}


// Configuração de cada entidade:
//  rota         -> endereço na API
//  busca        -> tipos de busca que a API oferece (/rota/:id, /rota/nome/:nome, /rota/data/:data)
//  relacionadas -> outras tabelas que precisam estar carregadas (para mostrar nomes em vez de ids)
//  campos       -> campos do formulário
//  visual       -> "tabela", "cards" ou "semana"
const ENTIDADES = {
    reservas: {
        rota: "/reservations",
        titulo: "Reservas",
        subtitulo: "Acompanhe, aprove ou rejeite as reservas dos espaços",
        singular: "reserva", plural: "reservas", novo: "Nova reserva", feminino: true,
        busca: ["id", "data"],
        camposData: ["start_datetime"],
        relacionadas: ["usuarios", "espacos", "disponiveis", "empresas"],
        filtro: {
            campo: "status",
            opcoes: [["PENDING", "Pendentes"], ["APPROVED", "Aprovadas"], ["REJECTED", "Rejeitadas"], ["CANCELLED", "Canceladas"]]
        },
        ordenar: (a, b) => String(b.start_datetime).localeCompare(String(a.start_datetime)),
        nome: r => `Reserva #${r.id}`,
        visual: "tabela",
        colunas: [
            { titulo: "Espaço", html: r => espacoResumo(r.space_id) },
            { titulo: "Cliente", html: r => pessoaHTML(nomeDe("usuarios", r.user_id), empresaDoUsuario(r.user_id)) },
            { titulo: "Quando", html: r => `<div class="person-text"><strong>${dataCurta(r.start_datetime)}</strong><span class="mono">${hora(r.start_datetime)} – ${hora(r.end_datetime)}</span></div>` },
            { titulo: "Status", html: r => statusBadge(r) }
        ],
        acoesLinha: r => r.status === "PENDING" ? botoesAprovacao(r, true) : "",
        campos: [
            { nome: "space_id", rotulo: "Espaço", tipo: "select", opcoesDe: "espacos", obrigatorio: true },
            { nome: "user_id", rotulo: "Cliente", tipo: "select", opcoesDe: "usuarios", obrigatorio: true },
            { nome: "start_datetime", rotulo: "Início", tipo: "datetime-local", obrigatorio: true, meio: true },
            { nome: "end_datetime", rotulo: "Fim", tipo: "datetime-local", obrigatorio: true, meio: true },
            {
                nome: "status", rotulo: "Status", tipo: "opcoes", padrao: "PENDING",
                opcoes: Object.entries(STATUS).map(([valor, s]) => [valor, s.texto])
            },
            {
                nome: "rejection_reason", rotulo: "Motivo da rejeição", tipo: "textarea",
                placeholder: "Explique ao cliente por que a reserva foi rejeitada",
                mostrarSe: v => v.status === "REJECTED", obrigatorio: true
            }
        ],
        dica: dicaReserva
    },

    disponiveis: {
        rota: "/availability",
        titulo: "Disponibilidade",
        subtitulo: "Horários da semana em que cada espaço pode ser reservado",
        singular: "horário", plural: "horários", novo: "Novo horário",
        busca: ["id", "data"],
        relacionadas: ["espacos"],
        filtroEspaco: true,
        ordenar: (a, b) => String(a.start_time).localeCompare(String(b.start_time)),
        nome: d => `${DIAS[d.day_of_week]} ${d.start_time}–${d.end_time}`,
        visual: "semana",
        campos: [
            { nome: "space_id", rotulo: "Espaço", tipo: "select", opcoesDe: "espacos", obrigatorio: true },
            {
                nome: "day_of_week", rotulo: "Dia da semana", tipo: "opcoes", numero: true, obrigatorio: true,
                opcoes: ORDEM_SEMANA.map(d => [d, DIAS_CURTOS[d]])
            },
            { nome: "start_time", rotulo: "Abre às", tipo: "time", obrigatorio: true, meio: true },
            { nome: "end_time", rotulo: "Fecha às", tipo: "time", obrigatorio: true, meio: true },
            {
                nome: "is_external_allowed", rotulo: "Público externo", tipo: "switch",
                descricao: "Pessoas de fora podem reservar nesse horário"
            }
        ]
    },

    espacos: {
        rota: "/spaces",
        titulo: "Espaços",
        subtitulo: "Salas, laboratórios e ambientes disponíveis para reserva",
        singular: "espaço", plural: "espaços", novo: "Novo espaço",
        busca: ["nome", "id"],
        relacionadas: ["disponiveis", "reservas"],
        filtro: { campo: "type", opcoes: Object.entries(TIPOS) },
        ordenar: (a, b) => (b.is_active !== false) - (a.is_active !== false) || String(a.name).localeCompare(String(b.name)),
        nome: e => e.name,
        visual: "cards",
        campos: [
            { nome: "name", rotulo: "Nome do espaço", tipo: "text", obrigatorio: true, placeholder: "Ex: Sala de Reunião 02" },
            { nome: "type", rotulo: "Tipo", tipo: "opcoes", padrao: "COWORKING", opcoes: Object.entries(TIPOS) },
            { nome: "capacity", rotulo: "Capacidade (pessoas)", tipo: "number", min: 1, placeholder: "Ex: 20", meio: true },
            { nome: "description", rotulo: "Descrição", tipo: "textarea", placeholder: "Equipamentos, recursos, observações..." },
            { nome: "is_active", rotulo: "Espaço ativo", tipo: "switch", padrao: true, descricao: "Espaços inativos não aparecem para novas reservas" }
        ]
    },

    empresas: {
        rota: "/empresas",
        titulo: "Empresas",
        subtitulo: "Empresas parceiras que utilizam os espaços",
        singular: "empresa", plural: "empresas", novo: "Nova empresa", feminino: true,
        busca: ["nome", "id", "data"],
        camposData: ["created_at"],
        relacionadas: ["usuarios"],
        ordenar: (a, b) => a.id - b.id,
        nome: e => e.name,
        visual: "tabela",
        colunas: [
            { titulo: "Empresa", html: e => pessoaHTML(e.name, e.email || "Sem e-mail", true) },
            { titulo: "CNPJ", html: e => esc(e.cnpj), classe: "mono muted" },
            { titulo: "Telefone", html: e => esc(e.phone || "—"), classe: "muted hide-sm" },
            { titulo: "Usuários", html: e => contagemUsuarios(e.id), classe: "hide-sm" },
            { titulo: "Cadastro", html: e => dataCurta(e.created_at), classe: "muted hide-sm" }
        ],
        avisoExcluir: e => {
            const n = lista("usuarios").filter(u => u.company_id === e.id).length;
            return n ? ` Atenção: ${n} ${n === 1 ? "usuário está vinculado" : "usuários estão vinculados"} a ela.` : "";
        },
        campos: [
            { nome: "name", rotulo: "Nome da empresa", tipo: "text", obrigatorio: true, placeholder: "Ex: Acme Tecnologia Ltda" },
            { nome: "cnpj", rotulo: "CNPJ", tipo: "text", obrigatorio: true, mascara: "cnpj", placeholder: "00.000.000/0000-00", meio: true },
            { nome: "phone", rotulo: "Telefone", tipo: "tel", mascara: "telefone", placeholder: "(48) 90000-0000", meio: true },
            { nome: "email", rotulo: "E-mail de contato", tipo: "email", placeholder: "contato@empresa.com" }
        ]
    },

    usuarios: {
        rota: "/clients",
        titulo: "Usuários",
        subtitulo: "Pessoas com acesso ao sistema de reservas",
        singular: "usuário", plural: "usuários", novo: "Novo usuário",
        busca: ["nome", "id", "data"],
        camposData: ["created_at"],
        relacionadas: ["empresas"],
        filtro: { campo: "role", opcoes: Object.entries(PERFIS).map(([valor, p]) => [valor, p.texto]) },
        ordenar: (a, b) => a.id - b.id,
        nome: u => u.name,
        visual: "tabela",
        colunas: [
            { titulo: "Usuário", html: u => pessoaHTML(u.name, u.email) },
            { titulo: "Perfil", html: u => badge(PERFIS[u.role]?.texto || u.role || "—", PERFIS[u.role]?.cor) },
            { titulo: "Empresa", html: u => u.company_id ? esc(nomeDe("empresas", u.company_id)) : '<span class="muted">—</span>' },
            { titulo: "CPF / CNPJ", html: u => esc(u.cpf_cnpj || "—"), classe: "mono muted hide-sm" }
        ],
        campos: [
            { nome: "name", rotulo: "Nome completo", tipo: "text", obrigatorio: true, placeholder: "Ex: Maria da Silva" },
            { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true, placeholder: "maria@empresa.com" },
            { nome: "password", rotulo: "Senha", tipo: "password", meio: true, ajudaEdicao: "Deixe em branco para manter a atual" },
            { nome: "cpf_cnpj", rotulo: "CPF / CNPJ", tipo: "text", mascara: "cpfcnpj", placeholder: "000.000.000-00", meio: true },
            { nome: "role", rotulo: "Perfil de acesso", tipo: "opcoes", padrao: "CLIENT", opcoes: Object.entries(PERFIS).map(([valor, p]) => [valor, p.texto]) },
            { nome: "company_id", rotulo: "Empresa", tipo: "select", opcoesDe: "empresas", vazio: "Nenhuma (pessoa física / interno)" }
        ]
    }
};

// menu lateral
const MENU = [
    { pagina: "inicio", rotulo: "Início" },
    { secao: "Operação" },
    { pagina: "reservas", rotulo: "Reservas" },
    { pagina: "disponiveis", rotulo: "Disponibilidade" },
    { pagina: "espacos", rotulo: "Espaços" },
    { secao: "Cadastros" },
    { pagina: "empresas", rotulo: "Empresas" },
    { pagina: "usuarios", rotulo: "Usuários" }
];


// ================== ESTADO DA TELA ==================

const cache = {};  // última lista recebida da API de cada entidade (null = não carregou)
const erros = {};  // último erro ao carregar cada entidade
const estado = {}; // busca e filtros de cada página
Object.keys(ENTIDADES).forEach(ent => {
    estado[ent] = { busca: "", modo: ENTIDADES[ent].busca[0], filtro: "todos", espaco: "", resultado: null, info: "" };
});

const $ = seletor => document.querySelector(seletor);
const lista = ent => cache[ent] || [];


// ================== FUNÇÕES AUXILIARES ==================

// evita que um texto vindo da API seja interpretado como HTML
function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function nomeDe(ent, id) {
    const item = lista(ent).find(i => i.id === Number(id));
    return item ? item.name : `#${id}`;
}

function empresaDoUsuario(userId) {
    const usuario = lista("usuarios").find(u => u.id === Number(userId));
    if (!usuario) return "";
    return usuario.company_id ? nomeDe("empresas", usuario.company_id) : usuario.email;
}

// As datas da API estão como "2026-09-16T09:00:00Z" e são tratadas como horário local
function dataCurta(iso) {
    if (!iso) return "—";
    const [ano, mes, dia] = iso.slice(0, 10).split("-");
    return `${Number(dia)} ${MESES[Number(mes) - 1]} ${ano}`;
}
const hora = iso => (iso ? iso.slice(11, 16) : "--:--");
const diaDaSemana = data => new Date(data.slice(0, 10) + "T12:00:00Z").getUTCDay();

function agoraISO() {
    const d = new Date();
    const dois = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

function iniciais(nome) {
    return String(nome || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

// cada nome sempre ganha a mesma cor de avatar
const CORES = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0d9488", "#16a34a", "#4f46e5", "#0891b2"];
function corDe(texto) {
    let soma = 0;
    for (const c of String(texto)) soma = (soma * 31 + c.charCodeAt(0)) % 997;
    return CORES[soma % CORES.length];
}

function pessoaHTML(nome, detalhe, quadrado = false) {
    return `<div class="person">
        <span class="avatar ${quadrado ? "square" : ""}" style="background:${corDe(nome)}">${esc(iniciais(nome))}</span>
        <div class="person-text"><strong>${esc(nome)}</strong><span>${esc(detalhe || "")}</span></div>
    </div>`;
}

function espacoResumo(spaceId) {
    const espaco = lista("espacos").find(e => e.id === Number(spaceId));
    const tipo = espaco && TIPOS[espaco.type] ? espaco.type : "OUTRO";
    const detalhe = espaco ? `${TIPOS[espaco.type] || "Outro"}${espaco.capacity ? " · " + espaco.capacity + " pessoas" : ""}` : "";
    return `<div class="person">
        <span class="avatar square cover-${tipo}">${icone(tipo)}</span>
        <div class="person-text"><strong>${esc(espaco ? espaco.name : `Espaço #${spaceId}`)}</strong><span>${esc(detalhe)}</span></div>
    </div>`;
}

function badge(texto, cor = "") {
    return `<span class="badge ${cor ? "badge-" + cor : ""}">${esc(texto)}</span>`;
}

function statusBadge(reserva) {
    const s = STATUS[reserva.status] || { texto: reserva.status || "—", cor: "" };
    const titulo = reserva.rejection_reason ? ` title="${esc(reserva.rejection_reason)}"` : "";
    return `<span${titulo}>${badge(s.texto, s.cor)}</span>`;
}

function contagemUsuarios(empresaId) {
    if (!cache.usuarios) return '<span class="muted">—</span>';
    const n = cache.usuarios.filter(u => u.company_id === empresaId).length;
    return `<span class="badge plain">${n} ${n === 1 ? "usuário" : "usuários"}</span>`;
}

// compacto = só ícones (usado na tabela para não ocupar espaço)
function botoesAprovacao(r, compacto = false) {
    if (compacto) {
        return `<button type="button" class="icon-button success" data-acao="aprovar" data-ent="reservas" data-id="${r.id}" title="Aprovar" aria-label="Aprovar">${icone("check")}</button>
                <button type="button" class="icon-button danger" data-acao="rejeitar" data-ent="reservas" data-id="${r.id}" title="Rejeitar" aria-label="Rejeitar">${icone("x")}</button>
                <span class="divider"></span>`;
    }
    return `<button type="button" class="btn btn-sm btn-success-soft" data-acao="aprovar" data-ent="reservas" data-id="${r.id}">${icone("check")}Aprovar</button>
            <button type="button" class="btn btn-sm btn-danger-soft" data-acao="rejeitar" data-ent="reservas" data-id="${r.id}">${icone("x")}Rejeitar</button>`;
}

// máscaras de digitação
function mascara(valor, formato) {
    const numeros = valor.replace(/\D/g, "");
    let i = 0, saida = "";
    for (const c of formato) {
        if (i >= numeros.length) break;
        saida += c === "0" ? numeros[i++] : c;
    }
    return saida;
}
const MASCARAS = {
    cnpj: v => mascara(v, "00.000.000/0000-00"),
    telefone: v => mascara(v, v.replace(/\D/g, "").length > 10 ? "(00) 00000-0000" : "(00) 0000-0000"),
    cpfcnpj: v => mascara(v, v.replace(/\D/g, "").length > 11 ? "00.000.000/0000-00" : "000.000.000-00")
};


// ================== AVISOS E CONFIRMAÇÕES ==================

function aviso(titulo, texto = "", tipo = "success") {
    const el = document.createElement("div");
    el.className = `toast ${tipo}`;
    el.innerHTML = `<span class="toast-icon">${icone(tipo === "success" ? "check" : "alert")}</span>
        <div><strong>${esc(titulo)}</strong>${texto ? `<span>${esc(texto)}</span>` : ""}</div>`;
    $("#toasts").appendChild(el);
    setTimeout(() => {
        el.classList.add("leaving");
        el.addEventListener("animationend", () => el.remove());
    }, tipo === "error" ? 5500 : 3500);
}

// janela de confirmação; com "campo" ela também pede um texto (ex: motivo da rejeição)
let fecharModalAtual = null;
function dialogo({ titulo, texto, confirmar = "Confirmar", perigo = false, campo = null }) {
    return new Promise(resolve => {
        const modal = $("#modal"), input = $("#modalInput"), botao = $("#modalConfirm");
        $("#modalTitle").textContent = titulo;
        $("#modalText").textContent = texto;
        $("#modalIcon").className = `modal-icon ${perigo ? "" : "primary"}`;
        $("#modalIcon").innerHTML = icone(perigo ? "trash" : "info");
        botao.textContent = confirmar;
        botao.className = `btn ${perigo ? "btn-danger" : "btn-primary"}`;
        input.hidden = !campo;
        input.value = "";
        input.placeholder = campo || "";
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        setTimeout(() => (campo ? input : botao).focus(), 50);

        function fechar(resultado) {
            modal.classList.remove("open");
            modal.setAttribute("aria-hidden", "true");
            botao.onclick = $("#modalCancel").onclick = modal.onclick = null;
            fecharModalAtual = null;
            resolve(resultado);
        }
        botao.onclick = () => {
            if (campo && !input.value.trim()) return input.focus();
            fechar(campo ? input.value.trim() : true);
        };
        $("#modalCancel").onclick = () => fechar(null);
        modal.onclick = e => { if (e.target === modal) fechar(null); };
        fecharModalAtual = () => fechar(null);
    });
}


// ================== COMUNICAÇÃO COM A API ==================

async function requisicao(metodo, caminho, corpo) {
    let res;
    try {
        res = await fetch(API + caminho, {
            method: metodo,
            headers: corpo ? { "Content-Type": "application/json" } : {},
            body: corpo ? JSON.stringify(corpo) : undefined
        });
    } catch {
        const erro = new Error("Não foi possível conectar à API. Verifique se o servidor está rodando (npm start).");
        erro.offline = true;
        throw erro;
    }

    // rotas que não existem respondem a página 404.html (não é JSON)
    const ehJson = (res.headers.get("content-type") || "").includes("application/json");
    const dados = ehJson ? await res.json() : null;

    if (!res.ok) {
        const erro = new Error((dados && (dados.erro || dados.message)) ||
            (res.status === 404 ? `A rota ${metodo} ${caminho} não existe na API` : `A API respondeu com erro ${res.status}`));
        erro.status = res.status;
        erro.rotaInexistente = res.status === 404 && !ehJson;
        throw erro;
    }
    if (dados === null) throw new Error("A API não respondeu em JSON");
    return dados;
}

async function carregar(ent) {
    const dados = await requisicao("GET", ENTIDADES[ent].rota);
    cache[ent] = Array.isArray(dados) ? dados : [];
    erros[ent] = null;
    atualizarContadorMenu();
    return cache[ent];
}

// carrega sem estourar erro (usado para as tabelas relacionadas)
function carregarSilencioso(ent) {
    return carregar(ent).catch(erro => {
        erros[ent] = erro;
        cache[ent] = null;
    });
}

// sem id = registro novo (POST); com id = atualização (PUT)
function salvarNaApi(ent, corpo, id) {
    const rota = ENTIDADES[ent].rota;
    return id ? requisicao("PUT", `${rota}/${id}`, corpo) : requisicao("POST", rota, corpo);
}

async function verificarApi() {
    const status = $("#apiStatus");
    try {
        await requisicao("GET", "/empresas");
        status.className = "api-status online";
        status.querySelector(".label").textContent = "API online";
    } catch {
        status.className = "api-status offline";
        status.querySelector(".label").textContent = "API offline";
    }
}


// ================== NAVEGAÇÃO ==================

function paginaAtual() {
    const pagina = location.hash.replace("#", "");
    return pagina === "inicio" || ENTIDADES[pagina] ? pagina : "inicio";
}

function montarMenu() {
    $("#nav").innerHTML = MENU.map(item => item.secao
        ? `<div class="nav-section">${item.secao}</div>`
        : `<a href="#${item.pagina}" class="nav-link" data-pagina="${item.pagina}">
               ${icone(item.pagina)}<span>${item.rotulo}</span>
               ${item.pagina === "reservas" ? '<span class="count" id="pendentesCount" hidden></span>' : ""}
           </a>`
    ).join("");
}

// bolinha no menu com a quantidade de reservas pendentes
function atualizarContadorMenu() {
    const contador = $("#pendentesCount");
    if (!contador) return;
    const pendentes = lista("reservas").filter(r => r.status === "PENDING").length;
    contador.textContent = pendentes;
    contador.hidden = pendentes === 0;
}

function abrirMenu(abrir) {
    $("#sidebar").classList.toggle("open", abrir);
    $("#sidebarBackdrop").classList.toggle("open", abrir);
}

function mostrarPagina() {
    const pagina = paginaAtual();
    abrirMenu(false);
    document.querySelectorAll(".nav-link[data-pagina]").forEach(link => {
        link.classList.toggle("active", link.dataset.pagina === pagina);
    });

    const cfg = ENTIDADES[pagina];
    $("#pageTitle").textContent = cfg ? cfg.titulo : "Início";
    $("#pageSubtitle").textContent = cfg ? cfg.subtitulo : "Resumo das reservas e dos espaços";
    $("#primaryAction span").textContent = cfg ? cfg.novo : "Nova reserva";
    document.title = `${cfg ? cfg.titulo : "Início"} · Gestão de Espaços`;

    if (pagina === "inicio") return mostrarInicio();

    // ao entrar na página a busca começa limpa (os filtros continuam)
    Object.assign(estado[pagina], { busca: "", resultado: null, info: "", modo: cfg.busca[0] });
    $("#content").innerHTML = `<section class="page">${barraDeFerramentas(pagina)}<div class="result-info" id="resultInfo"></div><div id="view"></div></section>`;
    ligarBarraDeFerramentas(pagina);
    carregarPagina(pagina);
}

// recarrega os dados da página que está aberta (depois de salvar/excluir)
function atualizarTela() {
    const pagina = paginaAtual();
    if (pagina === "inicio") return mostrarInicio();
    carregarPagina(pagina).then(() => {
        if (estado[pagina].busca) executarBusca(pagina);
    });
}


// ================== PÁGINA INICIAL ==================

async function mostrarInicio() {
    $("#content").innerHTML = `<section class="page">
        <div class="stats">${'<div class="card stat"><div style="flex:1"><div class="skeleton" style="width:60%"></div><div class="skeleton" style="width:40%;height:26px;margin-top:10px"></div></div></div>'.repeat(4)}</div>
    </section>`;

    await Promise.all(["reservas", "espacos", "empresas", "usuarios", "disponiveis"].map(carregarSilencioso));
    if (paginaAtual() !== "inicio") return;

    const reservas = lista("reservas");
    const agora = agoraISO();
    const semReservas = !cache.reservas;
    const pendentes = reservas.filter(r => r.status === "PENDING");
    const proximasAprovadas = reservas.filter(r => r.status === "APPROVED" && r.start_datetime >= agora);
    const espacos = lista("espacos");
    const ativos = espacos.filter(e => e.is_active !== false);

    const stat = (tom, ic, rotulo, valor, dica, destino) => `
        <button type="button" class="card stat" data-acao="ir" data-pagina="${destino.pagina}" data-filtro="${destino.filtro || ""}">
            <span class="stat-icon tone-${tom}">${icone(ic)}</span>
            <span><span class="label">${rotulo}</span><div class="value">${valor}</div><span class="hint">${dica}</span></span>
        </button>`;

    const indisponivel = "rota ainda não disponível";
    const cards = [
        stat("warning", "reservas", "Reservas pendentes", semReservas ? "—" : pendentes.length,
            semReservas ? indisponivel : "aguardando aprovação", { pagina: "reservas", filtro: "PENDING" }),
        stat("success", "check", "Próximas reservas", semReservas ? "—" : proximasAprovadas.length,
            semReservas ? indisponivel : "aprovadas a partir de hoje", { pagina: "reservas", filtro: "APPROVED" }),
        stat("primary", "espacos", "Espaços ativos", cache.espacos ? ativos.length : "—",
            cache.espacos ? `de ${espacos.length} cadastrados` : indisponivel, { pagina: "espacos" }),
        stat("violet", "empresas", "Empresas", cache.empresas ? lista("empresas").length : "—",
            cache.usuarios ? `${lista("usuarios").length} usuários cadastrados` : "parceiras", { pagina: "empresas" })
    ].join("");

    // próximas reservas (se não houver nenhuma futura, mostra as mais recentes)
    let titulo = "Próximas reservas";
    let destaque = reservas
        .filter(r => r.start_datetime >= agora && ["PENDING", "APPROVED"].includes(r.status))
        .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
    if (!destaque.length) {
        titulo = "Reservas recentes";
        destaque = reservas.slice().sort((a, b) => b.start_datetime.localeCompare(a.start_datetime));
    }
    destaque = destaque.slice(0, 6);

    const listaReservas = semReservas
        ? estadoErroHTML("reservas", erros.reservas, true)
        : destaque.length === 0
            ? estadoVazioHTML("reservas", false)
            : `<ul class="booking-list">${destaque.map(r => {
                const [ano, mes, dia] = r.start_datetime.slice(0, 10).split("-");
                return `<li class="booking" data-acao="editar" data-ent="reservas" data-id="${r.id}">
                    <div class="date-block"><strong>${Number(dia)}</strong><span>${MESES[Number(mes) - 1]}</span></div>
                    <div class="booking-info">
                        <strong>${esc(nomeDe("espacos", r.space_id))}</strong>
                        <span>${esc(nomeDe("usuarios", r.user_id))} · ${DIAS_CURTOS[diaDaSemana(r.start_datetime)]}, ${hora(r.start_datetime)}–${hora(r.end_datetime)}</span>
                    </div>
                    <div class="booking-side">${r.status === "PENDING" ? botoesAprovacao(r) : statusBadge(r)}</div>
                </li>`;
            }).join("")}</ul>`;

    // espaços mais reservados
    const contagem = {};
    reservas.filter(r => r.status !== "CANCELLED" && r.status !== "REJECTED")
        .forEach(r => { contagem[r.space_id] = (contagem[r.space_id] || 0) + 1; });
    const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maximo = ranking.length ? ranking[0][1] : 1;
    const barras = semReservas
        ? estadoErroHTML("reservas", erros.reservas, true)
        : ranking.length === 0
            ? `<div class="state"><p>Ainda não há reservas ativas.</p></div>`
            : `<ul class="bars">${ranking.map(([id, n]) => `
                <li class="bar-row">
                    <div class="bar-label"><strong>${esc(nomeDe("espacos", id))}</strong><span>${n} ${n === 1 ? "reserva" : "reservas"}</span></div>
                    <div class="bar-track"><div class="bar-fill" style="width:${(n / maximo) * 100}%"></div></div>
                </li>`).join("")}</ul>`;

    $("#content").innerHTML = `<section class="page">
        <div class="stats">${cards}</div>
        <div class="dash-grid">
            <div class="card">
                <div class="panel-head"><h2>${titulo}</h2><button type="button" class="link-button" data-acao="ir" data-pagina="reservas">Ver todas</button></div>
                ${listaReservas}
            </div>
            <div class="card">
                <div class="panel-head"><h2>Espaços mais reservados</h2><button type="button" class="link-button" data-acao="ir" data-pagina="espacos">Ver espaços</button></div>
                ${barras}
            </div>
        </div>
    </section>`;
}


// ================== PÁGINAS DAS ENTIDADES ==================

function barraDeFerramentas(ent) {
    const cfg = ENTIDADES[ent], st = estado[ent];
    const modos = cfg.busca.length > 1
        ? `<div class="segmented" role="group" aria-label="Buscar por">${cfg.busca.map(m =>
            `<button type="button" data-modo="${m}" class="${m === st.modo ? "active" : ""}">${ROTULO_BUSCA[m]}</button>`).join("")}</div>`
        : "";
    return `<div class="toolbar">
        <div class="search-box">
            ${icone("search")}
            <input id="busca" autocomplete="off" aria-label="Buscar">
            ${modos}
        </div>
        ${cfg.filtroEspaco ? '<select class="select-inline" id="filtroEspaco" aria-label="Filtrar por espaço"></select>' : ""}
        ${cfg.filtro ? '<div class="chips" id="chips"></div>' : ""}
    </div>`;
}

function configurarCampoBusca(ent) {
    const input = $("#busca"), modo = estado[ent].modo, cfg = ENTIDADES[ent];
    input.type = modo === "data" ? "date" : modo === "id" ? "number" : "search";
    input.placeholder = modo === "nome" ? `Buscar ${cfg.plural} pelo nome...` : modo === "id" ? "Digite o ID..." : "";
}

let timerBusca;
function ligarBarraDeFerramentas(ent) {
    configurarCampoBusca(ent);

    $("#busca").addEventListener("input", function () {
        estado[ent].busca = this.value;
        clearTimeout(timerBusca);
        timerBusca = setTimeout(() => executarBusca(ent), this.type === "date" ? 0 : 350); // espera parar de digitar
    });

    document.querySelectorAll(".segmented button").forEach(botao => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(".segmented button").forEach(b => b.classList.toggle("active", b === botao));
            Object.assign(estado[ent], { modo: botao.dataset.modo, busca: "", resultado: null, info: "" });
            $("#busca").value = "";
            configurarCampoBusca(ent);
            $("#busca").focus();
            desenharResultado(ent);
        });
    });

    const filtroEspaco = $("#filtroEspaco");
    if (filtroEspaco) filtroEspaco.addEventListener("change", () => {
        estado[ent].espaco = filtroEspaco.value;
        desenharResultado(ent);
    });
}

async function carregarPagina(ent) {
    const cfg = ENTIDADES[ent];
    const view = $("#view");
    if (view && !cache[ent]) view.innerHTML = esqueletoHTML(cfg.visual);

    await Promise.all(cfg.relacionadas.map(carregarSilencioso));
    await carregarSilencioso(ent);
    desenharResultado(ent);
}

// busca na API: /rota/1, /rota/nome/texto ou /rota/data/2026-09-16
let buscaAtual = 0;
async function executarBusca(ent) {
    const st = estado[ent], cfg = ENTIDADES[ent];
    const termo = st.busca.trim();
    if (!termo) {
        Object.assign(st, { resultado: null, info: "" });
        return desenharResultado(ent);
    }

    const caminho = st.modo === "id" ? `${cfg.rota}/${encodeURIComponent(termo)}` : `${cfg.rota}/${st.modo}/${encodeURIComponent(termo)}`;
    const numero = ++buscaAtual;
    try {
        const resposta = await requisicao("GET", caminho);
        st.resultado = Array.isArray(resposta) ? resposta : [resposta]; // por id vem um objeto só
        st.info = `Buscado na API: GET ${caminho}`;
    } catch (erro) {
        if (erro.rotaInexistente) {
            // essa busca ainda não foi criada no back-end: filtra aqui mesmo para não travar o uso
            st.resultado = filtrarLocalmente(ent, st.modo, termo);
            st.info = `A rota GET ${caminho} ainda não existe na API, filtrando pela lista carregada`;
        } else if (erro.status === 404) {
            st.resultado = []; // a API respondeu "não encontrado"
            st.info = `Buscado na API: GET ${caminho}`;
        } else {
            return aviso("Erro na busca", erro.message, "error");
        }
    }
    if (numero === buscaAtual && paginaAtual() === ent) desenharResultado(ent);
}

function filtrarLocalmente(ent, modo, termo) {
    const cfg = ENTIDADES[ent];
    return lista(ent).filter(item => {
        if (modo === "id") return String(item.id) === termo;
        if (modo === "nome") return String(item.name || "").toLowerCase().includes(termo.toLowerCase());
        if (ent === "disponiveis") return item.day_of_week === diaDaSemana(termo);
        return (cfg.camposData || []).some(campo => String(item[campo] || "").startsWith(termo));
    });
}

function itensVisiveis(ent) {
    const cfg = ENTIDADES[ent], st = estado[ent];
    let itens = (st.resultado || lista(ent)).slice();
    if (cfg.filtro && st.filtro !== "todos") itens = itens.filter(i => String(i[cfg.filtro.campo]) === st.filtro);
    if (st.espaco) itens = itens.filter(i => i.space_id === Number(st.espaco));
    return itens.sort(cfg.ordenar);
}

function desenharResultado(ent) {
    if (paginaAtual() !== ent || !$("#view")) return;
    const cfg = ENTIDADES[ent], st = estado[ent];
    desenharFiltros(ent);

    if (!cache[ent] && erros[ent]) {
        $("#resultInfo").innerHTML = "";
        $("#view").innerHTML = `<div class="card">${estadoErroHTML(ent, erros[ent])}</div>`;
        return;
    }

    const itens = itensVisiveis(ent);
    const filtrando = st.resultado !== null || st.filtro !== "todos" || st.espaco;
    const qtd = `${itens.length} ${itens.length === 1 ? cfg.singular : cfg.plural}`;
    $("#resultInfo").innerHTML = filtrando
        ? `${qtd} encontrad${cfg.feminino ? "a" : "o"}${itens.length === 1 ? "" : "s"}${st.info ? ` · <span class="muted">${esc(st.info)}</span>` : ""}<button type="button" data-acao="limpar-filtros" data-ent="${ent}">Limpar filtros</button>`
        : qtd;

    if (cfg.visual === "semana") {
        $("#view").innerHTML = quadroSemanaHTML(itens);
    } else if (itens.length === 0) {
        $("#view").innerHTML = `<div class="card">${estadoVazioHTML(ent, filtrando)}</div>`;
    } else {
        $("#view").innerHTML = cfg.visual === "cards" ? cardsEspacosHTML(itens) : tabelaHTML(ent, itens);
    }
}

function desenharFiltros(ent) {
    const cfg = ENTIDADES[ent], st = estado[ent];
    const chips = $("#chips");
    if (chips && cfg.filtro) {
        const base = st.resultado || lista(ent);
        const contar = valor => base.filter(i => String(i[cfg.filtro.campo]) === valor).length;
        chips.innerHTML = [["todos", "Todos"], ...cfg.filtro.opcoes].map(([valor, rotulo]) =>
            `<button type="button" class="chip ${st.filtro === String(valor) ? "active" : ""}" data-acao="filtrar" data-ent="${ent}" data-valor="${valor}">
                ${esc(rotulo)} <span class="n">${valor === "todos" ? base.length : contar(String(valor))}</span>
            </button>`).join("");
    }
    const select = $("#filtroEspaco");
    if (select) {
        select.innerHTML = `<option value="">Todos os espaços</option>` +
            lista("espacos").map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
        select.value = st.espaco;
    }
}


// ---------- tabela ----------
function tabelaHTML(ent, itens) {
    const cfg = ENTIDADES[ent];
    const cabecalho = cfg.colunas.map(c => `<th class="${c.classe && c.classe.includes("hide-sm") ? "hide-sm" : ""}">${c.titulo}</th>`).join("");
    const linhas = itens.map(item => `
        <tr class="clickable" data-acao="editar" data-ent="${ent}" data-id="${item.id}">
            <td class="id-cell">#${item.id}</td>
            ${cfg.colunas.map(c => `<td class="${c.classe || ""}">${c.html(item)}</td>`).join("")}
            <td class="actions"><div class="row-buttons">
                ${cfg.acoesLinha ? cfg.acoesLinha(item) : ""}
                <button type="button" class="icon-button" data-acao="editar" data-ent="${ent}" data-id="${item.id}" title="Editar" aria-label="Editar">${icone("edit")}</button>
                <button type="button" class="icon-button danger" data-acao="excluir" data-ent="${ent}" data-id="${item.id}" title="Excluir" aria-label="Excluir">${icone("trash")}</button>
            </div></td>
        </tr>`).join("");
    return `<div class="card table-wrap"><table>
        <thead><tr><th>ID</th>${cabecalho}<th></th></tr></thead>
        <tbody>${linhas}</tbody>
    </table></div>`;
}

// ---------- cards de espaços ----------
function cardsEspacosHTML(itens) {
    const temDisponibilidade = Boolean(cache.disponiveis);
    return `<div class="space-grid">${itens.map(e => {
        const tipo = TIPOS[e.type] ? e.type : "OUTRO";
        const ativo = e.is_active !== false;
        const dias = lista("disponiveis").filter(d => d.space_id === e.id).map(d => d.day_of_week);
        const qtdReservas = lista("reservas").filter(r => r.space_id === e.id && r.status !== "CANCELLED").length;
        return `<article class="card space-card ${ativo ? "" : "inactive"}">
            <div class="space-cover cover-${tipo}">
                ${icone(tipo)}
                <span class="type">${esc(TIPOS[e.type] || e.type || "Outro")}</span>
                ${ativo ? "" : badge("Inativo")}
            </div>
            <div class="space-body">
                <h3>${esc(e.name)}</h3>
                ${e.description ? `<p>${esc(e.description)}</p>` : ""}
                <div class="space-meta">
                    <span>${icone("usuarios")} ${e.capacity ? `${esc(e.capacity)} pessoas` : "Capacidade não informada"}</span>
                    ${cache.reservas ? `<span>${icone("reservas")} ${qtdReservas} ${qtdReservas === 1 ? "reserva" : "reservas"}</span>` : ""}
                </div>
                ${temDisponibilidade ? `<div class="days" title="Dias com disponibilidade">${ORDEM_SEMANA.map(d =>
                    `<span class="${dias.includes(d) ? "on" : ""}">${DIAS_CURTOS[d]}</span>`).join("")}</div>` : ""}
            </div>
            <div class="space-foot">
                <button type="button" class="btn btn-primary btn-sm" data-acao="reservar" data-id="${e.id}" ${ativo ? "" : "disabled title=\"Espaço inativo\""}>${icone("reservas")}Reservar</button>
                <button type="button" class="icon-button" data-acao="editar" data-ent="espacos" data-id="${e.id}" title="Editar" aria-label="Editar">${icone("edit")}</button>
                <button type="button" class="icon-button danger" data-acao="excluir" data-ent="espacos" data-id="${e.id}" title="Excluir" aria-label="Excluir">${icone("trash")}</button>
            </div>
        </article>`;
    }).join("")}</div>`;
}

// ---------- quadro semanal de disponibilidade ----------
function quadroSemanaHTML(itens) {
    const hoje = new Date().getDay();
    return `<div class="week">${ORDEM_SEMANA.map(dia => {
        const doDia = itens.filter(d => d.day_of_week === dia);
        return `<div class="day-col ${dia === hoje ? "today" : ""}">
            <div class="day-head"><strong>${DIAS[dia]}</strong><span>${doDia.length || ""}</span></div>
            ${doDia.map(d => `
                <button type="button" class="slot" data-acao="editar" data-ent="disponiveis" data-id="${d.id}">
                    <strong>${esc(nomeDe("espacos", d.space_id))}</strong>
                    <span class="time">${esc(d.start_time)} – ${esc(d.end_time)}</span>
                    <span class="ext ${d.is_external_allowed ? "" : "no"}">${d.is_external_allowed ? "Aberto ao público externo" : "Somente interno"}</span>
                </button>`).join("")}
            <button type="button" class="add-slot" data-acao="novo-dia" data-dia="${dia}">+ Adicionar</button>
        </div>`;
    }).join("")}</div>`;
}

// ---------- estados: carregando, vazio, erro ----------
function esqueletoHTML(visual) {
    if (visual === "cards") {
        return `<div class="space-grid">${'<div class="card space-card"><div class="skeleton" style="height:108px;border-radius:0"></div><div class="space-body"><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:90%"></div></div></div>'.repeat(6)}</div>`;
    }
    const linha = '<tr><td colspan="6"><div class="skeleton"></div></td></tr>';
    return `<div class="card table-wrap"><table><tbody>${linha.repeat(6)}</tbody></table></div>`;
}

function estadoVazioHTML(ent, filtrando) {
    const cfg = ENTIDADES[ent];
    if (filtrando) {
        return `<div class="state"><div class="state-icon">${icone("search")}</div>
            <h3>Nada encontrado</h3><p>Nenhum${cfg.feminino ? "a" : ""} ${cfg.singular} corresponde à busca ou ao filtro.</p>
            <button type="button" class="btn btn-secondary" data-acao="limpar-filtros" data-ent="${ent}">Limpar filtros</button></div>`;
    }
    return `<div class="state"><div class="state-icon">${icone("inbox")}</div>
        <h3>Nenhum${cfg.feminino ? "a" : ""} ${cfg.singular} cadastrad${cfg.feminino ? "a" : "o"}</h3>
        <p>Comece cadastrando ${cfg.feminino ? "a primeira" : "o primeiro"}.</p>
        <button type="button" class="btn btn-primary" data-acao="novo" data-ent="${ent}">${icone("plus")}${cfg.novo}</button></div>`;
}

function estadoErroHTML(ent, erro, compacto = false) {
    const cfg = ENTIDADES[ent];
    let titulo = "Não foi possível carregar";
    let texto = esc(erro ? erro.message : "Erro desconhecido");
    if (erro && erro.offline) {
        titulo = "API fora do ar";
        texto = "Não foi possível conectar ao servidor. Rode <code>npm start</code> na pasta do projeto e tente de novo.";
    } else if (erro && erro.rotaInexistente) {
        titulo = "Essa parte da API ainda não existe";
        texto = `O servidor respondeu 404 para <code>GET ${cfg.rota}</code>. A rota de ${cfg.titulo.toLowerCase()} precisa ser criada no back-end.`;
    }
    return `<div class="state error"><div class="state-icon">${icone(erro && erro.offline ? "offline" : "alert")}</div>
        <h3>${titulo}</h3><p>${texto}</p>
        ${compacto ? "" : `<button type="button" class="btn btn-secondary" data-acao="recarregar" data-ent="${ent}">Tentar novamente</button>`}</div>`;
}


// ================== FORMULÁRIO (painel lateral) ==================

let formulario = null; // { ent, item } do registro aberto no painel

function campoHTML(c, editando) {
    const id = `campo_${c.nome}`;
    const obrigatorio = c.obrigatorio ? '<span class="req">*</span>' : "";
    const ajuda = editando && c.ajudaEdicao ? c.ajudaEdicao : c.ajuda;
    const rodape = `${ajuda ? `<span class="help">${ajuda}</span>` : ""}<span class="error-text"></span>`;
    const classe = `field ${c.meio ? "half" : ""}`;

    if (c.tipo === "switch") {
        return `<div class="${classe}" data-campo="${c.nome}">
            <label class="switch">
                <span class="switch-text"><strong>${c.rotulo}</strong><span>${c.descricao || ""}</span></span>
                <input type="checkbox" name="${c.nome}"><span class="track"></span>
            </label></div>`;
    }
    if (c.tipo === "opcoes") {
        return `<div class="${classe}" data-campo="${c.nome}">
            <label>${c.rotulo}${obrigatorio}</label>
            <div class="options" role="radiogroup">${c.opcoes.map(([valor, rotulo]) =>
                `<label class="option"><input type="radio" name="${c.nome}" value="${valor}">${esc(rotulo)}</label>`).join("")}
            </div>${rodape}</div>`;
    }

    let controle;
    if (c.tipo === "select") {
        const opcoes = lista(c.opcoesDe).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
            .map(i => `<option value="${i.id}">${esc(i.name)}${i.is_active === false ? " (inativo)" : ""}</option>`).join("");
        controle = `<select id="${id}" name="${c.nome}"><option value="">${c.vazio || "Selecione..."}</option>${opcoes}</select>`;
        if (!cache[c.opcoesDe]) controle += `<span class="help">Não foi possível carregar a lista de ${ENTIDADES[c.opcoesDe].plural}.</span>`;
    } else if (c.tipo === "textarea") {
        controle = `<textarea id="${id}" name="${c.nome}" rows="3" placeholder="${c.placeholder || ""}"></textarea>`;
    } else {
        controle = `<input id="${id}" name="${c.nome}" type="${c.tipo}" placeholder="${c.placeholder || ""}" ${c.min ? `min="${c.min}"` : ""} ${c.tipo === "password" ? 'autocomplete="new-password"' : ""}>`;
    }
    return `<div class="${classe}" data-campo="${c.nome}"><label for="${id}">${c.rotulo}${obrigatorio}</label>${controle}${rodape}</div>`;
}

async function abrirFormulario(ent, item = null, predefinidos = {}) {
    const cfg = ENTIDADES[ent];
    // garante que os selects (espaço, usuário, empresa...) tenham as opções
    await Promise.all([...cfg.relacionadas, ent].filter(e => !cache[e]).map(carregarSilencioso));

    formulario = { ent, item };
    $("#drawerTitle").textContent = item ? `Editar ${cfg.singular}` : cfg.novo;
    $("#drawerSubtitle").textContent = item ? `#${item.id} · ${cfg.nome(item)}` : "Preencha os dados abaixo. Campos com * são obrigatórios.";
    $("#drawerDelete").hidden = !item;

    const form = $("#drawerForm");
    form.innerHTML = cfg.campos.map(c => campoHTML(c, Boolean(item))).join("") + '<div class="form-note" id="formDica" hidden></div>';

    const valores = item || predefinidos;
    cfg.campos.forEach(c => definirValor(c, item ? valores[c.nome] : (valores[c.nome] ?? c.padrao)));

    // máscaras
    cfg.campos.filter(c => c.mascara).forEach(c => {
        const input = form.querySelector(`[name="${c.nome}"]`);
        input.addEventListener("input", () => { input.value = MASCARAS[c.mascara](input.value); });
    });

    atualizarFormulario();
    $("#drawer").classList.add("open");
    $("#drawerBackdrop").classList.add("open");
    $("#drawer").setAttribute("aria-hidden", "false");
    setTimeout(() => { const primeiro = form.querySelector("input:not([type=radio]):not([type=checkbox]), select"); if (primeiro) primeiro.focus(); }, 260);
}

function fecharFormulario() {
    formulario = null;
    $("#drawer").classList.remove("open");
    $("#drawerBackdrop").classList.remove("open");
    $("#drawer").setAttribute("aria-hidden", "true");
}

function definirValor(c, valor) {
    const form = $("#drawerForm");
    if (c.tipo === "switch") {
        form.querySelector(`[name="${c.nome}"]`).checked = Boolean(valor);
    } else if (c.tipo === "opcoes") {
        const radio = form.querySelector(`[name="${c.nome}"][value="${valor}"]`);
        if (radio) radio.checked = true;
    } else if (c.tipo === "password") {
        form.querySelector(`[name="${c.nome}"]`).value = "";
    } else if (c.tipo === "datetime-local") {
        form.querySelector(`[name="${c.nome}"]`).value = valor ? String(valor).slice(0, 16) : "";
    } else {
        form.querySelector(`[name="${c.nome}"]`).value = valor ?? "";
    }
}

// transforma o formulário no JSON que vai para a API
function lerFormulario() {
    const { ent } = formulario;
    const form = $("#drawerForm");
    const corpo = {};
    ENTIDADES[ent].campos.forEach(c => {
        let valor;
        if (c.tipo === "switch") valor = form.querySelector(`[name="${c.nome}"]`).checked;
        else if (c.tipo === "opcoes") valor = form.querySelector(`[name="${c.nome}"]:checked`)?.value ?? "";
        else valor = form.querySelector(`[name="${c.nome}"]`).value.trim();

        if (c.tipo === "datetime-local" && valor) valor += ":00Z";
        if ((c.numero || c.tipo === "number" || c.opcoesDe) && typeof valor === "string") valor = valor === "" ? null : Number(valor);
        corpo[c.nome] = valor;
    });
    return corpo;
}

// mostra/esconde campos que dependem de outros e atualiza a dica
function atualizarFormulario() {
    if (!formulario) return;
    const cfg = ENTIDADES[formulario.ent];
    const valores = lerFormulario();
    cfg.campos.filter(c => c.mostrarSe).forEach(c => {
        $(`#drawerForm [data-campo="${c.nome}"]`).hidden = !c.mostrarSe(valores);
    });

    const dica = $("#formDica");
    const resultado = cfg.dica ? cfg.dica({ ...valores, id: formulario.item?.id }) : null;
    dica.hidden = !resultado;
    if (resultado) {
        dica.className = `form-note ${resultado.tipo === "aviso" ? "warning" : ""}`;
        dica.innerHTML = `${icone(resultado.tipo === "aviso" ? "alert" : "info")}<span>${esc(resultado.texto)}</span>`;
    }
}

// dica ao preencher uma reserva: horário disponível e conflito com outras reservas
function dicaReserva(v) {
    if (!v.space_id || !v.start_datetime) return null;
    const inicio = v.start_datetime, fim = v.end_datetime;

    if (fim) {
        const conflito = lista("reservas").find(r => r.id !== v.id && r.space_id === v.space_id &&
            ["APPROVED", "PENDING"].includes(r.status) && r.start_datetime < fim && r.end_datetime > inicio);
        if (conflito) {
            return { tipo: "aviso", texto: `Conflito de horário: a reserva #${conflito.id} (${STATUS[conflito.status].texto.toLowerCase()}) já ocupa esse espaço das ${hora(conflito.start_datetime)} às ${hora(conflito.end_datetime)}.` };
        }
    }
    if (!cache.disponiveis) return null;

    const dia = diaDaSemana(inicio);
    const janelas = lista("disponiveis").filter(d => d.space_id === v.space_id && d.day_of_week === dia);
    const horarios = janelas.map(j => `${j.start_time}–${j.end_time}`).join(", ");
    if (!janelas.length) return { tipo: "aviso", texto: `Esse espaço não tem disponibilidade cadastrada para ${DIAS[dia].toLowerCase()}.` };

    const cabe = janelas.some(j => hora(inicio) >= j.start_time && (!fim || hora(fim) <= j.end_time));
    return cabe
        ? { tipo: "info", texto: `Horário livre. Disponibilidade de ${DIAS[dia].toLowerCase()}: ${horarios}.` }
        : { tipo: "aviso", texto: `Fora do horário disponível de ${DIAS[dia].toLowerCase()} (${horarios}).` };
}

function validarFormulario(corpo) {
    const { ent } = formulario;
    const form = $("#drawerForm");
    const problemas = {};

    ENTIDADES[ent].campos.forEach(c => {
        const escondido = c.mostrarSe && !c.mostrarSe(corpo);
        if (c.obrigatorio && !escondido && (corpo[c.nome] === "" || corpo[c.nome] === null)) problemas[c.nome] = "Campo obrigatório";
    });
    if (corpo.email && !/^\S+@\S+\.\S+$/.test(corpo.email)) problemas.email = "E-mail inválido";
    if (ent === "empresas" && corpo.cnpj && corpo.cnpj.length !== 18) problemas.cnpj = "CNPJ incompleto";
    if (corpo.capacity !== undefined && corpo.capacity !== null && corpo.capacity < 1) problemas.capacity = "Precisa ser pelo menos 1";
    if (corpo.end_time && corpo.start_time && corpo.end_time <= corpo.start_time) problemas.end_time = "Precisa ser depois da abertura";
    if (corpo.end_datetime && corpo.start_datetime && corpo.end_datetime <= corpo.start_datetime) problemas.end_datetime = "Precisa ser depois do início";

    form.querySelectorAll(".field").forEach(campo => {
        const problema = problemas[campo.dataset.campo];
        campo.classList.toggle("invalid", Boolean(problema));
        const texto = campo.querySelector(".error-text");
        if (texto) texto.textContent = problema || "";
    });

    const primeiro = Object.keys(problemas)[0];
    if (primeiro) {
        const campo = form.querySelector(`[name="${primeiro}"]`);
        if (campo) campo.focus();
        return false;
    }
    return true;
}

async function salvarFormulario() {
    if (!formulario) return;
    const { ent, item } = formulario;
    const cfg = ENTIDADES[ent];
    const corpo = lerFormulario();
    if (!validarFormulario(corpo)) return aviso("Revise os campos destacados", "", "error");

    if (corpo.password === "") delete corpo.password; // senha em branco = não trocar
    if ("rejection_reason" in corpo && corpo.status !== "REJECTED") corpo.rejection_reason = null;

    const botao = $("#drawerSave");
    botao.disabled = true;
    botao.textContent = "Salvando...";
    try {
        await salvarNaApi(ent, corpo, item && item.id);
        const artigo = cfg.feminino ? "a" : "o";
        aviso(item ? `${cap(cfg.singular)} atualizad${artigo}` : `${cap(cfg.singular)} cadastrad${artigo}`, corpo.name || (item ? cfg.nome(item) : ""));
        fecharFormulario();
        atualizarTela();
    } catch (erro) {
        aviso("Não foi possível salvar", erro.message, "error");
    } finally {
        botao.disabled = false;
        botao.textContent = "Salvar";
    }
}

const cap = texto => texto.charAt(0).toUpperCase() + texto.slice(1);


// ================== AÇÕES ==================

function acharItem(ent, id) {
    return [...lista(ent), ...(estado[ent].resultado || [])].find(i => String(i.id) === String(id));
}

async function excluir(ent, id) {
    const cfg = ENTIDADES[ent];
    const item = acharItem(ent, id);
    if (!item) return;
    const artigo = cfg.feminino ? "a" : "o";
    const ok = await dialogo({
        titulo: `Excluir ${cfg.singular}?`,
        texto: `"${cfg.nome(item)}" será removid${artigo} permanentemente.${cfg.avisoExcluir ? cfg.avisoExcluir(item) : ""}`,
        confirmar: "Excluir",
        perigo: true
    });
    if (!ok) return;
    try {
        await requisicao("DELETE", `${cfg.rota}/${id}`);
        aviso(`${cap(cfg.singular)} excluíd${artigo}`, cfg.nome(item));
        if (formulario) fecharFormulario();
        atualizarTela();
    } catch (erro) {
        aviso("Não foi possível excluir", erro.message, "error");
    }
}

// aprovar / rejeitar direto da lista
async function mudarStatus(id, status) {
    const reserva = acharItem("reservas", id);
    if (!reserva) return;
    let motivo = null;
    if (status === "REJECTED") {
        motivo = await dialogo({
            titulo: `Rejeitar reserva #${id}?`,
            texto: `${nomeDe("espacos", reserva.space_id)} · ${dataCurta(reserva.start_datetime)}, ${hora(reserva.start_datetime)}–${hora(reserva.end_datetime)}`,
            confirmar: "Rejeitar reserva",
            perigo: true,
            campo: "Motivo da rejeição (o cliente verá esta mensagem)"
        });
        if (!motivo) return;
    }
    const { id: _id, ...dados } = reserva;
    try {
        await requisicao("PUT", `${ENTIDADES.reservas.rota}/${id}`, { ...dados, status, rejection_reason: motivo });
        aviso(status === "APPROVED" ? "Reserva aprovada" : "Reserva rejeitada", `${nomeDe("espacos", reserva.space_id)} · ${nomeDe("usuarios", reserva.user_id)}`);
        atualizarTela();
    } catch (erro) {
        aviso("Não foi possível alterar a reserva", erro.message, "error");
    }
}

const ACOES = {
    editar: (ent, el) => { const item = acharItem(ent, el.dataset.id); if (item) abrirFormulario(ent, item); },
    excluir: (ent, el) => excluir(ent, el.dataset.id),
    novo: ent => abrirFormulario(ent),
    aprovar: (ent, el) => mudarStatus(el.dataset.id, "APPROVED"),
    rejeitar: (ent, el) => mudarStatus(el.dataset.id, "REJECTED"),
    reservar: (ent, el) => abrirFormulario("reservas", null, { space_id: Number(el.dataset.id), status: "PENDING" }),
    "novo-dia": (ent, el) => abrirFormulario("disponiveis", null, { day_of_week: Number(el.dataset.dia), space_id: estado.disponiveis.espaco ? Number(estado.disponiveis.espaco) : "" }),
    recarregar: ent => { const view = $("#view"); if (view) view.innerHTML = esqueletoHTML(ENTIDADES[ent].visual); atualizarTela(); },
    filtrar: (ent, el) => { estado[ent].filtro = el.dataset.valor; desenharResultado(ent); },
    "limpar-filtros": ent => {
        Object.assign(estado[ent], { busca: "", resultado: null, info: "", filtro: "todos", espaco: "" });
        if ($("#busca")) $("#busca").value = "";
        desenharResultado(ent);
    },
    ir: (ent, el) => {
        if (el.dataset.filtro) estado[el.dataset.pagina].filtro = el.dataset.filtro;
        location.hash = el.dataset.pagina;
    }
};


// ================== EVENTOS ==================

// um único "click" para a página toda: descobre qual ação foi pedida pelo data-acao
document.addEventListener("click", function (evento) {
    const el = evento.target.closest("[data-acao]");
    if (!el || el.disabled) return;
    const ent = el.dataset.ent || paginaAtual();
    evento.preventDefault();
    evento.stopPropagation();
    ACOES[el.dataset.acao](ent, el);
});

$("#primaryAction").addEventListener("click", () => {
    const pagina = paginaAtual();
    abrirFormulario(pagina === "inicio" ? "reservas" : pagina);
});

$("#drawerForm").addEventListener("submit", evento => { evento.preventDefault(); salvarFormulario(); });
$("#drawerForm").addEventListener("input", atualizarFormulario);
$("#drawerForm").addEventListener("change", atualizarFormulario);
$("#drawerDelete").addEventListener("click", () => formulario && excluir(formulario.ent, formulario.item.id));
document.querySelectorAll("[data-close-drawer]").forEach(b => b.addEventListener("click", fecharFormulario));
$("#drawerBackdrop").addEventListener("click", fecharFormulario);

$("#menuButton").addEventListener("click", () => abrirMenu(true));
$("#sidebarBackdrop").addEventListener("click", () => abrirMenu(false));

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        if (fecharModalAtual) return fecharModalAtual();
        if (formulario) return fecharFormulario();
        abrirMenu(false);
    }
    // "/" vai direto para a busca
    const digitando = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
    if (evento.key === "/" && !digitando && $("#busca")) {
        evento.preventDefault();
        $("#busca").focus();
    }
});

window.addEventListener("hashchange", mostrarPagina);


// ================== INÍCIO ==================

montarMenu();
mostrarPagina();
verificarApi();
