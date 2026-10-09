import Link from "next/link";
import { getUsuario } from "@/lib/usuario";

const enlace = "rounded-md px-2 py-1 hover:bg-[var(--mf-bg)]";

/**
 * Encabezado común a todas las páginas. Lee la sesión, así que vuelve dinámicas las páginas
 * que lo usan: es el precio de mostrar "Mis muestras" y "Salir" a quien entró.
 */
export async function Encabezado() {
  const usuario = await getUsuario();
  return (
    <header className="border-b border-[var(--mf-line)] bg-[var(--mf-surface)]">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm sm:px-8">
        <Link href="/" className="mr-auto font-[family-name:var(--mf-serif)] text-lg">Muestras Fotográficas</Link>
        <Link href="/proponer" className={enlace}>Proponé tu muestra</Link>
        {usuario ? (
          <>
            <Link href="/mis-muestras" className={enlace}>Mis muestras</Link>
            {usuario.esSuperAdmin ? <Link href="/admin" className={enlace}>Revisión</Link> : null}
            <form method="post" action="/api/auth/logout">
              <button type="submit" className={`${enlace} text-[var(--mf-muted)]`}>Salir</button>
            </form>
          </>
        ) : (
          <Link href="/login" className={enlace}>Ingresar</Link>
        )}
      </nav>
    </header>
  );
}
