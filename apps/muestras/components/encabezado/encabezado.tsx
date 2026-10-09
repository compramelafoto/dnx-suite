import Image from "next/image";
import Link from "next/link";
import { getUsuario } from "@/lib/usuario";
import { BarraEncabezado } from "./barra";

const enlace = "whitespace-nowrap px-1.5 py-1.5 underline-offset-[6px] hover:underline sm:px-2.5";

/**
 * Encabezado común a todas las páginas. Lee la sesión, así que vuelve dinámicas las páginas
 * que lo usan: es el precio de mostrar "Mis muestras" y "Salir" a quien entró.
 */
export async function Encabezado() {
  const usuario = await getUsuario();
  return (
    <BarraEncabezado>
      <nav className="mf-marco flex h-16 items-center transition-[height] duration-300 group-data-[sobre-foto=true]:h-24 sm:group-data-[sobre-foto=true]:h-36 gap-x-0.5 text-[13px] sm:gap-x-1 sm:text-sm">
        <Link href="/" className="mr-auto flex items-center gap-2.5 py-1 pr-1.5">
          {/* Sobre la foto el logo va grande y en blanco (los colores del diafragma se pierden en una
              foto oscura); al bajar, o en el resto de las páginas, queda compacto y en color. */}
          <Image
            src="/brand/muestras-logo-1254.webp"
            alt=""
            width={108}
            height={108}
            preload
            className="size-10 transition-[width,height] duration-300 group-data-[sobre-foto=true]:size-[72px] group-data-[sobre-foto=true]:brightness-0 group-data-[sobre-foto=true]:invert sm:group-data-[sobre-foto=true]:size-[108px]"
          />
          {/* Sobre el banner el nombre ya está grande abajo: acá queda sólo para lectores de pantalla.
              Con la sesión abierta hay más enlaces y en el teléfono también se oculta. */}
          <span className={`mf-titulo whitespace-nowrap text-[17px] tracking-[-0.02em] group-data-[sobre-foto=true]:sr-only ${usuario ? "max-sm:sr-only" : ""}`}>Muestras Fotográficas</span>
        </Link>
        <Link href="/proponer" className={enlace}><span className="sm:hidden">Proponer</span><span className="max-sm:hidden">Proponé tu muestra</span></Link>
        {usuario ? (
          <>
            <Link href="/mis-muestras" className={enlace}>Mis muestras</Link>
            {usuario.esSuperAdmin ? <Link href="/admin" className={enlace}>Revisión</Link> : null}
            <form method="post" action="/api/auth/logout">
              <button type="submit" className={`${enlace} opacity-75`}>Salir</button>
            </form>
          </>
        ) : (
          <Link href="/login" className={enlace}>Ingresar</Link>
        )}
      </nav>
    </BarraEncabezado>
  );
}
