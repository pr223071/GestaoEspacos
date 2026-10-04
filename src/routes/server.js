const express = require("express");
const app = express();
const path = require("path");
const users = require("../db/users.json"); // define o caminho da rota do "banco de dados". Em caso de um banco real, seria uma conexão com banco de dados na web
const spaces = require("../db/spaces.json")
const reservas = require("../db/reservations.json")

app.use(express.json()); // o express precisa usar a notação json nesse caso (não temos banco de dado, só jsons)
app.use(express.static("public"));


//definido a rota pincipal
app.use(express.static(path.join(__dirname, "public")));
app.use(require("./index")); // rotas das entidades (empresas, ...) + documentação swagger em /docs
app.get("/", function(req, res){
    res.sendFile(path.join(__dirname, "public", "index.html"));
});



// verbos http
//GET, receber dados de um Resource. (clients)
//POST, enviar dados ou informações para serem processados por um resource. (clients)
//PUT, atualizar os dados de um resource. (clients)
//DELETE, deleter um resource. (clients)


//app.get("/clients");
//app.post("/clients");
//app.put("/clients");
//app.delete("/clients");


//http://localhost:3000/clients
//client é o end point, clients é o nome do meu resource


// app.get("/clients"); pega os clientes, para pegar um unico cliente use:
//app.get("/clients/:id"); isso vale para todos os verbos.