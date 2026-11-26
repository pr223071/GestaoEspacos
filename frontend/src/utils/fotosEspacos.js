function unsplash(id) {
  return `https://images.unsplash.com/${id}?w=800&q=75&auto=format&fit=crop`;
}

const FOTO_SALA_TV = unsplash('photo-1764810815228-b7f9432eec5c');
const FOTO_SALA_REUNIAO = unsplash('photo-1431540015161-0bf868a2d407');
const FOTO_ELETRONICA = unsplash('photo-1650530415027-dc9199f473ec');
const FOTO_LABORATORIO = unsplash('photo-1602052577122-f73b9710adba');

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const POR_NOME = {
  'sala de reuniao ipe': FOTO_SALA_TV,
  'sala de reuniao 1': FOTO_SALA_REUNIAO,
  'laboratorio de eletronica': FOTO_ELETRONICA,
  'laboratorio de quimica': FOTO_LABORATORIO,
};

export function fotoDoEspaco(nome, tipo) {
  const porNome = POR_NOME[normalizar(nome)];
  if (porNome) return porNome;

  const t = normalizar(tipo) + ' ' + normalizar(nome);
  if (t.includes('eletron')) return FOTO_ELETRONICA;
  if (t.includes('lab')) return FOTO_LABORATORIO;
  if (t.includes('reun') || t.includes('meeting')) return FOTO_SALA_REUNIAO;
  return null;
}
