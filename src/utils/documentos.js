// =====================================================================
// Validação de CPF e CNPJ pelos dígitos verificadores (recebem só números) - Paulo
//
// Os 2 últimos números de um CPF/CNPJ não são aleatórios: eles são CALCULADOS
// a partir dos outros números. Se alguém digitar um número errado, a conta não
// bate e o documento é recusado. Ex.: 529.982.247-25 é válido, 529.982.247-26 não.
// (Isso não confere se o CPF/CNPJ existe na Receita, só se ele é matematicamente válido.)
// =====================================================================

// calcula um dígito verificador: multiplica cada número pelo peso, soma e tira o resto de 11
// regra oficial: se o resto for 0 ou 1, o dígito é 0; senão o dígito é 11 - resto
function digito(numeros, pesos) {
    const soma = numeros.split("").reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

// CPF: 9 números + 2 dígitos verificadores
function cpfValido(cpf) {
    // precisa ter 11 números e não pode ser tudo igual (111.111.111-11 passaria na conta, mas é inválido)
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    const d1 = digito(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);         // 1º dígito: usa os 9 primeiros números
    const d2 = digito(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);    // 2º dígito: usa os 9 + o 1º dígito
    return cpf === cpf.slice(0, 9) + d1 + d2;                                 // os dígitos calculados batem com os digitados?
}

// CNPJ: 12 números + 2 dígitos verificadores (mesma ideia do CPF, só mudam os pesos)
function cnpjValido(cnpj) {
    // precisa ter 14 números e não pode ser tudo igual (11.111.111/1111-11)
    if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
    const d1 = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);       // 1º dígito: usa os 12 primeiros
    const d2 = digito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);    // 2º dígito: usa os 12 + o 1º dígito
    return cnpj === cnpj.slice(0, 12) + d1 + d2;
}

module.exports = { cpfValido, cnpjValido };
