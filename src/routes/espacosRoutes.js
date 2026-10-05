//REQUISIÇÕES DE TABELA ESPAÇOS

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs"); // biblioteca do node para ler e gravar arquivos

const arquivo = path.join(__dirname, "../db/spaces.json"); // caminho da tabela spaces (o "banco de dados")

// le a tabela spaces direto do arquivo, assim sempre pega a versão mais nova
function lerSpaces() {
    return JSON.parse(fs.readFileSync(arquivo, "utf-8")); // o arquivo vem como texto, o JSON.parse transforma em lista
}

// grava a tabela spaces no arquivo, assim a alteração não se perde quando o servidor reinicia
function salvarSpaces(spaces) {
    fs.writeFileSync(arquivo, JSON.stringify(spaces, null, 2)); // JSON.stringify transforma a lista em texto
}


/**
 * @swagger
 * tags:
 *   name: Espaços
 *   description: Cadastro de espaços (coworking, laboratórios, salas de reunião) - Danilo
 *
 * components:
 *   schemas:
 *     Space:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Sala de Coworking Principal
 *         type:
 *           type: string
 *           enum: [COWORKING, LAB, MEETING_ROOM]
 *           example: COWORKING
 *         capacity:
 *           type: integer
 *           example: 30
 *         description:
 *           type: string
 *           example: Espaco aberto com estacoes de trabalho compartilhadas e internet de alta velocidade
 *         is_active:
 *           type: boolean
 *           example: true
 *     SpaceInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Sala de Reuniao Nova
 *         type:
 *           type: string
 *           enum: [COWORKING, LAB, MEETING_ROOM]
 *           example: MEETING_ROOM
 *         capacity:
 *           type: integer
 *           example: 10
 *         description:
 *           type: string
 *           example: Sala com TV e mesa para reunioes
 *         is_active:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /spaces:
 *   get:
 *     summary: Retorna todos os espaços
 *     tags: [Espaços]
 *     responses:
 *       200:
 *         description: Lista completa de espaços
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Space'
 */
router.get("/spaces", function(req, res){
    const spaces = lerSpaces(); // le a tabela spaces do arquivo
    res.json(spaces); //retorna toda a tabela space
    //res = resposta
    //.json = usa a notação .json

});



/**
 * @swagger
 * /spaces:
 *   post:
 *     summary: Adiciona um espaço
 *     description: Grava o novo espaço na tabela spaces. O id é gerado pelo servidor.
 *     tags: [Espaços]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SpaceInput'
 *     responses:
 *       201:
 *         description: Espaço cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       400:
 *         description: Nome não informado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
// adiciona um espaço
router.post("/spaces", function(req, res){ //para por usuario, não é possivel uinserir pela url. O postman ou insomina fazem isso
    const {name, type, capacity, description, is_active} = req.body; //para ser pela url, seria o metodo get

    if(!name) return res.status(400).json({ erro: "O nome do espaço é obrigatório" }); // sem nome, retornar 400

    const spaces = lerSpaces();
    const novoId = spaces.length ? Math.max(...spaces.map(spc => spc.id)) + 1 : 1; // pega o maior id da tabela e soma 1

    const espaço = {
        id: novoId,
        name,
        type: type || "COWORKING", // se não mandar o type, fica como COWORKING
        capacity: capacity || null,
        description: description || "",
        is_active: is_active !== false // o espaço já começa ativo, só fica inativo se mandar false
    };

    spaces.push(espaço); // coloca o novo espaço na tabela
    salvarSpaces(spaces); // grava a tabela no arquivo

    res.status(201).json(espaço); // retorna o espaço salvo, com o status 201 (criado)
});
/*
para por no isnomia: body, no body, json

{
  "name": "Sala de Reuniao Nova",
  "type": "MEETING_ROOM",
  "capacity": 10
}

*/



/**
 * @swagger
 * /spaces/nome/{nome}:
 *   get:
 *     summary: Busca espaços pelo nome
 *     description: Busca parcial, ignorando maiúsculas e minúsculas.
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: reuniao
 *     responses:
 *       200:
 *         description: Espaços encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Space'
 *       404:
 *         description: Nenhum espaço encontrado com esse nome
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//procura espaços pelo nome (essa rota precisa ficar antes da "/spaces/:id")
router.get("/spaces/nome/:nome", function(req, res){
    const nome = req.params.nome.toLowerCase(); // o nome que veio na url, em letra minuscula
    const spaces = lerSpaces();
    const espaços = spaces.filter(spc => spc.name.toLowerCase().includes(nome)); // filtra todos os espaços que tem esse texto no nome

    if(espaços.length === 0) return res.status(404).json({ erro: "Nenhum espaço encontrado com esse nome" }); // lista vazia, retornar 404

    res.json(espaços); // retorna a lista de espaços encontrados
});


/**
 * @swagger
 * /spaces/{id}:
 *   get:
 *     summary: Busca um espaço pelo id
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Espaço encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       404:
 *         description: Espaço não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//procura um espaço pelo id
router.get("/spaces/:id", function(req, res){
    const { id } = req.params;
    const spaces = lerSpaces();
    const espaço = spaces.find(spc => spc.id === Number(id));


    if(!espaço) return res.status(404).json({ erro: "Espaço não encontrado" });

    res.json(espaço); // retorna a varivel espaço
});



/**
 * @swagger
 * /spaces/{id}:
 *   put:
 *     summary: Atualiza os dados de um espaço
 *     description: Só os campos enviados são alterados.
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SpaceInput'
 *     responses:
 *       200:
 *         description: Espaço atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       404:
 *         description: Espaço não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//atualiza um espaço
router.put("/spaces/:id", function(req, res){
    const { id } = req.params;
    const spaces = lerSpaces();
    const espaço = spaces.find(spc => spc.id === Number(id)); // epga um espaço rqueisitado e coloca na variavel espaço

    if(!espaço)  return res.status(404).json({ erro: "Espaço não encontrado" });

    const { name, type, capacity, description, is_active } = req.body; // pega os dados que o usuario manda

    // só troca o que foi mandado
    if(name) espaço.name = name; // na variavel name é colocado em name da vriavel de espaço
    if(type) espaço.type = type;
    if(capacity !== undefined) espaço.capacity = capacity;
    if(description !== undefined) espaço.description = description;
    if(is_active !== undefined) espaço.is_active = is_active;

    salvarSpaces(spaces); // grava a tabela no arquivo

    res.json(espaço); // retorna o espaço atualizado
});





/**
 * @swagger
 * /spaces/{id}:
 *   delete:
 *     summary: Remove um espaço
 *     description: Apaga o espaço da tabela spaces e retorna a lista dos espaços restantes.
 *     tags: [Espaços]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *     responses:
 *       200:
 *         description: Lista de espaços restantes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Space'
 *       404:
 *         description: Espaço não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
//deleta um espaço
router.delete("/spaces/:id", function(req, res){
    const { id } = req.params;
    const spaces = lerSpaces();
    const espaço = spaces.find(spc => spc.id === Number(id));

    if(!espaço) return res.status(404).json({ erro: "Espaço não encontrado" });

    const espaçosFiltrados = spaces.filter(spaces => spaces.id != Number(id)); // todos os espaços que forem diferentes do id passado

    salvarSpaces(espaçosFiltrados); // grava a lista sem o espaço, agora o delete apaga de verdade

    res.json(espaçosFiltrados);
});


// (rota inexistente é tratada no server.js)


module.exports = router;
