// =====================================================================
// CARTAO DO QR CODE DO CLIENTE (abre em "minhas reservas")
// quando a reserva é aprovada, o banco cria um codigo unico pra ela (qr_token)
// aqui eu busco esse codigo no back e desenho ele como qr code
// o cliente mostra isso na recepçao e a recepçao le na tela de check-in
// recebe da tela de minhas reservas:
//   reservaId -> qual reserva abrir
//   onFechar  -> funçao pra fechar o cartao
// =====================================================================

import { useEffect, useState } from 'react';
// biblioteca que transforma um texto em desenho de qr code (svg)
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';
// funçao do enzo que ja coloca o token e trata o login vencido
import { chamarApi } from '../utils/api';
import '../css/qrcode.css';

// o back manda tipo "2026-11-26T14:30" ja no horario de brasilia, entao so separo
function dataBonita(texto) {
  if (!texto) return '';
  const [data, hora] = texto.split('T');
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano} às ${hora}`;
}

// cartao que abre por cima da tela de minhas reservas mostrando o qr code
// o cliente mostra isso no celular pra recepcao ler na tela de check-in
function QrCodeReserva({ reservaId, onFechar }) {
  const [qr, setQr] = useState(null); // dados que voltam do back (codigo, sala, horario, entrada/saida)
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false); // troca o icone pra um "check" por 2 segundos

  // busca o codigo da reserva assim que abre (GET /reservas/:id/qrcode)
  // o back so devolve se a reserva for de quem ta logado e se ja tiver aprovada
  useEffect(() => {
    let ativo = true;
    chamarApi(`/reservas/${reservaId}/qrcode`)
      .then(({ ok, dados }) => {
        if (!ativo) return;
        if (ok) setQr(dados);
        else setErro(dados?.erro || 'Não foi possível carregar o QR Code.');
      })
      .catch(() => ativo && setErro('Não foi possível conectar ao servidor.'));
    return () => {
      ativo = false;
    };
  }, [reservaId]);

  // fecha no esc tambem
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);

  // copia o codigo, serve se o leitor da recepcao nao funcionar ai ela digita
  async function copiar() {
    try {
      await navigator.clipboard.writeText(qr.qr_token);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // se o navegador nao deixar copiar, o codigo ta escrito embaixo do qr mesmo
    }
  }

  return (
    // clicar fora do cartao fecha
    <div className="qr-overlay" onClick={onFechar}>
      <div className="qr-card" role="dialog" aria-modal="true" aria-label="QR Code da reserva" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qr-fechar" aria-label="Fechar" onClick={onFechar}>
          <X size={18} />
        </button>

        {!qr && !erro && <p className="qr-aviso">Carregando QR Code...</p>}
        {erro && <p className="qr-erro" role="alert">{erro}</p>}

        {qr && (
          <>
            <h2>{qr.space_name}</h2>
            <p className="qr-horario">
              {dataBonita(qr.start_datetime)} até {qr.end_datetime.split('T')[1]}
            </p>

            {/* fundo branco sempre, senao no tema escuro o leitor nao consegue ler */}
            <div className="qr-imagem">
              <QRCodeSVG value={qr.qr_token} size={220} level="M" marginSize={2} />
            </div>

            {qr.checkout_at ? (
              <p className="qr-situacao ok">Uso concluído: entrada {qr.checkin_at.split('T')[1]} · saída {qr.checkout_at.split('T')[1]}</p>
            ) : qr.checkin_at ? (
              <p className="qr-situacao ok">Entrada registrada às {qr.checkin_at.split('T')[1]}</p>
            ) : (
              <p className="qr-dica">Mostre este QR Code na recepção. A entrada é liberada 30 minutos antes do horário.</p>
            )}

            <button type="button" className="qr-codigo" onClick={copiar} title="Copiar código">
              <span>{qr.qr_token}</span>
              {copiado ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default QrCodeReserva;
