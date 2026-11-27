import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FOTOS, srcFoto, type NombreFoto } from "./fotos";

/**
 * Contenedor de cada pantalla: título, bajada opcional y ancho de lectura
 * (`angosta` 640 px para formularios, `ancha` 1080 px para listados y fichas).
 */
export function Pagina({
  titulo,
  bajada,
  ancho = "angosta",
  volver,
  foto,
  children,
}: {
  titulo: ReactNode;
  bajada?: ReactNode;
  ancho?: "angosta" | "ancha";
  /** Enlace para volver a la pantalla anterior, arriba del título. */
  volver?: { href: string; texto: string };
  /** Foto de fondo detrás del título, oscurecida para que el texto se lea. */
  foto?: NombreFoto;
  children: ReactNode;
}) {
  return (
    <main id="contenido" className={ancho === "ancha" ? "pagina pagina-ancha" : "pagina pagina-angosta"}>
      {volver ? (
        <Link className="volver" href={volver.href}>
          ← {volver.texto}
        </Link>
      ) : null}
      {foto ? (
        <header className="cabecera-foto">
          <Image src={srcFoto(foto)} alt={FOTOS[foto].alt} fill sizes="(min-width: 1128px) 1080px, 100vw" className="foto-cubre" />
          <div className="cabecera-foto-texto">
            <h1>{titulo}</h1>
            {bajada ? <p className="cabecera-foto-bajada">{bajada}</p> : null}
          </div>
        </header>
      ) : (
        <header className="pagina-cabecera">
          <h1>{titulo}</h1>
          {bajada ? <p className="pagina-bajada">{bajada}</p> : null}
        </header>
      )}
      {children}
    </main>
  );
}
