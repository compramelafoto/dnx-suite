import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { leerAvisoDeError } from "@/lib/errores/error-pantalla-puro";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/errores-pantalla → guarda una falla que dejó la pantalla en blanco.
 *
 * Lo llama la pantalla de error (`components/errores/pantalla-de-error.tsx`). **Sin sesión
 * obligatoria**: una falla también puede pasar en el login, el portal o el sitio público. Si hay
 * sesión, se anota quién y en qué workspace. Lo que lo protege es el tope por origen y que sólo
 * escribe texto recortado en una tabla que no lee nadie más que el equipo.
 *
 * Además de guardarlo, lo deja en los registros de Vercel, que es donde se mira primero.
 */
export async function POST(req: NextRequest) {
  const freno = checkRateLimit({ key: `errores-pantalla:${clientIp(req.headers)}`, limit: 20, windowMs: 60_000 });
  if (!freno.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const aviso = leerAvisoDeError(await req.json().catch(() => null));
  if (!aviso) return NextResponse.json({ ok: false }, { status: 400 });

  const usuario = await getAuthUser().catch(() => null);
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? null;
  console.error("[errores-pantalla]", JSON.stringify({ ...aviso, userId: usuario?.id ?? null, deploymentId }));

  try {
    const fila = await prisma.fotofficeErrorPantalla.create({
      data: {
        ...aviso,
        deploymentId,
        userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
        userId: usuario?.id ?? null,
        workspaceId: usuario?.currentWorkspaceId ?? null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: fila.id });
  } catch (e) {
    // Si no se pudo guardar, al menos quedó en los registros de Vercel.
    console.error("[errores-pantalla] no se pudo guardar", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
