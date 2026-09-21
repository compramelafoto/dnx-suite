/**
 * Decorado navideño de la página de inscripción.
 *
 * Toma el vocabulario de la placa de la edición —muérdago, bayas y estrellas—
 * en vez de copos de nieve: la Navidad argentina cae en verano y la nieve sería
 * prestada. Los verdes y rojos son los apagados de la acuarela de la placa, no
 * el rojo-verde saturado de vidriera.
 *
 * Todo esto es ornamento: va detrás del contenido, no recibe clics y el lector
 * de pantalla no lo anuncia. Las ramas se recuestan contra los bordes, donde el
 * contenido deja aire, así que pueden ser bien visibles sin pisar el precio ni
 * el botón de reservar, que siempre van encima y sobre fondo propio.
 */

const VERDE = "#7d8f6b";
const ROJO = "#b5342c";
const AMARILLO = "#f4b740";

/** Ramita de muérdago: tres hojas y un racimo de bayas. */
function Muerdago({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={className}
      style={style}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M14 46c14-20 34-30 52-30-6 20-22 34-42 38-4 1-8-4-10-8Z"
        fill={VERDE}
        opacity="0.85"
      />
      <path
        d="M22 62c20-10 42-8 58 4-16 12-38 14-54 4-3-2-5-6-4-8Z"
        fill={VERDE}
        opacity="0.65"
      />
      <path
        d="M52 30c10-14 26-22 42-22-4 16-18 28-34 32-4 1-8-6-8-10Z"
        fill={VERDE}
        opacity="0.5"
      />
      <circle cx="30" cy="30" r="7" fill={ROJO} opacity="0.9" />
      <circle cx="44" cy="22" r="6" fill={ROJO} opacity="0.75" />
      <circle cx="38" cy="40" r="5" fill={ROJO} opacity="0.6" />
    </svg>
  );
}

/**
 * Fondo con bayas y estrellas repetidas. La opacidad del patrón es mínima:
 * se percibe como textura, no compite con el texto que va encima.
 */
function TexturaNavidena() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      aria-hidden
      focusable="false"
    >
      <defs>
        <pattern
          id="ck-navidad-textura"
          width="132"
          height="132"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(8)"
        >
          <circle cx="18" cy="22" r="3.5" fill={ROJO} />
          <circle cx="28" cy="30" r="2.5" fill={ROJO} opacity="0.7" />
          <path
            d="M84 16l2.6 6.4 6.4 2.6-6.4 2.6L84 34l-2.6-6.4L75 25l6.4-2.6Z"
            fill={AMARILLO}
          />
          <ellipse
            cx="52"
            cy="88"
            rx="15"
            ry="6"
            fill={VERDE}
            transform="rotate(-24 52 88)"
          />
          <ellipse
            cx="104"
            cy="102"
            rx="12"
            ry="5"
            fill={VERDE}
            opacity="0.8"
            transform="rotate(16 104 102)"
          />
          <circle cx="112" cy="70" r="3" fill={ROJO} opacity="0.8" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="url(#ck-navidad-textura)"
        opacity="0.22"
      />
    </svg>
  );
}

/**
 * Ramas repartidas a lo largo de la página.
 *
 * La página de inscripción mide varios miles de píxeles: poner adorno sólo en
 * las dos puntas deja todo el medio pelado. Cada rama se ancla a un porcentaje
 * del alto y se recuesta contra un borde, que es donde el contenido deja aire.
 *
 * Nada asoma con desplazamiento negativo: el contenedor recorta, y una rama
 * puesta afuera se recorta hasta desaparecer.
 */
const RAMAS = [
  { top: "1%", lado: "izq", ancho: "w-40 md:w-64", giro: "rotate-[-14deg]", opacidad: "opacity-90" },
  { top: "9%", lado: "der", ancho: "w-36 md:w-56", giro: "rotate-[12deg]", opacidad: "opacity-80" },
  { top: "26%", lado: "izq", ancho: "w-32 md:w-52", giro: "rotate-[165deg]", opacidad: "opacity-75" },
  { top: "41%", lado: "der", ancho: "w-40 md:w-60", giro: "rotate-[-8deg]", opacidad: "opacity-85" },
  { top: "58%", lado: "izq", ancho: "w-36 md:w-56", giro: "rotate-[18deg]", opacidad: "opacity-75" },
  { top: "74%", lado: "der", ancho: "w-32 md:w-52", giro: "rotate-[190deg]", opacidad: "opacity-80" },
  { top: "89%", lado: "izq", ancho: "w-40 md:w-60", giro: "rotate-[-20deg]", opacidad: "opacity-85" },
] as const;

/**
 * Envuelve el contenido de la página. El decorado se pinta detrás; los hijos
 * viajan en su propia capa para que nada quede tapado.
 */
export function DecoradoNavidad({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <TexturaNavidena />
        {RAMAS.map((rama, i) => (
          <Muerdago
            key={`${rama.top}-${rama.lado}`}
            className={[
              "absolute",
              rama.lado === "izq" ? "left-0" : "right-0",
              rama.lado === "der" ? "-scale-x-100" : "",
              rama.ancho,
              rama.giro,
              rama.opacidad,
              // A partir de la tercera, sólo en pantallas con margen de sobra.
              i >= 2 ? "hidden md:block" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ top: rama.top }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
