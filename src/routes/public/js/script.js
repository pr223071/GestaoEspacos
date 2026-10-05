let reservas = [];
let espacos = [];
let usuarios = [];

async function carregarReservas() {
    try {
        const resposta = await fetch("/reservas");

        if (!resposta.ok) {
            throw new Error("Erro ao carregar reservas");
        }

        reservas = await resposta.json();
        renderizarReservas();

    } catch (erro) {
        console.error(erro);
        alert("Erro ao carregar as reservas.");
    }
}

async function carregarEspacos() {
    try {
        const resposta = await fetch("/spaces");

        if (!resposta.ok) {
            throw new Error("Erro ao carregar espaços");
        }

        espacos = await resposta.json();
        const select = document.getElementById("space_id");

        select.innerHTML = '<option value="">Selecione o espaço</option>';

        espacos.forEach(espaco => {
            const option = document.createElement("option");
            option.value = espaco.id;
            option.textContent = `${espaco.id} - ${espaco.name}`;

            select.appendChild(option);
        });

    } catch (erro) {
        console.error("Erro ao carregar espaços:", erro);
    }
}

async function carregarUsuarios() {
    try {
        const resposta = await fetch("/clients");

        if (!resposta.ok) {
            throw new Error("Erro ao carregar usuários");
        }

        usuarios = await resposta.json();

        const select = document.getElementById("user_id");

        select.innerHTML =
            '<option value="">Selecione o usuário</option>';

        usuarios.forEach(usuario => {
            const option = document.createElement("option");

            option.value = usuario.id;
            option.textContent = `${usuario.id} - ${usuario.name}`;

            select.appendChild(option);
        });

    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
    }
}

function renderizarReservas() {

    const tabela = document.getElementById("tabelaReservas");

    tabela.innerHTML = "";

    if (reservas.length === 0) {

        tabela.innerHTML = `
            <tr>
                <td colspan="7"
                    class="text-center text-muted">
                    Nenhuma reserva encontrada.
                </td>
            </tr>
        `;

        return;
    }

    reservas.forEach(reserva => {

        const linha = document.createElement("tr");
        const status = criarBadgeStatus(reserva.status);

        linha.innerHTML = `
            <td>
                ${reserva.id}
            </td>

            <td>
                ${reserva.space_id}
            </td>

            <td>
                ${reserva.user_id}
            </td>

            <td>
                ${formatarData(reserva.start_datetime)}
            </td>

            <td>
                ${formatarData(reserva.end_datetime)}
            </td>

            <td>
                ${status}
            </td>

            <td class="text-end">

                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarReserva(${reserva.id})">
                    Editar
                </button>

                <button class="btn btn-sm btn-outline-danger" onclick="excluirReserva(${reserva.id})">
                    Excluir
                </button>

            </td>
        `;

        tabela.appendChild(linha);
    });
}

function criarBadgeStatus(status) {

    const classes = {
        APPROVED: "bg-success",
        PENDING: "bg-warning text-dark",
        REJECTED: "bg-danger",
        CANCELLED: "bg-secondary"
    };

    const nomes = {
        APPROVED: "Aprovada",
        PENDING: "Pendente",
        REJECTED: "Rejeitada",
        CANCELLED: "Cancelada"
    };

    return `<span class="badge ${classes[status] || "bg-dark"}">
                ${nomes[status] || status}
            </span>`;
}

function formatarData(data) {
    return new Date(data) .toLocaleString("pt-BR");
}

function abrirModalNovaReserva() {
    document.getElementById("tituloModal").textContent ="Nova Reserva";
    document.getElementById("reservaId").value = "";
    document.getElementById("space_id").value = "";
    document.getElementById("user_id").value = "";
    document.getElementById("start_datetime").value = "";
    document.getElementById("end_datetime").value = "";
    document.getElementById("status").value = "PENDING";
    document.getElementById("rejection_reason").value = "";
}

async function salvarReserva() {
    const id =document.getElementById("reservaId").value;

    const reserva = {
        space_id:Number(document.getElementById("space_id").value),

        user_id:Number(document.getElementById("user_id").value),

        start_datetime:new Date(document.getElementById("start_datetime").value).toISOString(),

        end_datetime:new Date(document.getElementById("end_datetime").value).toISOString(),
        
        status:document.getElementById("status").value,

        rejection_reason:document.getElementById("rejection_reason").value || null
    };

    if (
        !reserva.space_id ||
        !reserva.user_id ||
        !reserva.start_datetime ||
        !reserva.end_datetime
    ) {

        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    const metodo = id ? "PUT" : "POST";
    const url = id ? `/reservas/${id}` : "/reservas";

    try {

        const resposta = await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(reserva)});

        const dados = await resposta.json();

        if (!resposta.ok) {

            alert(dados.erro || "Erro ao salvar reserva.");
            return;
        }
        const modal =bootstrap.Modal.getInstance(document.getElementById("modalReserva"));
        modal.hide();
        await carregarReservas();

    } catch (erro) {

        console.error(erro);
        alert("Erro ao conectar com a API.");
    }
}

async function editarReserva(id) {

    const reserva = reservas.find(item => item.id === id);

    if (!reserva) {
        return;
    }

    if (espacos.length === 0) {
        await carregarEspacos();
    }

    if (usuarios.length === 0) {
        await carregarUsuarios();
    }

    document.getElementById("tituloModal").textContent = "Editar Reserva";
    document.getElementById("reservaId").value = reserva.id;
    document.getElementById("space_id").value = reserva.space_id;
    document.getElementById("user_id").value = reserva.user_id;
    document.getElementById("start_datetime").value = converterParaInputDateTime(reserva.start_datetime);
    document.getElementById("end_datetime").value = converterParaInputDateTime(reserva.end_datetime);
    document.getElementById("status").value = reserva.status;
    document.getElementById("rejection_reason").value = reserva.rejection_reason || "";

    const modal = new bootstrap.Modal(document.getElementById("modalReserva"));

    modal.show();
}

function converterParaInputDateTime(data) {

    const date = new Date(data);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}


async function excluirReserva(id) {

    const confirmar = confirm("Tem certeza que deseja excluir esta reserva?");

    if (!confirmar) {
        return;
    }

    try {
        const resposta =
            await fetch(`/reservas/${id}`,
                {
                    method: "DELETE"
                });

        const dados = await resposta.json();

        if (!resposta.ok) {
            alert(dados.erro || "Erro ao excluir reserva.");
            return;
        }
        await carregarReservas();

    } catch (erro) {

        console.error(erro);
        alert("Erro ao conectar com a API.");
    }
}

async function buscarPorData() {

    const data = document.getElementById("filtroData").value;

    if (!data) {
        await carregarReservas();
        return;
    }
    try {
        const resposta = await fetch(`/reservas/data/${data}`);

        if (resposta.status === 404) {
            reservas = [];
            renderizarReservas();
            return;
        }

        reservas = await resposta.json();
        renderizarReservas();

    } catch (erro) {
        console.error(erro);
        alert("Erro ao buscar reservas.");
    }
}

async function iniciarPagina() {

    await carregarEspacos();

    await carregarUsuarios();

    await carregarReservas();
}

iniciarPagina();