// pras tela do adm chamarem a api
// ele coloca o token, converte a resposta em json e, se o token "venceu", manda pro login
// Isso aqui serve basicamente pra não ter que ficar repetindo codigo
export const API_URL = "http://localhost:3080";

// devolve { ok, status, dados }  (dados é o json da resposta, ou null se não veio json)
export async function chamarApi(caminho, opcoes = {}) {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...opcoes.headers,
    },
  });

  if (resposta.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.assign("/login");
    return {
      ok: false,
      status: 401,
      dados: { erro: "Sessão expirada. Faça login novamente." },
    };
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    // resposta sem json (não deve acontecer nas rotas do projeto)
  }
  return { ok: resposta.ok, status: resposta.status, dados };
}

// "2026-11-26T08:00" -> "26/11/2026 08:00"
export function formatarDataHora(texto) {
  if (!texto) return "—";
  const [data, hora] = String(texto).split("T");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} ${hora || ""}`.trim();
}
