import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { chamarApi } from "../utils/api";
import "../css/gestao.css";
import "../css/relatorios.css";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// "2026-11-26" a partir de uma data, no horario do computador
function dataTexto(data) {
  const dois = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

// periodo padrao da tela: ultimos 30 dias
function periodoPadrao() {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(fim.getDate() - 29);
  return { inicio: dataTexto(inicio), fim: dataTexto(fim) };
}

const formatarPorcentagem = (valor) =>
  valor === null || valor === undefined
    ? "—"
    : `${String(valor).replace(".", ",")}%`;
const formatarHoras = (valor) => `${String(valor).replace(".", ",")} h`;

// "2026-11-01" -> "01/11/2026"
const formatarData = (texto) => texto.split("-").reverse().join("/");

// grafico de colunas feito so com css
function Colunas({ itens }) {
  const maior = Math.max(...itens.map((i) => i.valor), 0);
  return (
    <div className="rel-colunas">
      {itens.map((item) => (
        <div
          key={item.rotulo}
          className={
            item.valor > 0 && item.valor === maior
              ? "rel-coluna pico"
              : "rel-coluna"
          }
        >
          <b>{item.valor > 0 ? item.valor : ""}</b>
          <i
            style={{
              height: maior > 0 ? `${(item.valor / maior) * 100}%` : "3px",
            }}
          />
          <span>{item.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

// tela do adm: horas de uso, taxa de ocupacao, horarios de pico e perfil das empresa
// os numeros vem de GET /relatorios/ocupacao
function Relatorios() {
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [relatorio, setRelatorio] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // faz a busca; fica fora do useEffect pra o botao "Atualizar" usar a mesma funcao
  async function buscar(inicio, fim) {
    setErro("");
    setCarregando(true);
    try {
      const resp = await chamarApi(
        `/relatorios/ocupacao?inicio=${inicio}&fim=${fim}`,
      );
      if (!resp.ok) {
        setErro(resp.dados?.erro || "Não foi possível carregar o relatório");
        return;
      }
      setRelatorio(resp.dados);
    } catch {
      setErro("Não foi possível conectar ao servidor");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const { inicio, fim } = periodoPadrao();
    buscar(inicio, fim);
  }, []);

  function mudarPeriodo(e) {
    setPeriodo({ ...periodo, [e.target.name]: e.target.value });
  }

  function atualizar(e) {
    e.preventDefault();
    buscar(periodo.inicio, periodo.fim);
  }

  // horas do dia com reservas, 6h as 22h sempre aparecem, fora disso so se tiver uso
  const colunasHora = [];
  if (relatorio) {
    const porHora = new Map(
      relatorio.por_hora.map((h) => [h.hora, h.reservas]),
    );
    const horas = [...porHora.keys(), 6, 22];
    for (let h = Math.min(...horas); h <= Math.max(...horas); h++) {
      colunasHora.push({
        rotulo: String(h).padStart(2, "0"),
        valor: porHora.get(h) || 0,
      });
    }
  }

  const colunasDia = relatorio
    ? DIAS_SEMANA.map((nome, i) => ({
        rotulo: nome,
        valor:
          relatorio.por_dia_semana.find((d) => d.dia_semana === i)?.reservas ||
          0,
      }))
    : [];

  const resumo = relatorio?.resumo;

  return (
    <main className="gestao">
      <h1>Relatórios</h1>
      <p className="gestao-sub">
        Uso e ocupação dos espaços. Os cálculos consideram só as reservas
        aprovadas.
      </p>

      <section className="gestao-cartao">
        <form className="rel-periodo" onSubmit={atualizar}>
          <div className="gestao-campo">
            <label htmlFor="inicio">De</label>
            <input
              id="inicio"
              name="inicio"
              type="date"
              value={periodo.inicio}
              max={periodo.fim}
              onChange={mudarPeriodo}
              required
            />
          </div>
          <div className="gestao-campo">
            <label htmlFor="fim">Até</label>
            <input
              id="fim"
              name="fim"
              type="date"
              value={periodo.fim}
              min={periodo.inicio}
              onChange={mudarPeriodo}
              required
            />
          </div>
          <button type="submit" className="gestao-botao" disabled={carregando}>
            <RefreshCw size={16} />
            {carregando ? "Carregando..." : "Atualizar"}
          </button>
        </form>
      </section>

      {erro && (
        <p className="gestao-mensagem erro" role="alert">
          {erro}
        </p>
      )}

      {relatorio && (
        <>
          <p className="rel-nota">
            Período: {formatarData(relatorio.periodo.inicio)} a{" "}
            {formatarData(relatorio.periodo.fim)} ({relatorio.periodo.dias}{" "}
            dias)
          </p>

          <div className="rel-numeros">
            <div className="rel-numero">
              <span>Taxa de ocupação</span>
              <strong>{formatarPorcentagem(resumo.taxa_ocupacao)}</strong>
              <small>horas usadas ÷ horas disponíveis</small>
            </div>
            <div className="rel-numero">
              <span>Horas de uso</span>
              <strong>{formatarHoras(resumo.horas_uso)}</strong>
              <small>
                de {formatarHoras(resumo.horas_disponiveis)} disponíveis
              </small>
            </div>
            <div className="rel-numero">
              <span>Reservas aprovadas</span>
              <strong>{resumo.reservas_por_status.APPROVED}</strong>
              <small>{resumo.reservas_por_status.PENDING} pendentes</small>
            </div>
            <div className="rel-numero">
              <span>Recusadas / canceladas</span>
              <strong>
                {resumo.reservas_por_status.REJECTED +
                  resumo.reservas_por_status.CANCELLED}
              </strong>
              <small>
                {resumo.reservas_por_status.REJECTED} recusadas ·{" "}
                {resumo.reservas_por_status.CANCELLED} canceladas
              </small>
            </div>
          </div>

          <section className="gestao-cartao">
            <h2>Ocupação por espaço</h2>
            {relatorio.por_espaco.length === 0 ? (
              <p className="gestao-aviso">Nenhum espaço cadastrado.</p>
            ) : (
              <div className="gestao-tabela-caixa">
                <table className="gestao-tabela">
                  <thead>
                    <tr>
                      <th>Espaço</th>
                      <th>Reservas</th>
                      <th>Horas de uso</th>
                      <th>Horas disponíveis</th>
                      <th>Taxa de ocupação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...relatorio.por_espaco]
                      .sort(
                        (a, b) =>
                          (b.taxa_ocupacao ?? -1) - (a.taxa_ocupacao ?? -1),
                      )
                      .map((e) => (
                        <tr key={e.space_id}>
                          <td>
                            <strong>{e.name}</strong>
                          </td>
                          <td>{e.reservas}</td>
                          <td>{formatarHoras(e.horas_uso)}</td>
                          <td className="suave">
                            {formatarHoras(e.horas_disponiveis)}
                          </td>
                          <td>
                            {e.taxa_ocupacao === null ? (
                              <span className="suave">
                                sem horários cadastrados
                              </span>
                            ) : (
                              <div className="rel-barra">
                                <div className="rel-barra-fundo">
                                  <span
                                    className="rel-barra-valor"
                                    style={{ width: `${e.taxa_ocupacao}%` }}
                                  />
                                </div>
                                <b>{formatarPorcentagem(e.taxa_ocupacao)}</b>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="rel-duas">
            <section className="gestao-cartao">
              <h2>Horários de pico</h2>
              <Colunas itens={colunasHora} />
              <p className="rel-nota">
                Quantidade de reservas aprovadas que ocupam cada hora do dia.
              </p>
            </section>

            <section className="gestao-cartao">
              <h2>Dias da semana</h2>
              <Colunas itens={colunasDia} />
              <p className="rel-nota">Reservas aprovadas por dia da semana.</p>
            </section>
          </div>

          <section className="gestao-cartao">
            <h2>Perfil dos solicitantes</h2>
            {relatorio.por_empresa.length === 0 ? (
              <p className="gestao-aviso">
                Nenhuma reserva aprovada no período.
              </p>
            ) : (
              <div className="gestao-tabela-caixa">
                <table className="gestao-tabela">
                  <thead>
                    <tr>
                      <th>Solicitante</th>
                      <th>Tipo</th>
                      <th>Reservas</th>
                      <th>Horas de uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.por_empresa.map((e) => (
                      <tr key={`${e.tipo}-${e.nome}`}>
                        <td>
                          <strong>{e.nome}</strong>
                        </td>
                        <td className="suave">
                          {e.tipo === "EMPRESA" ? "Empresa" : "Pessoa física"}
                        </td>
                        <td>{e.reservas}</td>
                        <td>{formatarHoras(e.horas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="rel-nota">
              As reservas de pessoas físicas aparecem somadas numa única linha.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

export default Relatorios;
