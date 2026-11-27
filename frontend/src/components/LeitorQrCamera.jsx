// =====================================================================
// LEITOR DE QR CODE PELA CAMERA (usado na tela de check-in)
// abre a webcam do notebook, o cliente mostra o qr do celular na frente
// e assim que reconhece, devolve o codigo pra tela de check-in buscar a reserva
// recebe 2 coisas da tela de check-in:
//   onLer(codigo) -> chamado quando achou um qr
//   onFechar()    -> chamado quando fecha sem ler (X, esc ou clicando fora)
// =====================================================================

// useRef guarda o elemento <video> pra eu conseguir mexer nele direto
import { useEffect, useRef, useState } from 'react';
// biblioteca que olha uma imagem e acha o qr code dentro dela
import jsQR from 'jsqr';
import { X } from 'lucide-react';

// abre a camera (webcam do notebook) e fica procurando um qr code na imagem
// quando acha, manda o texto pro onLer e fecha
// usei o jsQR pq o BarcodeDetector do navegador nao funciona no chrome/edge do windows
function LeitorQrCamera({ onLer, onFechar }) {
  const videoRef = useRef(null); // o <video> que mostra a imagem da camera
  const [erro, setErro] = useState(''); // se a camera nao abrir, mostra o motivo

  // esse useEffect roda quando a janela abre: liga a camera e começa a procurar o qr
  useEffect(() => {
    let stream = null; // a "transmissao" da camera, guardo pra desligar depois
    let quadro = null; // id do requestAnimationFrame pra parar depois
    let ativo = true; // vira false quando fecha, ai para tudo
    // canvas invisivel, so uso pra tirar "print" do video e mandar pro jsQR
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // a cada quadro do video tira um "print", joga no canvas e pede pro jsQR procurar o qr
    function procurar() {
      const video = videoRef.current;
      if (!ativo || !video) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const achou = jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'dontInvert' });
        if (achou && achou.data.trim()) {
          ativo = false;
          onLer(achou.data.trim());
          return;
        }
      }
      quadro = requestAnimationFrame(procurar);
    }

    async function ligar() {
      // camera so funciona em localhost ou https, e o navegador precisa ter suporte
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Esse navegador não deixa usar a câmera. Use o leitor USB ou digite o código.');
        return;
      }
      try {
        // "environment" pede a camera de tras no celular; no notebook pega a webcam normal
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!ativo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        quadro = requestAnimationFrame(procurar);
      } catch (e) {
        if (!ativo) return;
        if (e.name === 'NotAllowedError') setErro('A permissão da câmera foi negada. Libere no cadeado da barra de endereço e tente de novo.');
        else if (e.name === 'NotFoundError') setErro('Nenhuma câmera encontrada nesse computador.');
        else setErro('Não foi possível abrir a câmera. Veja se outro programa não está usando ela.');
      }
    }

    ligar();

    // quando fecha: para de procurar e desliga a camera (senao a luzinha fica acesa)
    return () => {
      ativo = false;
      if (quadro) cancelAnimationFrame(quadro);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onLer]);

  // fecha no esc
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);

  return (
    <div className="camera-overlay" onClick={onFechar}>
      <div className="camera-card" role="dialog" aria-modal="true" aria-label="Ler QR Code com a câmera" onClick={(e) => e.stopPropagation()}>
        <div className="camera-topo">
          <h2>Ler QR Code</h2>
          <button type="button" className="camera-fechar" aria-label="Fechar câmera" onClick={onFechar}>
            <X size={18} />
          </button>
        </div>

        {erro ? (
          <p className="gestao-mensagem erro" role="alert">{erro}</p>
        ) : (
          <>
            <div className="camera-video">
              {/* muted e playsInline pq senao alguns navegadores nao deixam dar play sozinho */}
              <video ref={videoRef} muted playsInline />
              {/* quadradinho no meio so pra pessoa saber onde mirar */}
              <span className="camera-mira" />
            </div>
            <p className="gestao-aviso camera-dica">Peça pro cliente mostrar o QR Code do celular na frente da câmera.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default LeitorQrCamera;
