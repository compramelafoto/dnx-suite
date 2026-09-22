"use server";

/**
 * Alta de jurado por cuenta propia.
 *
 * El postulante entra y trabaja en su ficha desde el minuto cero. Lo único que
 * espera la aprobación de DNX es la visibilidad: el directorio es común a todos
 * los organizadores de FotoRank, así que publicar a alguien sin mirarlo lo
 * publica para toda la plataforma.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@repo/db";

import { hashPassword } from "../lib/security/password";
import { createJudgeSessionForJudge, requireJudgeAuth } from "../lib/judge-auth";
import { avisarFichaPendienteDeRevision } from "../lib/fotorank/judges/avisoDeFichaPendiente";
import { enqueueTransactionalEmail } from "../lib/fotorank/notifications/outbox";
import { estadoInicialParaAlta } from "../lib/fotorank/judges/directoryReview";
import {
  crearTokenDeVerificacion,
  hashDeToken,
  revisarToken,
} from "../lib/fotorank/judges/judgeEmailVerification";
import { saveJudgeAvatar } from "../lib/fotorank/judges/judgeAssetStorage";
import { buildPublicSlugUnico } from "../lib/fotorank/judges/publicSlug";
import {
  normalizarInstagram,
  normalizarUrl,
  parsearLista,
  validarPostulacion,
  type DatosDePostulacion,
  type ErroresDePostulacion,
} from "../lib/fotorank/judges/publicSignupForm";
import {
  ipDelPedido,
  puedeAltaDesdeIp,
  registrarAltaDesdeIp,
} from "../lib/fotorank/judges/signupRateLimit";

/** Lo mismo se responde cuando el alta salió bien y cuando el correo ya existe. */
const RESPUESTA_NEUTRA =
  "Si el correo es válido, te va a llegar un mensaje para confirmarlo.";

export type EstadoDelFormulario = {
  error: string | null;
  errores?: ErroresDePostulacion;
};

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
}

function marcado(fd: FormData, campo: string): boolean {
  return fd.get(campo) === "on" || fd.get(campo) === "true";
}

function baseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

function leerDatos(fd: FormData): DatosDePostulacion {
  const cargadoEn = Number(texto(fd, "cargadoEn"));
  const segundosDeLlenado = Number.isFinite(cargadoEn) && cargadoEn > 0
    ? Math.floor((Date.now() - cargadoEn) / 1000)
    : undefined;

  const anios = texto(fd, "experienceYears").trim();

  return {
    firstName: texto(fd, "firstName"),
    lastName: texto(fd, "lastName"),
    email: texto(fd, "email").trim().toLowerCase(),
    password: texto(fd, "password"),
    city: texto(fd, "city"),
    country: texto(fd, "country"),
    professionalHeadline: texto(fd, "professionalHeadline"),
    shortBio: texto(fd, "shortBio"),
    specialtiesText: texto(fd, "specialtiesText"),
    experienceYears: anios === "" ? null : Number(anios),
    aceptaTerminos: marcado(fd, "aceptaTerminos"),
    aceptaDatos: marcado(fd, "aceptaDatos"),
    phone: texto(fd, "phone"),
    website: texto(fd, "website"),
    instagram: texto(fd, "instagram"),
    portfolioUrl: texto(fd, "portfolioUrl"),
    languagesText: texto(fd, "languagesText"),
    region: texto(fd, "region"),
    wantsDirectoryListing: marcado(fd, "wantsDirectoryListing"),
    // Campo invisible para las personas. Si viene lleno, lo llenó un robot.
    trampa: texto(fd, "sitioWeb2"),
    segundosDeLlenado,
  };
}

/**
 * A qué workspace se cuelga un jurado que no pertenece a ninguna institución.
 *
 * `workspaceId` es obligatorio en el modelo, pero para un alta pública es sólo
 * una atadura técnica: ese jurado no es de nadie. Se elige con una variable
 * para que sea una decisión escrita, y si no está se toma el más antiguo, que
 * al menos es siempre el mismo. Un `findFirst` a secas devolvería cualquiera y
 * los jurados quedarían repartidos entre instituciones sin criterio.
 */
