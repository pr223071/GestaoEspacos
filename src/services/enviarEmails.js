// =====================================================================
// ENVIO DE E-MAIL DAS NOTIFICAÇÕES - paulo
//
// como funciona:
//   o banco ja cria uma notificaçao sozinho (trigger) quando a reserva é criada,
//   aprovada, recusada ou cancelada. ela fica na tabela "notifications" com sent_at vazio
//   (vazio = ainda nao foi enviada, é tipo uma fila)
//
//   esse arquivo roda junto com o servidor e a cada 20 segundos:
//     1) pega as notificaçoes de e-mail que ainda nao foram enviadas
//     2) monta o e-mail (se for a de reserva APROVADA, coloca o QR code junto como imagem)
//     3) envia
//     4) marca como enviada (preenche o sent_at), ai nao manda de novo
//
// 2 jeitos de rodar:
//   - COM o arquivo .env.email preenchido (servidor smtp, tipo gmail) -> manda o e-mail de verdade
//   - SEM ele (modo teste) -> salva o e-mail como arquivo .eml na pasta "emails-teste"
//     da pra abrir esse arquivo no outlook/thunderbird/navegador e ver o e-mail igualzinho, com o qr
//     serve pra apresentar sem precisar de senha de e-mail nenhuma
//
// whatsapp e telegram ficam na fila (nao tem integraçao, precisaria de conta paga/bot)
// =====================================================================

const fs = require("fs");
const path = require("path");
// biblioteca que manda e-mail pelo node
const nodemailer = require("nodemailer");
// biblioteca que transforma o codigo do qr numa imagem png
const QRCode = require("qrcode");
const { pool } = require("../config/db");

// as configuraçoes do e-mail ficam num arquivo separado (.env.email) que NAO vai pro git,
// pq o .env normal ta no git e ai a senha do e-mail ia ficar publica
require("dotenv").config({ path: path.join(__dirname, "../../.env.email"), quiet: true });

const INTERVALO = 20 * 1000; // de quanto em quanto tempo olha a fila (20 segundos)
const POR_VEZ = 20; // quantos e-mails manda em cada rodada, no maximo
const PASTA_TESTE = path.join(__dirname, "../../emails-teste"); // onde salva no modo teste

// se tem SMTP_HOST no .env.email é modo de verdade, senao é modo teste
const modoReal = Boolean(process.env.SMTP_HOST);

// o "transporter" é quem efetivamente entrega o e-mail
// no modo real conecta no servidor smtp; no modo teste so gera o arquivo do e-mail (streamTransport)
const transporter = modoReal
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465, // porta 465 usa conexao segura direto
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "windows" });

const REMETENTE = process.env.EMAIL_FROM || process.env.SMTP_USER || "SGEC <nao-responda@sgec.edu.br>";

