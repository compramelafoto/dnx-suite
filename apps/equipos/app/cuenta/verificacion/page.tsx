import { redirect } from "next/navigation";
import { requestEmailVerification } from "@repo/auth";
import { getPortalUser, type PortalUser } from "@/lib/guards";
import { urlBaseDeLaApp } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const RUTA = "/cuenta/verificacion";

async function reenviarCorreo() {
  "use server";
  const user = await getPortalUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(RUTA)}`);
  if (!user.emailVerifiedAt) {
    await requestEmailVerification({
      email: user.email,
      appBaseUrl: urlBaseDeLaApp(),
      appLabel: "Equipos verificados",
      verifyPath: "/verificar-email",
      sourceApplication: "equipos",
    });
  }
  redirect(`${RUTA}?enviado=1`);
}

type Paso = { titulo: string; hecho: boolean; detalle: string; accion?: React.ReactNode };

function pasos(user: PortalUser): Paso[] {
  const correoOk = user.emailVerifiedAt !== null;
  const telefonoOk = user.phoneVerifiedAt !== null;
  const id = user.identity;
  const identidadOk = user.level === "identidad";

  const correo: Paso = {
    titulo: "1. Correo",
    hecho: correoOk,
    detalle: correoOk
      ? `Verificaste ${user.email}.`
      : `Te mandamos un enlace a ${user.email}. Abrilo para confirmar tu correo.`,
    accion: correoOk ? undefined : (
      <form action={reenviarCorreo}>
        <button type="submit">Reenviar el correo de verificación</button>
      </form>
    ),
  };

  const telefono: Paso = {
    titulo: "2. Teléfono",
    hecho: telefonoOk,
    detalle: telefonoOk
      ? `Verificaste ${user.phone ?? "tu teléfono"}.`
      : correoOk
        ? "Confirmá que tu número de WhatsApp es tuyo."
        : "Primero verificá tu correo.",
    accion:
      !telefonoOk && correoOk ? <a href="/cuenta/telefono">Verificar mi teléfono</a> : undefined,
  };

  let detalleId: string;
  let accionId: React.ReactNode;
  if (identidadOk) {
    detalleId = "Tu identidad está verificada.";
  } else if (!telefonoOk) {
    detalleId = "Primero verificá tu teléfono.";
  } else if (id?.status === "IN_REVIEW") {
    detalleId = "Tu verificación está en revisión. Te avisamos cuando haya resultado.";
  } else if (
    id?.status === "REJECTED" &&
    (id.reviewedById !== null || id.rejectionReason === "DNI_YA_USADO")
  ) {
    detalleId = "Esta verificación no se puede reiniciar. Escribinos para resolverlo.";
  } else if (id?.status === "PENDING") {
    detalleId = "Tenés una verificación empezada. Podés retomarla.";
    accionId = <a href="/verificacion">Continuar la verificación</a>;
  } else if (id?.status === "APPROVED" && id.reverifyRequiredAt) {
    detalleId =
      "Cambiaste el correo o el teléfono, así que tenés que volver a verificar tu identidad.";
    accionId = <a href="/verificacion">Verificar de nuevo</a>;
  } else if (id?.status === "REJECTED") {
    detalleId = "La verificación no pudo completarse. Podés intentarlo de nuevo.";
    accionId = <a href="/verificacion">Reintentar</a>;
  } else {
    detalleId = "Con una foto de tu DNI y de tu rostro confirmamos que sos vos.";
    accionId = <a href="/verificacion">Verificar mi identidad</a>;
  }
  const identidad: Paso = {
    titulo: "3. Identidad",
    hecho: identidadOk,
    detalle: detalleId,
    accion: accionId,
  };

  return [correo, telefono, identidad];
}

export default async function MiVerificacionPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const user = await getPortalUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(RUTA)}`);
  const { enviado } = await searchParams;
  const identidadAprobada = user.identity?.status === "APPROVED" && !!user.identity.legalName?.trim();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Mi verificación</h1>
      <p>
        Hola, <strong>{user.displayName ?? user.email}</strong>.
        {identidadAprobada ? " Tu nombre figura tal como está en tu DNI y no se puede editar." : null}
      </p>
      {enviado ? <p role="status">Te reenviamos el correo. Revisá también la carpeta de spam.</p> : null}

      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
        {pasos(user).map((p) => (
          <li
            key={p.titulo}
            style={{ border: "1px solid #d6e2e9", borderRadius: 8, padding: 16 }}
          >
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
              {p.titulo} <span>{p.hecho ? "✓ Listo" : "Pendiente"}</span>
            </h2>
            <p>{p.detalle}</p>
            {p.accion}
          </li>
        ))}
      </ol>

      <form action="/api/auth/logout" method="post">
        <button type="submit">Cerrar sesión</button>
      </form>
    </main>
  );
}
