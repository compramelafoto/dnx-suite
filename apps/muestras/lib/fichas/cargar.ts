import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";
import { datosDeFicha, type FichaDeObra } from "./texto";

const DOMINIO_PUBLICO = "https://muestrasfotograficas.com";
let avisado = false;

/**
 * La dirección pública del sitio, la que va en el QR. En local puede apuntar a `localhost`.
 *
 * En producción un QR impreso dura lo que dure la muestra: no puede llevar `localhost`, una
 * dirección `*.vercel.app` (cambia con cada proyecto) ni `http`. Si `APP_URL` no sirve, se usa el
 * dominio público y se avisa una vez en el log para corregir la variable en Vercel.
 */
export function baseUrlPublica(env: Record<string, string | undefined> = process.env): string {
  const pedida = (env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || DOMINIO_PUBLICO).replace(/\/+$/, "");
  const produccion = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  if (!produccion || pedida === DOMINIO_PUBLICO) return pedida;
  let sirve = false;
  try {
    const u = new URL(pedida);
    const host = u.hostname.toLowerCase();
    sirve = u.protocol === "https:" && host !== "localhost" && !host.endsWith(".localhost") && host !== "127.0.0.1"
      && host !== "[::1]" && host !== "vercel.app" && !host.endsWith(".vercel.app");
  } catch {
    sirve = false;
  }
  if (sirve) return pedida;
  if (!avisado) {
    avisado = true;
    console.warn(`[fichas] APP_URL no sirve para un QR impreso en producción; se usa ${DOMINIO_PUBLICO}.`);
  }
  return DOMINIO_PUBLICO;
}

/**
 * Las fichas de una muestra **publicada** de la persona (cualquiera, si es super admin): una
 * ficha con QR a una página que no existe no sirve. `null` = no corresponde (no existe, no es
 * suya, no está publicada, no es una muestra, o la obra pedida no es de esta muestra).
 */
export async function cargarFichas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  obraId: string | null,
): Promise<{ nombre: string; fichas: FichaDeObra[] } | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: { id, reviewStatus: "APPROVED", type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    select: {
      slug: true, title: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const obras = obraId ? a.works.filter((w) => w.id === obraId) : a.works;
  if (obras.length === 0) return null;
  const base = baseUrlPublica();
  return {
    nombre: obraId ? `ficha-${a.slug}-${obras[0]!.sortOrder + 1}` : `fichas-${a.slug}`,
    fichas: obras.map((o) => datosDeFicha(a, o, base)),
  };
}
