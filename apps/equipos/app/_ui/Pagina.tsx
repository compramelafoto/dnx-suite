import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Contenedor de cada pantalla: título, bajada opcional y ancho de lectura
 * (`angosta` 640 px para formularios, `ancha` 1080 px para listados y fichas).
 */
export function Pagina({
  titulo,
  bajada,
  ancho = "angosta",
  volver,
  children,
}: {
  titulo: ReactNode;
  bajada?: ReactNode;
  ancho?: "angosta" | "ancha";
  /** Enlace para volver a la pantalla anterior, arriba del título. */
  volver?: { href: string; texto: string };
  children: ReactNode;
}) {
  return (
    <main id="contenido" className={ancho === "ancha" ? "pagina pagina-ancha" : "pagina pagina-angosta"}>
      {volver ? (
        <Link className="volver" href={volver.href}>
          ← {volver.texto}
        </Link>
      ) : null}
      <header className="pagina-cabecera">
        <h1>{titulo}</h1>
        {bajada ? <p className="pagina-bajada">{bajada}</p> : null}
      </header>
      {children}
    </main>
  );
}
