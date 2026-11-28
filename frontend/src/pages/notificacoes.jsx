// =====================================================================
// TELA DE NOTIFICAÇÕES - paulo
// mostra os avisos que o sistema mandou pra pessoa sobre as reservas dela
// quem cria esses avisos é o proprio banco (trigger): quando a reserva é
// criada, aprovada, recusada ou cancelada ele grava uma notificaçao sozinho
// ai o back (src/services/enviarEmails.js) manda por e-mail e marca como enviada
//
// o que aparece aqui:
//   - aba "Minhas": as notificaçoes de quem ta logado (GET /notificacoes/minhas)
//   - aba "Todas do sistema": so pra recepçao e adm, ve a de todo mundo (GET /notificacoes)
//   em cada uma mostra se ja foi enviada por e-mail ou se ta na fila
// =====================================================================

import { useEffect, useState } from 'react';
// icones de cada tipo de aviso
import { Bell, CheckCircle2, XCircle, Clock, Ban, Mail, Hourglass } from 'lucide-react';
// funçao do enzo que ja coloca o token e manda pro login se ele vencer
import { chamarApi } from '../utils/api';
// reaproveito o visual das telas de gestao (titulo, abas, cartao, avisos)
import '../css/gestao.css';
import '../css/notificacoes.css';

// descobre o tipo do aviso pelo assunto pra escolher o icone e a cor
// o banco escreve tipo "Reserva #16 APROVADA", "Reserva #17 RECUSADA", etc
function tipoDoAviso(assunto) {
  const a = String(assunto).toUpperCase();
  if (a.includes('APROVADA')) return { icone: CheckCircle2, classe: 'ok' };
  if (a.includes('RECUSADA')) return { icone: XCircle, classe: 'erro' };
  if (a.includes('CANCELADA')) return { icone: Ban, classe: 'erro' };
  if (a.includes('RECEBIDA')) return { icone: Clock, classe: 'alerta' };
  return { icone: Bell, classe: '' }; // aviso manual que o adm mandou
}

// o banco manda a data em formato iso (utc), aqui deixo no formato brasileiro e no horario daqui
function dataBonita(texto) {
  if (!texto) return '';
  return new Date(texto).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function Notificacoes() {
  const [lista, setLista] = useState([]);
  const [aba, setAba] = useState('minhas'); // 'minhas' ou 'todas'
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // le o perfil de quem ta logado pra saber se mostra a aba "todas"
  const role = (() => {
    try {
      return String(JSON.parse(localStorage.getItem('usuario') || '{}').role || '').toUpperCase();
    } catch {
      return '';
    }
  })();
  const equipe = role === 'ADMIN' || role === 'RECEPTION';

  // busca de novo toda vez que troca de aba
  // o "ativo" evita mostrar a resposta de uma aba antiga se a pessoa trocar rapido
  useEffect(() => {
    let ativo = true;
    chamarApi(aba === 'todas' ? '/notificacoes' : '/notificacoes/minhas')
      .then(({ ok, dados }) => {
        if (!ativo) return;
        if (ok) {
          setLista(dados);
          setErro('');
        } else setErro(dados?.erro || 'Não foi possível carregar as notificações.');
      })
      .catch(() => ativo && setErro('Não foi possível conectar ao servidor.'))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [aba]);

  // troca de aba e ja mostra o "carregando"
  function trocarAba(nova) {
    if (nova === aba) return;
    setCarregando(true);
    setAba(nova);
  }

  return (
    <main className="gestao">
      <h1>Notificações</h1>
      <p className="gestao-sub">Avisos sobre as suas reservas. Eles também são enviados para o seu e-mail.</p>

      {/* a aba "todas" so aparece pra recepçao e adm */}
      {equipe && (
        <div className="gestao-abas">
          <button type="button" className={aba === 'minhas' ? 'gestao-aba ativa' : 'gestao-aba'} onClick={() => trocarAba('minhas')}>
            Minhas
          </button>
          <button type="button" className={aba === 'todas' ? 'gestao-aba ativa' : 'gestao-aba'} onClick={() => trocarAba('todas')}>
            Todas do sistema
          </button>
        </div>
      )}

      {erro && <p className="gestao-mensagem erro" role="alert">{erro}</p>}

      <section className="gestao-cartao">
        {carregando && <p className="gestao-aviso">Carregando notificações...</p>}

        {!carregando && !erro && lista.length === 0 && (
          <p className="gestao-aviso">Nenhuma notificação por enquanto. Quando você fizer uma reserva, os avisos aparecem aqui.</p>
        )}

        {!carregando && lista.length > 0 && (
          <ul className="notif-lista">
            {lista.map((n) => {
              const tipo = tipoDoAviso(n.subject);
              const Icone = tipo.icone; // componente do icone (precisa começar com maiuscula pro react)
              return (
                <li key={n.id} className="notif-item">
                  <span className={`notif-icone ${tipo.classe}`}>
                    <Icone size={18} />
                  </span>
                  <div className="notif-texto">
                    <div className="notif-topo">
                      <strong>{n.subject}</strong>
                      <time>{dataBonita(n.created_at)}</time>
                    </div>
                    <p>{n.message}</p>
                    <div className="notif-rodape">
                      {/* na aba "todas" mostra pra quem foi */}
                      {aba === 'todas' && <span>Para: {n.user_name}</span>}
                      {/* sent_at preenchido = o back ja mandou o e-mail; vazio = ainda ta na fila */}
                      {n.sent_at ? (
                        <span className="notif-enviada">
                          <Mail size={13} /> Enviada por e-mail em {dataBonita(n.sent_at)}
                        </span>
                      ) : (
                        <span className="notif-fila">
                          <Hourglass size={13} /> Na fila de envio
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default Notificacoes;
