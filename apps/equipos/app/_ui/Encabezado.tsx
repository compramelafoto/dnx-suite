import Link from "next/link";
import type { PortalUser } from "@/lib/guards";
import { EnlaceNav } from "./EnlaceNav";
import { MARCA } from "./marca";

const ENLACES = [
  { href: "/equipos", texto: "Ver equipos" },
  { href: "/busco", texto: "Busco" },
  { href: "/mi-equipo", texto: "Mi equipo" },
  { href: "/mis-publicaciones", texto: "Mis publicaciones" },
  { href: "/consultar-serie", texto: "Consultar serie" },
];

/** Marca, menú y cuenta. El usuario llega desde el layout (`getPortalUser()`). */
export function Encabezado({ usuario }: { usuario: PortalUser | null }) {
  return (
    <header className="encabezado">
      <div className="encabezado-interior">
        <Link className="marca" href="/" aria-label={MARCA}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático chico; next/image no aporta nada acá */}
          <img className="marca-icono" src="/brand/mercadofotoraw/icono.svg" alt="" width={32} height={32} />
          <span aria-hidden="true">
            MercadoFoto<span className="marca-raw">Raw</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Principal">
          <ul className="nav-lista">
            {ENLACES.map((e) => (
              <li key={e.href}>
                <EnlaceNav href={e.href}>{e.texto}</EnlaceNav>
              </li>
            ))}
          </ul>
        </nav>

        <div className="cuenta">
          {usuario ? (
            <>
              <Link className="cuenta-nombre" href="/cuenta" title="Mi cuenta">
                {usuario.displayName ?? usuario.email}
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="cuenta-salir">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="cuenta-ingresar" href="/login">
                Ingresar
              </Link>
              <Link className="boton boton-secundario" href="/crear-cuenta">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
