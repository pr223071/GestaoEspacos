const express = require("express");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const router = express.Router();
const {
  verificarToken,
  exigirRole,
  somenteAdminAltera,
  recepcaoSoClientes,
} = require("../middleware/auth");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Gestão de Espaços",
      version: "1.0.0",
      description: "CRUD de empresas, espaços, reservas e usuários",
    },
    servers: [{ url: "http://localhost:3080" }],
  },
  apis: [
    path.resolve(__dirname, "./empresasRoutes.js"),
    path.resolve(__dirname, "./reservasRoutes.js"),
    path.resolve(__dirname, "./clientsRoutes.js"),
    path.resolve(__dirname, "./espacosRoutes.js"),
    path.resolve(__dirname, "./disponibilidadesRoutes.js"),
    path.resolve(__dirname, "./bloqueiosRoutes.js"),
    path.resolve(__dirname, "./notificacoesRoutes.js"),
    path.resolve(__dirname, "./checkinsRoutes.js"),
    path.resolve(__dirname, "./loginRoutes.js"),
    path.resolve(__dirname, "./historicoRoutes.js"),
    path.resolve(__dirname, "./reservasEquipamentosRoutes.js"),
    path.resolve(__dirname, "./relatoriosRoutes.js"),
  ],
});

router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
router.get("/docs.json", (req, res) => res.json(swaggerSpec));
// ---------------------------------------------------------------
// MIDDLEWARE DE AUTENTICAÇÃO / PERFIL
// /docs e /login ficam acima (ou abaixo) e são PÚBLICOS; o resto exige token.
// ADMIN = tudo | CLIENT = reservar e consultar | RECEPTION = check-in/out
// ---------------------------------------------------------------
router.use("/login", require("./loginRoutes")); // público (é onde se gera o token)

// ---------------------------------------------------------------
// CADASTRO PÚBLICO (tela de signup do front)
// ---------------------------------------------------------------
const clientsRoutes = require("./clientsRoutes");

// POST /clients sem token = alguém se cadastrando pela tela de signup.
// usa a MESMA rota de criação de cliente, mas força role CLIENT
// (assim ninguém consegue se cadastrar como ADMIN/RECEPTION).
// com token, segue o fluxo normal lá embaixo (só ADMIN).
router.post("/clients", (req, res, next) => {
  const cabecalho = req.headers.authorization || req.headers.tokenorization || "";
  if (cabecalho.startsWith("Bearer ")) return next();
  req.body = { ...req.body, role: "CLIENT" };
  clientsRoutes(req, res, next);
});

router.use(verificarToken); // daqui para baixo: precisa estar logado

router.use("/empresas", somenteAdminAltera, require("./empresasRoutes"));
router.use(
  "/disponibilidades",
  somenteAdminAltera,
  require("./disponibilidadesRoutes"),
);
// bloqueios: todo mundo vê, ADMIN e RECEPTION criam, editam e removem
router.use(
  "/bloqueios",
  (req, res, next) => (req.method === "GET" ? next() : exigirRole("ADMIN", "RECEPTION")(req, res, next)),
  require("./bloqueiosRoutes"),
);
// espaços: todo mundo vê; ADMIN e RECEPTION cadastram e editam (sala, horários e equipamentos); apagar só ADMIN
router.use("/spaces", (req, res, next) =>
  req.method === "POST" || req.method === "PUT"
    ? exigirRole("ADMIN", "RECEPTION")(req, res, next)
    : somenteAdminAltera(req, res, next),
);
// equipamentos: todo mundo ve, mas so ADMIN ou RECEPTION cadastra, edita e apaga
router.use("/reservas-equipamentos/equipamentos", (req, res, next) =>
  req.method === "GET" ? next() : exigirRole("ADMIN", "RECEPTION")(req, res, next),
);
// gestão de usuários: ADMIN tudo; RECEPTION só mexe em clientes
router.use("/clients", exigirRole("ADMIN", "RECEPTION"), recepcaoSoClientes);
// relatórios de ocupação: ADMIN e RECEPTION
router.use("/relatorios", exigirRole("ADMIN", "RECEPTION"), require("./relatoriosRoutes"));
router.use("/historico", exigirRole("ADMIN", "RECEPTION"));
router.use("/checkins", exigirRole("ADMIN", "RECEPTION"));

// liberadas para qualquer perfil logado
router.use("/reservas", require("./reservasRoutes"));
router.use("/notificacoes", require("./notificacoesRoutes"));
router.use("/reservas-equipamentos", require("./reservasEquipamentosRoutes"));
router.use("/historico", require("./historicoRoutes"));
router.use("/checkins", require("./checkinsRoutes"));
router.use(clientsRoutes);
router.use(require("./espacosRoutes"));

module.exports = router;
