
// Funções de apoio para as rotas que usam o PostgreSQL (empresas e disponibilidades) 
// Ficam num arquivo separado para não repetir o mesmo código nas duas rotas
// Transforma os erros do banco em respostas HTTP devolve null se não for um erro conhecido
// Por que isso existe: muitas regras estão no próprio banco (CNPJ único, horário sem
// sobreposição, espaço precisa existir quando uma regra e quebrada, o PostgreSQL
// recusa e manda um CÓDIGO de erro traduzimos esse codigo para o status HTTP
// certo, assim o usuário recebe 400/409 com uma mensagem clara em vez de 500
function erroDoBanco(err) {
    switch (err.code) {
        case "23505": return { status: 409, erro: "Registro duplicado: " + (err.detail || err.message) };    // UNIQUE
        case "23P01": return { status: 409, erro: "Conflito de horário com outro registro" };                   // EXCLUDE (sobreposição)
        case "23503": return { status: 400, erro: "Registro relacionado não existe ou ainda está em uso" };     // FOREIGN KEY
        case "23514": return { status: 400, erro: "Dados inválidos: " + err.message };                         // CHECK / triggers
        case "23502": return { status: 400, erro: "Campo obrigatório não informado: " + err.column };          // NOT NULL
        case "22P02":
        case "22007":
        case "22008": return { status: 400, erro: "Valor em formato inválido: " + err.message };               // tipo/data inválida
        default: return null;
    }
}

// responde o erro do banco com o status certo (409, 400...) ou 500 se for um erro inesperado
// (é chamada dentro do "catch" de todas as rotas)
function responderErro(res, err) {
    const problema = erroDoBanco(err);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });
    console.error(err); // erro inesperado: mostra no terminal para quem está desenvolvendo investigar
    res.status(500).json({ erro: "Erro interno no servidor" });
}


function semAcento(expressao) {
    return `translate(lower(${expressao}), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
}

module.exports = { responderErro, semAcento };
