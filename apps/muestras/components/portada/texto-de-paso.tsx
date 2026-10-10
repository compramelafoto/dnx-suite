import Image from "next/image";

const FOTORANK = "{FOTORANK}";

/** Un ítem de la portada: `{FOTORANK}` se reemplaza por el logo de FotoRank, en blanco y negro, con enlace. */
// La imagen va como bloque: así el enlace no suma el espacio de la línea y su borde de abajo
// queda en `vertical-align`. En el logo, la base de la palabra está al 79 % del alto (76 de 96 px):
// bajarlo 0,27em (1,3em × 21 %) apoya "Fotorank" en la misma línea que el texto.
export function TextoDePaso({ texto }: { texto: string }) {
  if (!texto.includes(FOTORANK)) return texto;
  const [antes, despues] = texto.split(FOTORANK);
  return (
    <>
      {antes}
      <a
        href="https://fotorank.dnxsuite.com/"
        target="_blank"
        rel="noopener"
        className="mx-0.5 inline-block align-[-0.27em] opacity-90 transition-opacity hover:opacity-100"
      >
        <Image src="/brand/fotorank-bn.webp" alt="FotoRank" width={449} height={96} className="block h-[1.3em] w-auto" />
      </a>
      {despues}
    </>
  );
}
