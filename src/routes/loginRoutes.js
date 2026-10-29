const express = require('express'); // importa o express
const { pool } = require("../config/db"); // cria uma intancia pra usar as funções do banco
const { responderErro } = require("../utils/banco");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");// biblioteca pra gerar o token


/**
 * @swagger
 * tags:
 *   - name: Autenticação
 *     description: Login de usuários
 *
 * components:
 *   schemas:
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           example: maria@email.com
 *         password:
 *           type: string
 *           example: "123456"
 *
 *     LoginResposta:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         usuario:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             name:
 *               type: string
 *               example: Maria Silva
 *             email:
 *               type: string
 *               example: maria@email.com
 *             role:
 *               type: string
 *               example: client
 */

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Faz login e retorna um token JWT
 *     description: Confere o e-mail e a senha. Se estiverem certos e o usuário estiver ativo, retorna um token que deve ser enviado no header Authorization das rotas protegidas.
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login realizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResposta'
 *       400:
 *         $ref: '#/components/responses/ErroValidacao'
 *       401:
 *         description: Senha incorreta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       403:
 *         description: Usuário desativado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         $ref: '#/components/responses/NaoEncontrado'
 *       500:
 *         $ref: '#/components/responses/ErroInterno'
 */

router.post("/", async function (req, res) {
    
    const {email, password} = req.body;

    if(!password || !email){
        return res.status(400).json({ erro: "todos os campos devem ser preenchidos"})    
    }

    try{

    const resultado = await pool.query(`SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = $1`, [email]);
    
        if (resultado.rowCount === 0){return res.status(404).json({ erro: "nenhum usuario encontrado"})}
        
    //verificar se o usuario esta ativo
    const usuario = resultado.rows[0];           
        if (!usuario.is_active) { return res.status(403).json({ erro: "usuário desativado" }); }



    //compara o hash com a senha digitada e retorna true ou false dentro da variável
    const senhaCorreta = await bcrypt.compare(password, usuario.password_hash);    

        if(!senhaCorreta){return res.status(401).json({ erro: "senha incorreta" })}
        

    //gera o token
    /*

        gera o token de autenticação de sessão do usuario

        ele recebe 2 argumentos dentro do token (chamado de payload), 
        o user pra saber quem é, e a role para saber oque ele pode fazer

        process.env.JTW_SECRET busca a chave que assina
        o token que esta no arquivo .env 

        expireIn é o tempo que o token/sessão dura
    
    */
    const token = jwt.sign(
        {id: usuario.id, role: usuario.role },
        process.env.JWT_SECRET,
        { expiresIn: "30s"}
        
    );


    // responde pro front(react) o token e o objs usuario 
    // contendo os dados do user

    return res.status(200).json({
        token: token,
        usuario:{
            id: usuario.id,
            name: usuario.name,
            role: usuario.role,
            email: usuario.email
        }
    });
    }
catch(err){
    responderErro(res, err);
}
});




module.exports = router;