import { NextResponse } from "next/server";
import { verifyUserPassword } from "@repo/auth";
import { prisma } from "@repo/db";
import { adjuntarSesion } from "@/lib/sesion";
import { checkRateLimit } from "@/lib/limite";
import { rutaInternaSegura } from "@/lib/ruta-segura";

/**
 * Ingreso con correo y contraseña: la misma clave de la cuenta de DNX Suite (FotoRank, FOTOFFICE).
 * Muestras no crea cuentas ni recupera claves por acá; quien no tiene clave entra con Google.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Por IP y por correo: frena el probar claves sin molestar a quien se equivoca un par de veces.
const FRENO = { limit: 10, windowMs: 15 * 60_000 };

function alLogin(origin: string, mensaje: string, next: string | undefined) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", mensaje);
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;

  // Sólo desde nuestro propio formulario.
  const origen = req.headers.get("origin");
  if (origen && origen !== origin) {
    return new NextResponse("Origen no permitido", { status: 403 });
  }

  const datos = await req.formData().catch(() => null);
  const email = datos?.get("email")?.toString().trim().toLowerCase() ?? "";
  const clave = datos?.get("password")?.toString() ?? "";
  const next = rutaInternaSegura(datos?.get("next")?.toString());

  if (!email || !clave) return alLogin(origin, "Escribí tu correo y tu contraseña.", next);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const porIp = checkRateLimit({ key: `clave:ip:${ip}`, ...FRENO });
  const porCorreo = checkRateLimit({ key: `clave:correo:${email}`, ...FRENO });
  if (!porIp.allowed || !porCorreo.allowed) {
    return alLogin(origin, "Demasiados intentos. Esperá unos minutos y probá de nuevo.", next);
  }

  let verificado: Awaited<ReturnType<typeof verifyUserPassword>>;
  try {
    verificado = await verifyUserPassword({ email, password: clave });
  } catch (err) {
    console.error("[muestras] error al verificar la contraseña", err);
    return alLogin(origin, "No pudimos completar el ingreso. Volvé a intentarlo.", next);
  }

  if (!verificado.ok) {
    return alLogin(
      origin,
      verificado.reason === "NO_PASSWORD"
        ? "Esta cuenta no tiene contraseña: entrá con Google."
        : "El correo o la contraseña no son correctos.",
      next,
    );
  }

  await prisma.user.update({
    where: { id: verificado.user.id },
    data: { lastLoginAt: new Date() },
  });

  const respuesta = NextResponse.redirect(new URL(next ?? "/panel", origin), 303);
  await adjuntarSesion(respuesta, verificado.user.id);
  return respuesta;
}
