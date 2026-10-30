import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import '../css/espacos.css';

const API_URL = 'http://localhost:3080';

// O "type" vem do banco como um valor técnico (ex: "sala").
// Este objeto traduz para o texto que aparece na tela.
// Se o banco tiver outros tipos, é só acrescentar aqui.
const NOMES_TIPO = {
  sala: 'Sala de reunião',
  coworking: 'Coworking',
  laboratorio: 'Laboratório',
  auditorio: 'Auditório',
};

// devolve o nome bonito do tipo; se não estiver na lista, usa o valor do banco
function nomeDoTipo(tipo) {
  return NOMES_TIPO[tipo] || tipo;
}

// opções do filtro de capacidade: "pelo menos X pessoas"
const OPCOES_CAPACIDADE = [2, 5, 10, 20];

function Espacos() {
  const navigate = useNavigate();

  // dados vindos do backend
  const [espacos, setEspacos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // valores dos filtros (inputs controlados)
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');             // '' = todos
  const [capacidadeMin, setCapacidadeMin] = useState(''); // '' = qualquer

  // useEffect roda DEPOIS que a tela aparece.
  // O [] no final quer dizer: rode só uma vez, quando a página abrir.
  // Sem ele, rodaria a cada re-renderização e faria requisições sem parar.
  useEffect(() => {
    async function buscarEspacos() {
      try {
        const response = await fetch(`${API_URL}/spaces/status/true`, {
          // já manda o token; quando o middleware existir, a rota vai exigir isso
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        // token vencido ou inválido: desloga
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        // o backend responde 404 quando não tem nenhum espaço: não é erro,
        // é só uma lista vazia
        if (response.status === 404) {
          setEspacos([]);
          return;
        }

        if (!response.ok) {
          setErro('Não foi possível carregar os espaços');
          return;
        }

        const dados = await response.json();
        setEspacos(dados);
      } catch {
        setErro('Não foi possível conectar ao servidor');
      } finally {
        setCarregando(false);
      }
    }

    buscarEspacos();
  }, [navigate]);

  // LISTA DE TIPOS PARA O SELECT, montada a partir dos próprios espaços:
  // map pega só o type de cada um, new Set remove os repetidos,
  // e o [... ] transforma de volta em array
  const tipos = [...new Set(espacos.map((espaco) => espaco.type))];

  // ESPAÇOS FILTRADOS: não é um estado, é calculado a cada renderização
  // a partir da lista e dos filtros. Mudou um filtro -> re-renderiza -> recalcula.
  const espacosFiltrados = espacos.filter((espaco) => {
    const bateNome = espaco.name.toLowerCase().includes(busca.toLowerCase());
    const bateTipo = tipo === '' || espaco.type === tipo;
    const bateCapacidade = capacidadeMin === '' || espaco.capacity >= Number(capacidadeMin);
    return bateNome && bateTipo && bateCapacidade;
  });

  function reservar(espaco) {
    // a tela de reserva ainda não existe; quando existir, vai para ela
    // levando o id do espaço na URL
    navigate(`/reservas/nova/${espaco.id}`);
  }

  return (
    <main className="espacos">
      <h1>Espaços disponíveis</h1>

      {/* ===== FILTROS ===== */}
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

        <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo</option>
          {tipos.map((t) => (
            <option key={t} value={t}>{nomeDoTipo(t)}</option>
          ))}
        </select>

        <select
          aria-label="Capacidade"
          value={capacidadeMin}
          onChange={(e) => setCapacidadeMin(e.target.value)}
        >
          <option value="">Capacidade</option>
          {OPCOES_CAPACIDADE.map((n) => (
            <option key={n} value={n}>{n}+ pessoas</option>
          ))}
        </select>
      </div>

      {/* ===== ESTADOS DA TELA ===== */}
      {carregando && <p className="espacos-aviso">Carregando espaços...</p>}
      {erro && <p className="espacos-aviso erro" role="alert">{erro}</p>}

      {!carregando && !erro && espacosFiltrados.length === 0 && (
        <p className="espacos-aviso">Nenhum espaço encontrado.</p>
      )}

      {/* ===== GRADE DE CARDS ===== */}
      <section className="espacos-grade">
        {espacosFiltrados.map((espaco) => (
          <article key={espaco.id} className="espaco-card">
            {/* troque por uma foto real quando o banco tiver uma coluna de imagem */}
            <div className="espaco-foto" />

            <div className="espaco-info">
              <h2>{espaco.name}</h2>
              <p>Tipo: {nomeDoTipo(espaco.type)}</p>
              <p>Capacidade: {espaco.capacity}</p>

              <button className="espaco-botao" onClick={() => reservar(espaco)}>
                Reservar
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default Espacos;