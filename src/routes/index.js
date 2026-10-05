const express = require("express");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const router = express.Router();

// DOCUMENTAÇÃO SWAGGER
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Gestão de Espaços",
            version: "1.0.0",
            description:
                "CRUD de empresas, espaços, reservas e usuários"
        },
        servers: [
            {
                url: "http://localhost:3080"
            }
        ]
    },

    apis: [
        path.resolve(__dirname, "./empresasRoutes.js"),
        path.resolve(__dirname, "./reservasRoutes.js"),
        path.resolve(__dirname, "./clientsRoutes.js"),
        path.resolve(__dirname, "./espacosRoutes.js"),
        path.resolve(__dirname, "./disponibilidadesRoutes.js")
    ]
});

router.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

router.get("/docs.json", (req, res) => {
    res.json(swaggerSpec);
});

// ROTAS DAS ENTIDADES
router.use("/empresas", require("./empresasRoutes"));
router.use("/reservas", require("./reservasRoutes"));
router.use("/disponibilidades", require("./disponibilidadesRoutes"));

// Nestes dois arquivos as rotas já são escritas com o caminho completo
// ("/clients", "/spaces"), então eles entram sem prefixo
router.use(require("./clientsRoutes"));
router.use(require("./espacosRoutes"));

module.exports = router;