import "server-only";
import { prisma } from "@repo/db";
import { fichaDetail } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import { asegurarCodigosDeSala } from "@/lib/sala/codigos";
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
 *
 * Etapa 6: cada QR lleva el código de sala de su obra (se crea la primera vez y después es el
 * mismo) y las obras de expositores suman medidas y edición. El precio nunca.
 */
export async function cargarFichas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  obraId: string | null,
): Promise<{ nombre: string; activityId: string; fichas: FichaDeObra[] } | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id, reviewStatus: "APPROVED", type: "MUESTRA" }, usuario, "pieces"),
    select: {
      id: true, slug: true, title: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const obras = obraId ? a.works.filter((w) => w.id === obraId) : a.works;
  if (obras.length === 0) return null;
  const ids = obras.map((o) => o.id);
  const [codigos, deExpositor] = await Promise.all([asegurarCodigosDeSala(a.id, ids), detallesDeExpositor(a.id, ids)]);
  const base = baseUrlPublica();
  return {
    nombre: obraId ? `ficha-${a.slug}-${obras[0]!.sortOrder + 1}` : `fichas-${a.slug}`,
    activityId: a.id,
    fichas: obras.map((o) => datosDeFicha(a, o, base, { codigo: codigos.get(o.id), detalle: deExpositor.get(o.id) })),
  };
}

/** La línea de datos de cada obra que cargó un expositor, por id de la obra de la muestra. */
export async function detallesDeExpositor(activityId: string, workIds: readonly string[]): Promise<Map<string, string>> {
  if (!workIds.length) return new Map();
  const filas = await prisma.culturalExhibitorWork.findMany({
    where: { activityId, activityWorkId: { in: [...workIds] } },
    // Sin `priceArs`: no va en ninguna pieza (spec D38).
    select: { activityWorkId: true, year: true, technique: true, imageWidthCm: true, imageHeightCm: true, edition: true, editionNumber: true, editionSize: true },
  });
  return new Map(filas.flatMap((f) => {
    const d = fichaDetail(f);
    return f.activityWorkId && d ? [[f.activityWorkId, d] as const] : [];
  }));
}