// troca < > & " por codigo html, pra mensagem nao quebrar o e-mail (e ninguem injetar html)
function escapar(texto) {
  return String(texto ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
}

// monta o corpo do e-mail em html (o que a pessoa ve) e em texto puro (pra quem nao abre html)
function montarCorpo(n, temQr) {
  const qrHtml = temQr
    ? `<p style="margin:24px 0 8px">Mostre este QR Code na recepção para registrar a sua entrada
         (liberada 30 minutos antes do horário):</p>
       <img src="cid:qrcode-reserva" alt="QR Code da reserva" width="220" height="220"
            style="border:1px solid #ddd;border-radius:8px;padding:8px;background:#fff" />
       <p style="font-family:monospace;font-size:12px;color:#555">Código: ${escapar(n.qr_token)}</p>
       <p style="font-size:13px;color:#555">Ele também fica em <b>Minhas Reservas → Ver QR Code</b> no sistema.</p>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222">
      <h2 style="margin-bottom:4px">SGEC · Gestão de Espaços</h2>
      <p>Olá, ${escapar(n.user_name)}!</p>
      <p>${escapar(n.message)}</p>
      ${qrHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="font-size:12px;color:#888">E-mail automático, não precisa responder.</p>
    </div>`;

  const texto =
    `Olá, ${n.user_name}!\n\n${n.message}\n` +
    (temQr ? `\nCódigo do QR Code da reserva: ${n.qr_token}\n(também fica em Minhas Reservas > Ver QR Code)\n` : "");

  return { html, texto };
}

// manda uma notificaçao e marca como enviada
async function enviarUma(n) {
  // so vai o qr se a notificaçao for a de aprovaçao e a reserva ainda estiver aprovada com codigo
  const temQr = Boolean(n.qr_token) && n.booking_status === "APPROVED" && /aprovad/i.test(n.subject);
  const { html, texto } = montarCorpo(n, temQr);

  const email = {
    from: REMETENTE,
    to: `"${n.user_name}" <${n.user_email}>`,
    subject: n.subject,
    text: texto,
    html,
    // a imagem do qr vai "anexada dentro" do e-mail (cid), ai aparece no meio do texto
    attachments: temQr
      ? [{ filename: "qrcode-reserva.png", content: await QRCode.toBuffer(n.qr_token, { width: 440, margin: 2 }), cid: "qrcode-reserva" }]
      : [],
  };

  const info = await transporter.sendMail(email);

  if (!modoReal) {
    // modo teste: salva o e-mail pronto num arquivo .eml (da pra abrir com dois cliques)
    fs.mkdirSync(PASTA_TESTE, { recursive: true });
    const arquivo = path.join(PASTA_TESTE, `notificacao-${n.id}.eml`);
    fs.writeFileSync(arquivo, info.message);
    console.log(`[e-mail teste] "${n.subject}" para ${n.user_email} -> emails-teste/notificacao-${n.id}.eml`);
  } else {
    console.log(`[e-mail] enviado "${n.subject}" para ${n.user_email}`);
  }

  // preenche o sent_at, ai ela sai da fila e a tela de notificaçoes mostra "enviada"
  await pool.query("UPDATE notifications SET sent_at = now() WHERE id = $1", [n.id]);
}

let rodando = false; // trava pra nao rodar 2 vezes ao mesmo tempo se uma rodada demorar

// uma rodada: pega a fila e manda tudo que da
async function processarFila() {
  if (rodando) return;
  rodando = true;
  try {
    // pega as pendentes de e-mail, a mais antiga primeiro, com os dados da pessoa e o qr da reserva (se tiver)
    const fila = await pool.query(
      `SELECT n.id::int AS id, n.subject, n.message, u.name AS user_name, u.email AS user_email,
              b.status AS booking_status, ck.qr_token
         FROM notifications n
         JOIN users u ON u.id = n.user_id
         LEFT JOIN bookings b ON b.id = n.booking_id
         LEFT JOIN checkins ck ON ck.booking_id = n.booking_id
        WHERE n.sent_at IS NULL AND n.channel = 'EMAIL'
        ORDER BY n.created_at, n.id
        LIMIT $1`,
      [POR_VEZ],
    );

    for (const n of fila.rows) {
      try {
        await enviarUma(n);
      } catch (err) {
        // se um e-mail der erro (endereço invalido, smtp fora do ar), ele continua na fila
        // e tenta de novo na proxima rodada; os outros seguem normal
        console.error(`[e-mail] falhou a notificação ${n.id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("[e-mail] erro ao ler a fila de notificações:", err.message);
  } finally {
    rodando = false;
  }
}

// chamado pelo server.js quando o servidor sobe
function iniciar() {
  console.log(
    modoReal
      ? `Envio de e-mail ligado (servidor ${process.env.SMTP_HOST})`
      : "Envio de e-mail em MODO TESTE: os e-mails são salvos na pasta emails-teste (crie o .env.email para enviar de verdade)",
  );
  processarFila(); // ja roda uma vez quando sobe
  setInterval(processarFila, INTERVALO).unref(); // unref: nao segura o node aberto quando for desligar
}

module.exports = { iniciar, processarFila };
