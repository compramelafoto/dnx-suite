import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ¿Hay alguien con la sesión iniciada? Para el encabezado del sitio público.
 *
 * El sitio se sirve igual para todos —se puede guardar en caché—, así que no sabe en el
 * servidor quién lo mira. El botón de "Ingresar" pregunta acá desde el navegador y, si hay
 * sesión, se convierte en el menú de la persona.
 *
 * Devuelve sólo el nombre para mostrar: nada que sirva para otra cosa. En un dominio propio
 * el navegador no manda la cookie de FOTOFFICE y la respuesta es siempre "nadie".
 */
export async function GET() {
  const user = await getAuthUser();
  const nombre = user ? (user.name?.trim() || user.email.split("@")[0] || "Mi cuenta") : null;
  return NextResponse.json(
    { signedIn: Boolean(user), name: nombre },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
