/**
 * Decorado estacional de la página de inscripción.
 *
 * Cada edición con temática aporta su motivo —muérdago y bayas en Navidad,
 * hojas caídas y bellotas en Otoño— sobre el mismo andamiaje: figuras
 * recostadas contra los bordes, donde el contenido deja aire, y una textura
 * tenue de fondo.
 *
 * Todo esto es ornamento: va detrás del contenido, no recibe clics y el lector
 * de pantalla no lo anuncia. Las figuras pueden ser bien visibles porque el
 * precio y el botón de reservar van encima y sobre fondo propio.
 *
 * Las estaciones toman prestado el amarillo de marca en vez de reemplazarlo:
 * así las ediciones se leen como una familia y no como sitios distintos.
 */

const AMARILLO = "#f4b740";

// Navidad: verdes y rojos apagados de acuarela, no el rojo-verde de vidriera.
const VERDE = "#7d8f6b";
const ROJO = "#b5342c";

// Otoño: ocres y tierras del lado cálido del amarillo de marca.
const NARANJA = "#c1622a";
const OXIDO = "#9b3a26";
const CARAMELO = "#8a5428";
const MIEL = "#b07830";

type FiguraProps = { className: string; style?: React.CSSProperties };

/** Ramita de muérdago: tres hojas y un racimo de bayas. */
function Muerdago({ className, style }: FiguraProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} style={style} fill="none" aria-hidden focusable="false">
      <path d="M14 46c14-20 34-30 52-30-6 20-22 34-42 38-4 1-8-4-10-8Z" fill={VERDE} opacity="0.85" />
      <path d="M22 62c20-10 42-8 58 4-16 12-38 14-54 4-3-2-5-6-4-8Z" fill={VERDE} opacity="0.65" />
      <path d="M52 30c10-14 26-22 42-22-4 16-18 28-34 32-4 1-8-6-8-10Z" fill={VERDE} opacity="0.5" />
      <circle cx="30" cy="30" r="7" fill={ROJO} opacity="0.9" />
      <circle cx="44" cy="22" r="6" fill={ROJO} opacity="0.75" />
      <circle cx="38" cy="40" r="5" fill={ROJO} opacity="0.6" />
    </svg>
  );
}

/** Rama de otoño: hoja de arce, hojas secas y una bellota. */
function RamaDeOtono({ className, style }: FiguraProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} style={style} fill="none" aria-hidden focusable="false">
      <path d="M8 14 78 58" stroke={CARAMELO} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      {/* Arce: cinco lóbulos, el central más alto */}
      <path
        d="M40 12 46 26 58 20 53 34 68 33 58 44 70 52 55 55 58 68 45 60 40 74 35 60 22 68 25 55 10 52 22 44 12 33 27 34 22 20 34 26Z"
        fill={OXIDO}
        opacity="0.9"
      />
      <ellipse cx="80" cy="50" rx="19" ry="8" fill={MIEL} transform="rotate(-28 80 50)" opacity="0.85" />
      <ellipse cx="58" cy="82" rx="16" ry="7" fill={NARANJA} transform="rotate(34 58 82)" opacity="0.8" />
      {/* Bellota */}
      <ellipse cx="98" cy="76" rx="9" ry="12" fill={MIEL} opacity="0.9" />
      <path d="M88 70h20l-3-7H91Z" fill={CARAMELO} />
      <path d="M98 63v-6" stroke={CARAMELO} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Textura tenue: se percibe como grano, no compite con el texto de encima. */
function Textura({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
      <defs>
        <pattern id={id} width="132" height="132" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
          {children}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.22" />
    </svg>
  );
}

function TexturaNavidena() {
  return (
    <Textura id="ck-navidad-textura">
      <circle cx="18" cy="22" r="3.5" fill={ROJO} />
      <circle cx="28" cy="30" r="2.5" fill={ROJO} opacity="0.7" />
      <path d="M84 16l2.6 6.4 6.4 2.6-6.4 2.6L84 34l-2.6-6.4L75 25l6.4-2.6Z" fill={AMARILLO} />
      <ellipse cx="52" cy="88" rx="15" ry="6" fill={VERDE} transform="rotate(-24 52 88)" />
      <ellipse cx="104" cy="102" rx="12" ry="5" fill={VERDE} opacity="0.8" transform="rotate(16 104 102)" />
      <circle cx="112" cy="70" r="3" fill={ROJO} opacity="0.8" />
    </Textura>
  );
}

