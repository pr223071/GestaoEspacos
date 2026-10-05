const express = require("express");
const app = express();

app.use(express.json());

// Rotas da API + Swagger
app.use(require("./index"));

// Página inicial: leva para a documentação Swagger
app.get("/", function(req, res) {
    res.redirect("/docs");
});

// Rota que não existe: responde 404 em JSON
app.use(function(req, res) {
    res.status(404).json({ erro: "Rota não encontrada: " + req.method + " " + req.url });
});

app.listen(3080, function() {
    console.log("Servidor rodando em http://localhost:3080");
    console.log("Documentação Swagger em http://localhost:3080/docs");
});
