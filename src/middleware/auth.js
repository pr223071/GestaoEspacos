// src/middleware/token.js
// "Porteiros" da API. Rodam ANTES da rota e decidem se a requisição passa.
//   verificarToken  -> confere o JWT e descobre QUEM é (id + role)
//   exigirRole(...) -> confere se a role dessa pessoa pode usar a rota
const jwt = require("jsonwebtoken");

// mesmos valores do enum user_role do banco
const ROLES = ["ADMIN", "CLIENT", "RECEPTION"];

function verificarToken(req, res, next) {
  // o front manda:  tokenorization: Bearer <token>
  const cabecalho =
    req.headers.authorization || req.headers.tokenorization || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) {
    console.log(`[token] sem token em ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ erro: "Token ausente. Faça login." });
  }

  try {
    // se a assinatura for inválida ou o token tiver vencido o verify lança erro
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // normaliza para maiúsculo (ADMIN / CLIENT / RECEPTION)
    const role = String(payload.role || "").toUpperCase();
    req.usuario = { id: payload.id, role };

    if (role === "ADMIN")
      console.log(
        `[token] ADMIN (id ${payload.id}) -> ${req.method} ${req.originalUrl}`,
      );
    else if (role === "RECEPTION")
      console.log(
        `[token] RECEPTION (id ${payload.id}) -> ${req.method} ${req.originalUrl}`,
      );
    else if (role === "CLIENT")
      console.log(
        `[token] CLIENT (id ${payload.id}) -> ${req.method} ${req.originalUrl}`,
      );
    else {
      console.log(`[token] role desconhecida "${payload.role}"`);
      return res.status(403).json({ erro: "Perfil de usuário inválido." });
    }

    next(); // passou segue para a próxima etapa
  } catch (err) {
    console.log(
      `[token] token inválido/expirado (${err.name}) em ${req.method} ${req.originalUrl}`,
    );
    return res
      .status(401)
      .json({ erro: "Token inválido ou expirado. Faça login novamente." });
  }
}

// uso: exigirRole('ADMIN')  ou  exigirRole('ADMIN', 'RECEPTION')
// precisa vir DEPOIS do verificarToken (é ele que preenche req.usuario)
function exigirRole(...permitidas) {
  return function (req, res, next) {
    const role = req.usuario && req.usuario.role;

    if (!permitidas.includes(role)) {
      console.log(
        `[ROLE] ${role} bloqueado em ${req.method} ${req.originalUrl} (precisa ser: ${permitidas.join(" ou ")})`,
      );
      return res.status(403).json({
        erro: `Acesso negado. Perfil necessário: ${permitidas.join(" ou ")}.`,
      });
    }

    console.log(`[ROLE] ${role} liberado em ${req.method} ${req.originalUrl}`);
    next();
  };
}

// atalho: qualquer um logado LÊ (GET), mas só ADMIN altera (POST/PUT/PATCH/DELETE)
function somenteAdminAltera(req, res, next) {
  if (req.method === "GET") return next();
  return exigirRole("ADMIN")(req, res, next);
}

module.exports = { verificarToken, exigirRole, somenteAdminAltera, ROLES };