async function workspaceParaAltaPublica(): Promise<string | null> {
  const declarado = process.env.FOTORANK_PUBLIC_SIGNUP_WORKSPACE_ID?.trim();
  if (declarado) {
    const existe = await prisma.workspace.findUnique({
      where: { id: declarado },
      select: { id: true },
    });
    if (existe) return existe.id;
    console.warn(
      "[postulacion de jurado] FOTORANK_PUBLIC_SIGNUP_WORKSPACE_ID apunta a un workspace que no existe",
    );
  }
  const masAntiguo = await prisma.workspace.findFirst({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return masAntiguo?.id ?? null;
}

export async function postularseComoJuradoAction(
  _previo: EstadoDelFormulario,
  fd: FormData,
): Promise<EstadoDelFormulario> {
  const ahora = new Date();
  const ip = ipDelPedido(await headers());

  if (!puedeAltaDesdeIp(ip, ahora)) {
    return {
      error: "Hubo demasiadas postulaciones desde acá hoy. Probá mañana o escribinos.",
    };
  }

  const datos = leerDatos(fd);
  const validacion = validarPostulacion(datos);
  if (!validacion.ok) {
    return {
      error: validacion.errores._general ?? "Revisá los campos marcados.",
      errores: validacion.errores,
    };
  }

  const yaExiste = await prisma.fotorankJudgeAccount.findUnique({
    where: { email: datos.email },
    select: { id: true },
  });

  if (yaExiste) {
    // No se revela que hay cuenta: se le avisa al dueño real de la casilla y
    // al que llenó el formulario se le responde lo mismo que si hubiera salido
    // bien.
    await enqueueTransactionalEmail({
      kind: "JUDGE_SIGNUP_VERIFY_EMAIL",
      toEmail: datos.email,
      payload: {
        firstName: datos.firstName.trim(),
        verifyUrl: `${baseUrl()}/jurado/login`,
        avisoDeCuentaExistente: true,
      },
    });
    registrarAltaDesdeIp(ip, ahora);
    redirect("/jurados/postulacion/gracias");
  }

  const inicial = estadoInicialParaAlta("PUBLIC_SIGNUP");
  const verificacion = crearTokenDeVerificacion(ahora);

  const workspaceId = await workspaceParaAltaPublica();
  if (!workspaceId) {
    return { error: "No pudimos crear tu cuenta ahora. Escribinos y lo resolvemos." };
  }

  const cuenta = await prisma.fotorankJudgeAccount.create({
    data: {
      workspaceId,
      email: datos.email,
      passwordHash: hashPassword(datos.password),
      accountStatus: "ACTIVE",
      profile: {
        create: {
          firstName: datos.firstName.trim(),
          lastName: datos.lastName.trim(),
          publicSlug: buildPublicSlugUnico(datos.firstName, datos.lastName),
          professionalHeadline: datos.professionalHeadline.trim(),
          shortBio: datos.shortBio.trim(),
          specialtiesJson: parsearLista(datos.specialtiesText),
          languagesJson: parsearLista(datos.languagesText ?? ""),
          experienceYears: datos.experienceYears,
          city: datos.city.trim(),
          country: datos.country.trim(),
          region: datos.region?.trim() || null,
          phone: datos.phone?.trim() || null,
          website: datos.website ? normalizarUrl(datos.website) : null,
          instagram: datos.instagram ? normalizarInstagram(datos.instagram) : null,
          portfolioUrl: datos.portfolioUrl ? normalizarUrl(datos.portfolioUrl) : null,
          signupSource: "PUBLIC_SIGNUP",
          directoryReviewStatus: inicial.estado,
          isPublic: inicial.isPublic,
          isListedInProfessionalDirectory: false,
          wantsDirectoryListing: datos.wantsDirectoryListing ?? false,
        },
      },
    },
    select: { id: true },
  });

  // La foto va después de crear la cuenta, porque la clave del archivo lleva
  // el judgeAccountId. Si falla, el alta NO se cae: perder una cuenta entera
  // por una imagen sería peor que la imagen.
  const foto = fd.get("foto");
  if (foto && typeof foto === "object" && "arrayBuffer" in foto && (foto as File).size > 0) {
    try {
      const f = foto as File;
      const guardada = await saveJudgeAvatar({
        judgeAccountId: cuenta.id,
        body: new Uint8Array(await f.arrayBuffer()),
        mime: f.type || "",
      });
      if (guardada.ok) {
        await prisma.fotorankJudgeProfile.update({
          where: { judgeAccountId: cuenta.id },
          data: { avatarUrl: guardada.key },
        });
      }
    } catch (err) {
      console.warn("[postulacion de jurado] la foto no se pudo guardar", err);
    }
  }

  await prisma.emailVerificationToken.create({
    data: {
      email: datos.email,
      token: verificacion.tokenHash,
      purpose: "VERIFY_EMAIL",
      expiresAt: verificacion.expiresAt,
    },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: null,
      actorType: "JUDGE",
      actorJudgeId: cuenta.id,
      eventType: "JUDGE_PUBLIC_SIGNUP",
      entityType: "FotorankJudgeAccount",
      entityId: cuenta.id,
      payloadJson: { origen: "PUBLIC_SIGNUP" },
    },
  });

  await enqueueTransactionalEmail({
    kind: "JUDGE_SIGNUP_VERIFY_EMAIL",
    toEmail: datos.email,
    payload: {
      firstName: datos.firstName.trim(),
      verifyUrl: `${baseUrl()}/jurados/verificar/${verificacion.token}`,
    },
  });

  registrarAltaDesdeIp(ip, ahora);

  // Entra y puede trabajar en su ficha desde ya: lo que espera la aprobación es
  // la visibilidad, no el acceso.
  await createJudgeSessionForJudge(cuenta.id);
  redirect("/jurados/postulacion/gracias");
}

export async function verificarEmailDeJuradoAction(
  token: string,
): Promise<{ ok: boolean; mensaje: string }> {
  const ahora = new Date();
  const tokenHash = hashDeToken(token.trim());

  const fila = await prisma.emailVerificationToken.findUnique({
    where: { token: tokenHash },
    select: { id: true, email: true, usedAt: true, expiresAt: true, purpose: true },
  });

  const revision = revisarToken({
    fila: fila
      ? { usedAt: fila.usedAt, expiresAt: fila.expiresAt, purpose: fila.purpose }
      : null,
    ahora,
  });
  if (!revision.ok) return { ok: false, mensaje: revision.mensaje };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: fila!.id },
      data: { usedAt: ahora },
    }),
    prisma.fotorankJudgeAccount.updateMany({
      where: { email: fila!.email },
      data: { emailVerifiedAt: ahora },
    }),
  ]);

  /*
   * Recién ahora la ficha entra a revisión, así que recién ahora se avisa.
   *
   * Va fuera de la transacción a propósito: un correo que no sale no puede
   * deshacer una verificación que sí ocurrió.
   */
  const cuentaVerificada = await prisma.fotorankJudgeAccount.findUnique({
    where: { email: fila!.email },
    select: { profile: { select: { firstName: true, lastName: true } } },
  });
  const nombre =
    [cuentaVerificada?.profile?.firstName, cuentaVerificada?.profile?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || fila!.email;
  await avisarFichaPendienteDeRevision({
    email: fila!.email,
    nombre,
    baseUrl: baseUrl(),
  });

  return {
    ok: true,
    mensaje: "Listo, tu correo quedó confirmado. Ahora revisamos tu ficha.",
  };
}

