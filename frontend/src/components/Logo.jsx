// logo do SGEC: uma "estrela" de 8 traços com o centro vazio.
// usa currentColor, então fica branca no fundo preto e preta no fundo branco sozinha.
// (o mesmo desenho está em public/favicon.svg, que é o ícone da aba)
function Logo({ size = 120, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      aria-hidden="true"
    >
      {/* traços retos (cima, baixo, esquerda, direita) */}
      <line x1="50" y1="4" x2="50" y2="38" />
      <line x1="50" y1="62" x2="50" y2="96" />
      <line x1="4" y1="50" x2="38" y2="50" />
      <line x1="62" y1="50" x2="96" y2="50" />
      {/* traços na diagonal, mais curtos */}
      <line x1="25" y1="25" x2="40" y2="40" />
      <line x1="75" y1="25" x2="60" y2="40" />
      <line x1="25" y1="75" x2="40" y2="60" />
      <line x1="75" y1="75" x2="60" y2="60" />
    </svg>
  );
}

export default Logo;
