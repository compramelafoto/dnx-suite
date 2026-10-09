import Image from "next/image";
import Link from "next/link";
import { getUsuario } from "@/lib/usuario";

const enlace = "rounded-[10px] px-2.5 py-1.5 text-[var(--mf-ink)] hover:bg-[var(--mf-surface)]";

/**
 * Encabezado común a todas las páginas. Lee la sesión, así que vuelve dinámicas las páginas
 * que lo usan: es el precio de mostrar "Mis muestras" y "Salir" a quien entró.
 */
export async function Encabezado() {
  const usuario = await getUsuario();
  return (
    <header className="border-b border-[var(--mf-line)] bg-[var(--mf-bg)]">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2.5 text-sm sm:px-8">
        <Link href="/" className="mr-auto flex items-center gap-2.5 rounded-[10px] py-1 pr-2">
          <Image src="/brand/muestras-logo.webp" alt="" width={36} height={36} priority className="size-9 mix-blend-multiply" />
          <span className="mf-titulo text-base sm:text-lg">Muestras Fotográficas</span>
        </Link>
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
