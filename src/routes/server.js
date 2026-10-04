const express = require("express");
const app = express();
const path = require("path");

app.use(express.json());

// Front-end
app.use(express.static(path.join(__dirname, "public")));

// Rotas da API + Swagger
app.use(require("./index"));

// Página inicial
app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(3080, function() {
    console.log("Servidor rodando em http://localhost:3080");
});