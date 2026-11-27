import { redirect } from "next/navigation";
import { MARCA } from "@/app/_ui/marca";
import { requestEmailVerification } from "@repo/auth";
import { getPortalUser, type PortalUser } from "@/lib/guards";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { Aviso, Boton, BotonEnlace, Pagina } from "@/app/_ui";

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
      appLabel: MARCA,
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
    titulo: "Correo",
    hecho: correoOk,
    detalle: correoOk
      ? `Verificaste ${user.email}.`
      : `Te mandamos un enlace a ${user.email}. Abrilo para confirmar tu correo.`,
    accion: correoOk ? undefined : (
      <form action={reenviarCorreo}>
        <Boton variante="secundario">Reenviar el correo de verificación</Boton>
      </form>
    ),
  };

  const telefono: Paso = {
    titulo: "Teléfono",
    hecho: telefonoOk,
    detalle: telefonoOk
      ? `Verificaste ${user.phone ?? "tu teléfono"}.`
      : correoOk
        ? "Confirmá que tu número de WhatsApp es tuyo."
        : "Primero verificá tu correo.",
    accion:
      !telefonoOk && correoOk ? <BotonEnlace href="/cuenta/telefono">Verificar mi teléfono</BotonEnlace> : undefined,
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
    accionId = <BotonEnlace href="/verificacion">Continuar la verificación</BotonEnlace>;
  } else if (id?.status === "APPROVED" && id.reverifyRequiredAt) {
    detalleId =
      "Cambiaste el correo o el teléfono, así que tenés que volver a verificar tu identidad.";
    accionId = <BotonEnlace href="/verificacion">Verificar mi identidad de nuevo</BotonEnlace>;
  } else if (id?.status === "REJECTED") {
    detalleId = "La verificación no pudo completarse. Podés intentarlo de nuevo.";
    accionId = <BotonEnlace href="/verificacion">Intentar de nuevo</BotonEnlace>;
  } else {
    detalleId = "Con una foto de tu DNI y de tu rostro confirmamos que sos vos.";
    accionId = <BotonEnlace href="/verificacion">Verificar mi identidad</BotonEnlace>;
  }
  const identidad: Paso = {
    titulo: "Identidad",
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

  const enRevision = user.identity?.status === "IN_REVIEW" && user.level !== "identidad";

  return (
    <Pagina
      titulo="Mi verificación"
      bajada={
        <>
          Hola, <strong>{user.displayName ?? user.email}</strong>.
          {identidadAprobada
            ? " Tu nombre figura tal como está en tu DNI y no se puede editar."
            : " Para vender en el portal tenés que completar los tres pasos, en orden."}
        </>
      }
    >
      <div className="pila">
        {enviado ? (
          <Aviso tipo="exito">Te reenviamos el correo. Revisá también la carpeta de spam.</Aviso>
        ) : null}

        <ol className="pasos">
          {pasos(user).map((p, i) => {
            const revision = enRevision && p.titulo === "Identidad";
            return (
              <li key={p.titulo} className={p.hecho ? "paso paso-hecho" : "paso"}>
                <span className="paso-numero" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="paso-cuerpo">
                  <div className="paso-cabecera">
                    <h2 className="ficha-subtitulo">
                      <span className="solo-lectores">Paso {i + 1}: </span>
                      {p.titulo}
                    </h2>
                    {p.hecho ? (
                      <span className="estado estado-publicada">Listo</span>
                    ) : revision ? (
                      <span className="estado estado-revision">En revisión</span>
                    ) : (
                      <span className="estado">Pendiente</span>
                    )}
                  </div>
                  <p className={p.hecho ? undefined : "texto-secundario"}>{p.detalle}</p>
                  {p.accion ? <div className="acciones">{p.accion}</div> : null}
                </div>
              </li>
            );
          })}
        </ol>

        <form action="/api/auth/logout" method="post">
          <Boton variante="secundario">Cerrar sesión</Boton>
        </form>
      </div>
    </Pagina>
  );
}