export async function reenviarVerificacionAction(): Promise<{ ok: boolean; mensaje: string }> {
  const judge = await requireJudgeAuth();
  const ahora = new Date();

  const cuenta = await prisma.fotorankJudgeAccount.findUnique({
    where: { id: judge.id },
    select: { email: true, emailVerifiedAt: true, profile: { select: { firstName: true } } },
  });
  if (!cuenta) return { ok: false, mensaje: "No encontramos tu cuenta." };
  if (cuenta.emailVerifiedAt) {
    return { ok: true, mensaje: "Tu correo ya estaba confirmado." };
  }

  const verificacion = crearTokenDeVerificacion(ahora);
  await prisma.emailVerificationToken.create({
    data: {
      email: cuenta.email,
      token: verificacion.tokenHash,
      purpose: "VERIFY_EMAIL",
      expiresAt: verificacion.expiresAt,
    },
  });

  await enqueueTransactionalEmail({
    kind: "JUDGE_SIGNUP_VERIFY_EMAIL",
    toEmail: cuenta.email,
    payload: {
      firstName: cuenta.profile?.firstName ?? "",
      verifyUrl: `${baseUrl()}/jurados/verificar/${verificacion.token}`,
    },
  });

  return { ok: true, mensaje: RESPUESTA_NEUTRA };
}
