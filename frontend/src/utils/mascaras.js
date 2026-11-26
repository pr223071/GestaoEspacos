// mascaras de cpf e telefone do cadastro

export function soNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

// 52998224725 -> 529.982.247-25
export function mascaraCpf(valor) {
  const n = soNumeros(valor).slice(0, 11);
  return n
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

// 48999999999 -> (48) 99999-9999   |   4833334444 -> (48) 3333-4444
export function mascaraTelefone(valor) {
  const n = soNumeros(valor).slice(0, 11);
  if (n.length <= 2) return n.length ? `(${n}` : '';
  const ddd = n.slice(0, 2);
  const resto = n.slice(2);
  // celular (9 numeros) separa 5-4, fixo (8 numeros) separa 4-4
  const corte = n.length === 11 ? 5 : 4;
  if (resto.length <= corte) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

// mesma conta do backend (digitos verificadores), para avisar antes de enviar
export function cpfValido(valor) {
  const cpf = soNumeros(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (numeros, pesoInicial) => {
    let soma = 0;
    for (let i = 0; i < numeros.length; i++) soma += Number(numeros[i]) * (pesoInicial - i);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(cpf.slice(0, 9), 10);
  const d2 = digito(cpf.slice(0, 10), 11);
  return cpf === cpf.slice(0, 9) + d1 + d2;
}
