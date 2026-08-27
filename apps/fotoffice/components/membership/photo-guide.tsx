/**
 * Esquema de encuadre para la foto carnet.
 *
 * Un dibujo evita la discusión que ninguna lista de requisitos resuelve: cuánto tiene que
 * ocupar la cara. "De frente y centrada" se cumple igual con un primer plano que con una foto
 * de cuerpo entero, y la segunda no sirve para imprimir una credencial.
 *
 * SVG inline y sin dependencias: es una imagen que tiene que verse en un formulario público,
 * cargar rápido y funcionar en claro y en oscuro.
 */
export function PhotoGuide() {
  return (
    <figure className="space-y-2">
      <svg
        viewBox="0 0 240 200"
        role="img"
        aria-labelledby="fotoGuiaTitulo fotoGuiaDesc"
        className="h-auto w-full max-w-[280px]"
      >
        <title id="fotoGuiaTitulo">Cómo encuadrar la foto carnet</title>
        <desc id="fotoGuiaDesc">
          Cuadro cuadrado con una silueta de frente. La cabeza ocupa entre el 70 y el 80 por
          ciento de la altura, con un margen por encima y los hombros apoyados en la base.
        </desc>

        {/* El cuadro: cuadrado, para que se lea la relación 1:1 de un vistazo. */}
        <rect
          x="20"
          y="10"
          width="180"
          height="180"
          rx="6"
          fill="var(--fo-bg, #fff)"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.85"
        />

        {/* La silueta se recorta contra el cuadro: los hombros llegan al borde inferior sin
            desbordarlo, que es exactamente lo que se busca mostrar. */}
        <defs>
          <clipPath id="fotoGuiaCuadro">
            <rect x="20" y="10" width="180" height="180" rx="6" />
          </clipPath>
        </defs>

        <g fill="currentColor" opacity="0.28" clipPath="url(#fotoGuiaCuadro)">
          {/* Hombros: apoyados en la base y cortados por el borde, como en toda foto carnet. */}
          <path d="M56 196 C56 160, 86 146, 110 146 C134 146, 164 160, 164 196 Z" />
          {/* Cuello */}
          <rect x="99" y="130" width="22" height="22" />
          {/* Cabeza: alta y angosta, la proporción real de una cara de frente. */}
          <ellipse cx="110" cy="92" rx="38" ry="52" />
        </g>

        {/* Guías de altura de la cabeza. */}
        <g stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" opacity="0.55">
          <line x1="20" y1="40" x2="200" y2="40" />
          <line x1="20" y1="144" x2="200" y2="144" />
        </g>

        {/* Cota: de la coronilla al mentón. */}
        <g stroke="currentColor" strokeWidth="1.5" opacity="0.75">
          <line x1="176" y1="40" x2="176" y2="144" />
          <path d="M172 45 L176 40 L180 45" fill="none" />
          <path d="M172 139 L176 144 L180 139" fill="none" />
        </g>

        {/* Margen superior. */}
        <g stroke="currentColor" strokeWidth="1.5" opacity="0.75">
          <line x1="44" y1="10" x2="44" y2="40" />
          <path d="M40 15 L44 10 L48 15" fill="none" />
          <path d="M40 35 L44 40 L48 35" fill="none" />
        </g>

        <g fill="currentColor" fontSize="10" opacity="0.75">
          <text x="50" y="28">margen</text>
          <text x="186" y="96" writingMode="tb" textAnchor="middle">
            70–80%
          </text>
        </g>
      </svg>

      <figcaption className="text-xs text-[var(--fo-muted)] leading-relaxed">
        La cabeza, de la coronilla al mentón, ocupa entre el 70 % y el 80 % de la altura. Dejá un
        margen por encima y que los hombros lleguen a la base.
      </figcaption>
    </figure>
  );
}
