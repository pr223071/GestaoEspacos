//REQUISIÇÕES DE TABELA USUARIOS


//reotorna toda a tabela de clientes
app.get("/clients", function(req, res){ //req (request,requisição) pega o res (response, resposta), tudo da biblioteca express
    res.json(users); // resposta (res) em json sobre a tabela users
}); 



//procura um cadastro de cliente pelo id
app.get("/clients/:id", function(req, res) {
    const { id } = req.params; //params são os paramnetros da requisção, nesse caso, é o id
    const client = users.find(cli => cli.id === Number(id)); // procure o client na tabela users q for igual a id e coloque na variael client e transfora em numero em vez de sting

    if(!client) return res.status(404).sendFile(path.join(__dirname, "public", "404.html")); // Caso n tenha o cliente, retornar 404

    res.json(client); //retorna client em json
});




//adiciona um cliente
app.post("/clients", function(req, res) {//mesmo ele usando o mesmo diretorio de retorno da tabela, ele entregaum resultado diferente por contado do "post" um verbo diferente
    const { name, email, role} = req.body; //quais as "colunas" podem ser adicionadas e salva


    res.json({name, email, role}); // retorna oq foi salvo em json
});


//atualiza um cliente
app.put("/clients/:id", function(req, res) {
    const { id } = req.params; 
    const client = users.find(cli => cli.id === Number(id)); 

    if(!client) return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));

    const { name } = req.body; //pegua o nome que o usuario manda

    client.name = name; //e define ele como client.name



    res.json(client); // responde o cliente atualizado
});



//deeleta um cliente
app.delete("/clients/:id", function(req, res) {
    const { id } = req.params; 
    const clientsFiltered = users.filter(client => client.id != Number(id)); // ele filtra os clients, e todos que forem diferentes do id que eu passei serão retornados na lista
                                                                               // seria um "delete" q n deleta, só oculta
    if(!clientsFiltered) return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));

    res.json(clientsFiltered); 
});











//REQUISIÇÕES DE TABELA ESPAÇOS

app.get("/spaces", function(req, res){
    res.json(spaces); //retorna toda a tabela space 
    //res = resposta
    //.json = usa a notação .json

});



// adiciona um espaço
app.post("/spaces", function(req, res){ //para por usuario, não é possivel uinserir pela url. O postman ou insomina fazem isso 
    const {name, type, capacity} = req.body; //para ser pela url, seria o metodo get

    res.json({name, type, capacity});
});
/*
para por no isnomia: body, no body, json

{
  "name": "yuogo",
  "type": 34,               
  "capacity": 23333
}

*/


//procura um espaço pelo id 
app.get("/spaces/:id", function(req, res){
    const { id } = req.params;
    const espaço = spaces.find(spc => spc.id === Number(id));


    if(!espaço) return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));

    res.json(espaço); // retorna a varivel espaço
});



//atualiza um espaço
app.put("/spaces/:id", function(req, res){
    const { id } = req.params;
    const espaço = spaces.find(spc => spc.id === Number(id)); // epga um espaço rqueisitado e coloca na variavel espaço

    if(!espaço)  return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));

    const { nome } = req.body; // só pede o nome

    espaço.name = nome; // na variavel nome é colocado em name da vriavel de espaço

    res.json(spaces); // retorna todo a tabela
});





//deleta um espaço
app.delete("/spaces/:id", function(req, res){
    const { id } = req.params;
    const espaçosFiltrados = spaces.filter(spaces => spaces.id != Number(id));

    if(!espaçosFiltrados) return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));

    res.json(espaçosFiltrados);
});








//TESTE DE RELACIONAMENTO DE TABELAS
/*
app.get("/data/clients/:id", function(req, res) {
    const { id } = req.params; 
    const client = users.find(cli => cli.id === Number(id)); 
    const clientResId = users.find(cli => cli.reserva_id === Number(reserva_id));
    const reserva = reservas.find()
    const dataClient = 

    if(!client) return res.status(404).sendFile(path.join(__dirname, "public", "404.html")); 

    res.json(client); 
});
*/


// erro 404
app.use(function (req, res) {  
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(3080, function(){
console.log("rodando na porta 3080");
});
