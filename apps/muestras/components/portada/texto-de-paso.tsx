import Image from "next/image";

const FOTORANK = "{FOTORANK}";

/** Un ítem de la portada: `{FOTORANK}` se reemplaza por el logo de FotoRank, en blanco y negro, con enlace. */
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
        className="mx-0.5 inline-block align-[-0.3em] opacity-90 transition-opacity hover:opacity-100"
      >
        <Image src="/brand/fotorank-bn.webp" alt="FotoRank" width={449} height={96} className="inline h-[1.3em] w-auto" />
      </a>
      {despues}
    </>
  );
}
