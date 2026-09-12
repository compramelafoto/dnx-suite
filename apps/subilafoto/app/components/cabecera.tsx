import Link from "next/link";
import { estiloBotonDnx } from "@/lib/boton-dnx";

/**
 * Cabecera de la portada: la marca y la puerta de entrada del profesional.
 *
 * El botón dice siempre «Ingresar», aun para quien ya tiene la sesión abierta.
 * Es a propósito: leer la cookie acá obligaría a que toda la portada se
 * calcule en cada visita, y esta página es lo primero que ve alguien que no
 * tiene cuenta. Quien ya entró no ve un error — `/login` lo manda derecho al
 * panel.
 *
 * El invitado de un evento no pasa por acá: llega por el QR a `/e/[codigo]`.
 * Por eso hay un solo botón y no dos.
 *
 * Tampoco lleva logo: la cabecera se desplaza con la página y sólo se ve arriba
 * de todo, que es exactamente donde el hero ya muestra el logo grande. Repetirlo
 * a treinta píxeles del otro no agrega nada.
 */
export function Cabecera() {
  return (
    <header
      className="absolute inset-x-0 top-0 z-20 flex items-center justify-end px-5 py-4 sm:px-8 sm:py-6"
    >
      {/*
        El estilo sale de `estiloBotonDnx`, que arma el botón con los mismos
        tokens que el `Button` de `@repo/design-system`. Antes era una píldora
        amarilla propia: se veía bien pero era de otra familia que el resto de
        la suite.
      */}
      <Link href="/login" className="shrink-0" style={estiloBotonDnx("primario")}>
        Ingresar
      </Link>
    </header>
  );
}
