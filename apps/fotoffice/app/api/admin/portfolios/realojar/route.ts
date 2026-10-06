import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import {
  countExternalPortfolioPhotos,
  localizePortfolioPhotos,
} from "@/lib/portfolio/localize-photos";

export const runtime = "nodejs";
/** Bajar y subir ocho fotos de hasta 10 MB no entra en el tiempo por omisión. */
export const maxDuration = 300;

/**
 * Realojar las fotos de portfolio que quedaron en el servidor del sitio viejo.
 *
 * **Vive bajo `/api/admin/` pero NO hereda el guardia de `app/(shell)/admin/layout.tsx`**: un
 * layout sólo protege páginas. Acá el permiso se verifica a mano, y es el mismo: super admin de
 * plataforma.
 *
 * Es una tarea de plataforma, no de la institución. SFPR no sabe —ni tiene por qué saber— que
 * siete de sus portfolios dependen de un servidor ajeno; ponerle el aviso en su panel sería
 * contarle un problema nuestro en un idioma que no es el suyo.
 */
async function guardia(): Promise<{ userId: number } | NextResponse> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión." }, { status: 401 });
  if (!(await isFotofficePlatformAdmin(user.id))) {
    return NextResponse.json({ error: "Sólo un super admin realoja fotos." }, { status: 403 });
  }
  return { userId: user.id };
}

function workspacePedido(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

/** Cuántas fotos de ese workspace siguen alojadas afuera. */
export async function GET(request: Request) {
  const g = await guardia();
  if (g instanceof NextResponse) return g;

  const workspaceId = workspacePedido(new URL(request.url).searchParams.get("workspaceId"));
  if (!workspaceId) return NextResponse.json({ error: "Falta el workspace." }, { status: 400 });

  return NextResponse.json({ pendientes: await countExternalPortfolioPhotos(workspaceId) });
}

/** Trae una tanda. El botón repite mientras queden. */
export async function POST(request: Request) {
  const g = await guardia();
  if (g instanceof NextResponse) return g;

  let cuerpo: unknown = null;
  try {
    cuerpo = await request.json();
  } catch {
    cuerpo = null;
  }
  const workspaceId = workspacePedido((cuerpo as { workspaceId?: unknown } | null)?.workspaceId);
  if (!workspaceId) return NextResponse.json({ error: "Falta el workspace." }, { status: 400 });

  return NextResponse.json(await localizePortfolioPhotos(workspaceId, { limit: 8 }));
}
