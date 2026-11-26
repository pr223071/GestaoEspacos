// =====================================================================
// validacao de cpf e cnpj pelos digitos verificadores (recebem so numeros) - paulo
//
// os 2 ultimos numeros de um cpf/cnpj nao sao aleatorios: eles sao calculados
// a partir dos outros numeros. se alguem digitar um numero errado, a conta nao
// bate e o documento e recusado. ex.: 529.982.247-25 e valido, 529.982.247-26 nao
// (isso nao confere se o cpf/cnpj existe na receita, so se ele e matematicamente valido.)
// =====================================================================

// calcula um digito verificador: multiplica cada numero pelo peso, soma e tira o resto de 11
// regra oficial: se o resto for 0 ou 1, o digito e 0; senao o digito e 11 - resto
function digito(numeros, pesos) {
    const soma = numeros.split("").reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

// cpf: 9 numeros + 2 digitos verificadores
function cpfValido(cpf) {
    // precisa ter 11 numeros e nao pode ser tudo igual (111.111.111-11 passaria na conta, mas e invalido)
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    const d1 = digito(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);         // primeiro digito: usa os 9 primeiros numeros
    const d2 = digito(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);    // segundo digito: usa os 9 + o primeiro digito
    return cpf === cpf.slice(0, 9) + d1 + d2;                                 // os digitos calculados batem com os digitados?
}

// cnpj: 12 numeros + 2 digitos verificadores (mesma ideia do cpf, so mudam os pesos)
function cnpjValido(cnpj) {
    // precisa ter 14 numeros e nao pode ser tudo igual (11.111.111/1111-11)
    if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
    const d1 = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);       // primeiro digito: usa os 12 primeiros
    const d2 = digito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);    // segundo digito: usa os 12 + o primeiro digito
    return cnpj === cnpj.slice(0, 12) + d1 + d2;
}

// deixa o e-mail minúsculo e sem espaços
function limparEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : email;
}

module.exports = { cpfValido, cnpjValido, limparEmail };
