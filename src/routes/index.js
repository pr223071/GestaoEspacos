const express = require("express");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const router = express.Router();

// ROTAS DAS ENTIDADES
router.use("/empresas", require("./empresasRoutes"));
router.use("/reservas", require("./reservasRoutes"));

// Clientes e espaços
router.use("/", require("./clientsRoutes"));

// DOCUMENTAÇÃO SWAGGER
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Gestão de Espaços",
            version: "1.0.0",
            description:
                "CRUD de empresas, espaços, disponibilidades, reservas e usuários"
        },
        servers: [
            {
                url: "http://localhost:3080"
            }
        ]
    },

    apis: [
        path.join(__dirname, "*.js").replace(/\\/g, "/")
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

module.exports = router;