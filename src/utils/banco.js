
// funcoes de apoio para as rotas que usam o postgresql (empresas e disponibilidades)
// ficam num arquivo separado para nao repetir o mesmo codigo nas duas rotas
// transforma os erros do banco em respostas http devolve null se nao for um erro conhecido
// por que isso existe: muitas regras estao no proprio banco (cnpj unico, horario sem
// sobreposicao, espaco precisa existir quando uma regra e quebrada, o postgresql
// recusa e manda um codigo de erro traduzimos esse codigo para o status http
// certo, assim o usuario recebe 400/409 com uma mensagem clara em vez de 500
function erroDoBanco(err) {
    switch (err.code) {
        case "23505": return { status: 409, erro: "Registro duplicado: " + (err.detail || err.message) };    // unique
        case "23P01": return { status: 409, erro: "Conflito de horário com outro registro" };                   // exclude (sobreposicao)
        case "23503": return { status: 400, erro: "Registro relacionado não existe ou ainda está em uso" };     // foreign key
        case "23514": return { status: 400, erro: "Dados inválidos: " + err.message };                         // check / triggers
        case "23502": return { status: 400, erro: "Campo obrigatório não informado: " + err.column };          // not null
        case "22P02":
        case "22007":
        case "22008": return { status: 400, erro: "Valor em formato inválido: " + err.message };               // tipo/data invalida
        default: return null;
    }
}

// responde o erro do banco com o status certo (409, 400...) ou 500 se for um erro inesperado
// (e chamada dentro do "catch" de todas as rotas)
function responderErro(res, err) {
    const problema = erroDoBanco(err);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });
    console.error(err); // erro inesperado: mostra no terminal para quem esta desenvolvendo investigar
    res.status(500).json({ erro: "Erro interno no servidor" });
}

// monta um pedaco de sql que deixa o texto minusculo e sem acento, usado nas buscas por nome
// lower deixa tudo minusculo e translate troca cada letra com acento pela letra sem acento (a com acento vira a, c com cedilha vira c)
// usamos nos dois lados da comparacao, assim "eletronica" acha "laboratorio de eletronica" com ou sem acento
function semAcento(expressao) {
    return `translate(lower(${expressao}), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
}

module.exports = { responderErro, semAcento };
