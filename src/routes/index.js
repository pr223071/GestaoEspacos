const express = require('express');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const router = express.Router();

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: { title: 'API Gestão de Espaços', version: '1.0.0', description: 'CRUD de empresas, espaços, reservas e usuários' },
        servers: [{ url: 'http://localhost:3080' }]
    },
    apis: [
        path.resolve(__dirname, './empresasRoutes.js'),
        path.resolve(__dirname, './reservasRoutes.js'),
        path.resolve(__dirname, './clientsRoutes.js'),
        path.resolve(__dirname, './espacosRoutes.js'),
        path.resolve(__dirname, './disponibilidadesRoutes.js'),
        path.resolve(__dirname, './bloqueiosRoutes.js'),
        path.resolve(__dirname, './loginRoutes.js')
    ]
});

router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
router.get('/docs.json', (req, res) => res.json(swaggerSpec));
router.use('/empresas', require('./empresasRoutes'));
router.use('/reservas', require('./reservasRoutes'));
router.use('/disponibilidades', require('./disponibilidadesRoutes'));
router.use('/bloqueios', require('./bloqueiosRoutes'));
router.use(require('./clientsRoutes'));
router.use(require('./espacosRoutes'));
router.use('/login', require('./loginRoutes'));

module.exports = router;