function TexturaOtonal() {
  return (
    <Textura id="ck-otono-textura">
      <ellipse cx="20" cy="24" rx="13" ry="5" fill={NARANJA} transform="rotate(-32 20 24)" />
      <ellipse cx="96" cy="34" rx="11" ry="4.5" fill={MIEL} transform="rotate(22 96 34)" opacity="0.85" />
      <ellipse cx="56" cy="92" rx="14" ry="5.5" fill={OXIDO} transform="rotate(-14 56 92)" opacity="0.8" />
      <ellipse cx="114" cy="98" rx="10" ry="4" fill={CARAMELO} transform="rotate(40 114 98)" />
      <circle cx="70" cy="52" r="3.5" fill={MIEL} opacity="0.7" />
      <path d="M30 66l2.4 5.8 5.8 2.4-5.8 2.4L30 82l-2.4-5.8-5.8-2.4 5.8-2.4Z" fill={AMARILLO} opacity="0.6" />
    </Textura>
  );
}

/**
 * Figuras repartidas a lo largo de la página.
 *
 * La página de inscripción mide varios miles de píxeles: poner adorno sólo en
 * las dos puntas deja todo el medio pelado. Cada figura se ancla a un
 * porcentaje del alto y se recuesta contra un borde.
 *
 * Nada asoma con desplazamiento negativo: el contenedor recorta, y una figura
 * puesta afuera se recorta hasta desaparecer.
 */
const FIGURAS = [
  { top: "1%", lado: "izq", ancho: "w-40 md:w-64", giro: "rotate-[-14deg]", opacidad: "opacity-90" },
  { top: "9%", lado: "der", ancho: "w-36 md:w-56", giro: "rotate-[12deg]", opacidad: "opacity-80" },
  { top: "26%", lado: "izq", ancho: "w-32 md:w-52", giro: "rotate-[165deg]", opacidad: "opacity-75" },
  { top: "41%", lado: "der", ancho: "w-40 md:w-60", giro: "rotate-[-8deg]", opacidad: "opacity-85" },
  { top: "58%", lado: "izq", ancho: "w-36 md:w-56", giro: "rotate-[18deg]", opacidad: "opacity-75" },
  { top: "74%", lado: "der", ancho: "w-32 md:w-52", giro: "rotate-[190deg]", opacidad: "opacity-80" },
  { top: "89%", lado: "izq", ancho: "w-40 md:w-60", giro: "rotate-[-20deg]", opacidad: "opacity-85" },
] as const;

export const MOTIVOS = {
  navidad: { Figura: Muerdago, Textura: TexturaNavidena },
  otono: { Figura: RamaDeOtono, Textura: TexturaOtonal },
} as const;

export type MotivoEstacional = keyof typeof MOTIVOS;

/**
 * Envuelve el contenido de la página. El decorado se pinta detrás; los hijos
 * viajan en su propia capa para que nada quede tapado.
 */
export function DecoradoEstacional({
  motivo,
  children,
}: {
  motivo: MotivoEstacional;
  children: React.ReactNode;
}) {
  const { Figura, Textura: TexturaDelMotivo } = MOTIVOS[motivo];

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <TexturaDelMotivo />
        {FIGURAS.map((f, i) => (
          <Figura
            key={`${f.top}-${f.lado}`}
            className={[
              "absolute",
              f.lado === "izq" ? "left-0" : "right-0",
              f.lado === "der" ? "-scale-x-100" : "",
              f.ancho,
              f.giro,
              f.opacidad,
              // A partir de la tercera, sólo en pantallas con margen de sobra.
              i >= 2 ? "hidden md:block" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ top: f.top }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
