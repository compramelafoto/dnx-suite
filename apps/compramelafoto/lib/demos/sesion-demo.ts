/**
 * Sesión de demo: el admin entra a la demo como el fotógrafo demo y puede pasar a la vista del
 * colegio sin contraseñas. Su propia sesión queda guardada en `dnx_demo_vuelta`, y es la prueba de
 * que quien cambia de vista es él: sin esa cookie viva, no hay demo.
 */

import { cookies } from "next/headers";
import {
  createUserSession,
  destroyUserSessionByRawToken,
  DNX_SESSION_COOKIE,
  getSessionUserByRawToken,
} from "@repo/auth";
import { prisma } from "@/lib/prisma";
import { DNX_SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { esUsuarioDemo, puedeAdministrarDemos } from "@/lib/demos/identidad";

export const DEMO_RETURN_COOKIE = "dnx_demo_vuelta";
/** Una demo dura una charla: 12 horas alcanzan y no deja una puerta abierta para siempre. */
const DEMO_RETURN_MAX_AGE = 60 * 60 * 12;

export type DemoActiva = { adminUserId: number; demo: "escolar" };

/** La demo está activa si la cookie de vuelta guarda una sesión viva del admin de demos. */
export async function getDemoActiva(): Promise<DemoActiva | null> {
  try {
    const store = await cookies();
    const raw = store.get(DEMO_RETURN_COOKIE)?.value;
    if (!raw) return null;
    const admin = await getSessionUserByRawToken(raw);
    if (!admin || !puedeAdministrarDemos({ id: admin.id, role: String(admin.role) })) return null;
    return { adminUserId: admin.id, demo: "escolar" };
  } catch {
    return null;
  }
}

async function emitirSesion(userId: number) {
  const store = await cookies();
  const session = await createUserSession(userId, { maxAgeSeconds: DEMO_RETURN_MAX_AGE });
  store.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...DNX_SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
}

async function exigirUsuarioDemo(userId: number) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tags: true } });
  if (!esUsuarioDemo(u)) throw new Error("destino_no_demo");
}

/**
 * Desde la sesión del admin: guarda su token en la cookie de vuelta y abre la sesión del usuario
 * demo. La sesión del admin no se destruye: es la que vuelve al salir.
 */
export async function entrarADemo(destinoUserId: number): Promise<void> {
  await exigirUsuarioDemo(destinoUserId);
  const store = await cookies();
  const adminRaw = store.get(DNX_SESSION_COOKIE)?.value;
  if (!adminRaw) throw new Error("sin_sesion_admin");
  const admin = await getSessionUserByRawToken(adminRaw);
  if (!admin || !puedeAdministrarDemos({ id: admin.id, role: String(admin.role) })) {
    throw new Error("no_admin_demos");
  }
  store.set(DEMO_RETURN_COOKIE, adminRaw, {
    ...DNX_SESSION_COOKIE_OPTIONS,
    maxAge: DEMO_RETURN_MAX_AGE,
  });
  await emitirSesion(destinoUserId);
}

/** Dentro de la demo: cierra la sesión demo actual y abre la del otro usuario demo. */
export async function cambiarSesionDemo(destinoUserId: number): Promise<void> {
  if (!(await getDemoActiva())) throw new Error("demo_inactiva");
  await exigirUsuarioDemo(destinoUserId);
  const store = await cookies();
  const actual = store.get(DNX_SESSION_COOKIE)?.value;
  if (actual && actual !== store.get(DEMO_RETURN_COOKIE)?.value) {
    const u = await getSessionUserByRawToken(actual);
    if (u && esUsuarioDemo(await prisma.user.findUnique({ where: { id: u.id }, select: { tags: true } }))) {
      await destroyUserSessionByRawToken(actual);
    }
  }
  await emitirSesion(destinoUserId);
}

/** Vuelve a la sesión del admin y cierra la demo. */
export async function salirDeDemo(): Promise<void> {
  const store = await cookies();
  const vuelta = store.get(DEMO_RETURN_COOKIE)?.value;
  const actual = store.get(DNX_SESSION_COOKIE)?.value;
  if (actual && actual !== vuelta) {
    const u = await getSessionUserByRawToken(actual);
    if (u && esUsuarioDemo(await prisma.user.findUnique({ where: { id: u.id }, select: { tags: true } }))) {
      await destroyUserSessionByRawToken(actual);
    }
  }
  if (vuelta && (await getSessionUserByRawToken(vuelta))) {
    store.set(DNX_SESSION_COOKIE, vuelta, { ...DNX_SESSION_COOKIE_OPTIONS, maxAge: DEMO_RETURN_MAX_AGE });
  } else {
    store.set(DNX_SESSION_COOKIE, "", { ...DNX_SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) });
  }
  store.set(DEMO_RETURN_COOKIE, "", { ...DNX_SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) });
}
