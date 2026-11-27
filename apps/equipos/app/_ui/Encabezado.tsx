import Link from "next/link";
import type { PortalUser } from "@/lib/guards";
import { EnlaceNav } from "./EnlaceNav";
import { MARCA } from "./marca";

const ENLACES = [
  { href: "/equipos", texto: "Ver equipos" },
  { href: "/mi-equipo", texto: "Mi equipo" },
  { href: "/mis-publicaciones", texto: "Mis publicaciones" },
  { href: "/consultar-serie", texto: "Consultar serie" },
];

/** Marca, menú y cuenta. El usuario llega desde el layout (`getPortalUser()`). */
export function Encabezado({ usuario }: { usuario: PortalUser | null }) {
  return (
    <header className="encabezado">
      <div className="encabezado-interior">
        <Link className="marca" href="/">
          <span className="marca-carta" aria-hidden="true" />
          {MARCA}
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
              <Link className="cuenta-nombre" href="/cuenta/verificacion" title="Mi verificación">
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
