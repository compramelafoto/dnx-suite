"use server";

import { prisma } from "@repo/db";
import { CAMPO_TRAMPA, cayoEnLaTrampa } from "@/lib/consultas/trampa";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { frenadoPorIp } from "@/lib/testimonios/formulario-publico";
import { archivoDeFoto } from "@/lib/testimonios/foto";
import { EVENTOS_MODULE_KEY } from "@/lib/eventos/constants";
import { CONSENT_VERSION, consentimientosDe, validarInscripcion, type CampoInscripcion } from "@/lib/eventos/inscripcion";
import {
  borrarFotoInscripto,
  enviarEnlacesDeEntrada,
  guardarFotoInscripto,
  leerEntrada,
  rutaRelativaDeEntrada,
} from "@/lib/eventos/entrada";
import { generarCodigo } from "@/lib/eventos/reglas";

/**
 * Las dos puertas públicas de la inscripción a un evento, sin sesión:
 *
 * - `completarEntrada`: desde el enlace personal (`/entrada/<código>?t=`), el inscripto completa o
 *   corrige sus datos, acepta las condiciones y sube su foto. El token es la llave.
 * - `inscribirseAlEvento`: la página pública del evento (`/evento/<slug>`), si el evento acepta
 *   inscripciones. Crea al inscripto con el pago pendiente y lo lleva a su entrada.
 *
 * La foto viaja en el mismo envío (el navegador ya la achicó) y la sube el servidor después de
 * validar todo. Los textos de los permisos los arma el servidor: no se acepta el que mande el navegador.
 */

export type EstadoInscripcion =
  | { status: "idle" }
  | { status: "ok"; destino: string | null; mensaje?: string }
  | { status: "error"; error: string; errores?: Partial<Record<CampoInscripcion, string>> };

const MENSAJE_COMUN = "No pudimos guardar tu inscripción. Probá de nuevo en unos minutos.";
const MENSAJE_REVISAR = "Revisá los datos marcados.";
const FRENO = { limit: 8, windowMs: 10 * 60 * 1000 };
const MENSAJE_FRENO = "Recibimos muchos envíos seguidos desde tu conexión. Probá de nuevo en unos minutos.";

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
};

/** La institución del slug, si tiene el módulo de eventos encendido. */
async function institucion(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/i.test(slug)) return null;
  const b = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: slug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!b || !(await isModuleEnabledForWorkspace(b.workspaceId, EVENTOS_MODULE_KEY))) return null;
  return { workspaceId: b.workspaceId, nombre: b.commercialName?.trim() || slug };
}

export async function completarEntrada(_prev: EstadoInscripcion, fd: FormData): Promise<EstadoInscripcion> {
  let fotoNueva: string | null = null;
  try {
    const inst = await institucion(texto(fd, "workspaceSlug"));
    if (!inst) return { status: "error", error: "Esta inscripción no está disponible." };
    const entrada = await leerEntrada(inst.workspaceId, texto(fd, "codigo"), texto(fd, "t"));
    if (!entrada) return { status: "error", error: "El enlace no es válido. Abrilo de nuevo desde tu correo." };
    if (entrada.estadoPago === "ANULADO") return { status: "error", error: "Esta entrada está anulada." };

    const archivo = archivoDeFoto(fd.get("foto"));
    const v = validarInscripcion(fd, {
      pideFoto: entrada.evento.pideFoto,
      tieneFoto: Boolean(entrada.fotoUrl || archivo),
      correoObligatorio: false,
    });
    if (!v.ok) return { status: "error", error: MENSAJE_REVISAR, errores: v.errores };

    if (archivo && (await frenadoPorIp("evento-foto", FRENO))) return { status: "error", error: MENSAJE_FRENO };
    let foto: { url: string; key: string } | null = null;
    if (archivo) {
      const r = await guardarFotoInscripto(inst.workspaceId, archivo);
      if (!r.ok) return { status: "error", error: r.error, errores: { foto: r.error } };
      foto = r;
      fotoNueva = r.key;
    }

    const d = v.datos;
    await prisma.fotofficeEventoInscripto.updateMany({
      where: { id: entrada.id, workspaceId: inst.workspaceId },
      data: {
        nombre: d.nombre,
        // El correo de quien compró no se pisa con uno vacío: es por donde le llegan los avisos.
        ...(d.email ? { email: d.email } : {}),
        telefono: d.telefono ?? entrada.telefono,
        dni: d.dni,
        instagram: d.instagram,
        ...(foto ? { fotoUrl: foto.url, fotoKey: foto.key } : {}),
        consentimientos: consentimientosDe(d, inst.nombre, entrada.evento.nombre),
        consentVersion: CONSENT_VERSION,
        consentAt: new Date(),
        datosCompletosAt: entrada.datosCompletosAt ?? new Date(),
      },
    });
    fotoNueva = null;
    if (foto && entrada.fotoKey) await borrarFotoInscripto(entrada.fotoKey);
    return { status: "ok", destino: null, mensaje: "¡Listo! Guardamos tus datos." };
  } catch (error) {
    console.error("[fotoffice][eventos] no se pudo completar una entrada", { detalle: error instanceof Error ? error.message : "desconocido" });
    return { status: "error", error: MENSAJE_COMUN };
  } finally {
    // Si la foto se subió pero la inscripción no se guardó, no queda colgada en el bucket.
    if (fotoNueva) await borrarFotoInscripto(fotoNueva);
  }
}

export async function inscribirseAlEvento(_prev: EstadoInscripcion, fd: FormData): Promise<EstadoInscripcion> {
  // Un robot llenó el campo trampa: la misma respuesta que con éxito, sin crear nada.
  if (cayoEnLaTrampa(fd.get(CAMPO_TRAMPA))) return { status: "ok", destino: null, mensaje: "Recibimos tu inscripción." };
  let fotoNueva: string | null = null;
  try {
    const inst = await institucion(texto(fd, "workspaceSlug"));
    if (!inst) return { status: "error", error: "Esta inscripción no está disponible." };
    const evento = await prisma.fotofficeEvento.findFirst({
      where: { workspaceId: inst.workspaceId, slug: texto(fd, "eventoSlug"), archivado: false, inscripcionPublica: true },
    });
    if (!evento) return { status: "error", error: "La inscripción a este evento está cerrada." };

    const archivo = archivoDeFoto(fd.get("foto"));
    const v = validarInscripcion(fd, { pideFoto: evento.pideFoto, tieneFoto: Boolean(archivo), correoObligatorio: true });
    if (!v.ok) return { status: "error", error: MENSAJE_REVISAR, errores: v.errores };
    const d = v.datos;

    if (await frenadoPorIp("evento-inscripcion", FRENO)) return { status: "error", error: MENSAJE_FRENO };

    // Ya estaba anotado con ese correo: no se duplica; se le reenvía su enlace.
    const ya = await prisma.fotofficeEventoInscripto.findFirst({
      where: { workspaceId: inst.workspaceId, eventoId: evento.id, email: d.email, estadoPago: { not: "ANULADO" } },
      select: { id: true },
    });
    if (ya) {
      await enviarEnlacesDeEntrada({ workspaceId: inst.workspaceId, inscriptoIds: [ya.id], soloSinEnviar: false });
      return { status: "ok", destino: null, mensaje: "Ya estabas inscripto con ese correo: te reenviamos el enlace a tu entrada." };
    }

    if (evento.cupo != null) {
      const anotados = await prisma.fotofficeEventoInscripto.count({ where: { eventoId: evento.id, estadoPago: { not: "ANULADO" } } });
      if (anotados >= evento.cupo) return { status: "error", error: "No quedan lugares para este evento." };
    }

    let foto: { url: string; key: string } | null = null;
    if (archivo) {
      const r = await guardarFotoInscripto(inst.workspaceId, archivo);
      if (!r.ok) return { status: "error", error: r.error, errores: { foto: r.error } };
      foto = r;
      fotoNueva = r.key;
    }

    let creado: { id: string; codigo: string } | null = null;
    for (let intento = 0; intento < 5 && !creado; intento++) {
      try {
        creado = await prisma.fotofficeEventoInscripto.create({
          data: {
            workspaceId: inst.workspaceId,
            eventoId: evento.id,
            nombre: d.nombre,
            email: d.email,
            telefono: d.telefono,
            dni: d.dni,
            instagram: d.instagram,
            origen: "WEB",
            estadoPago: "PENDIENTE",
            codigo: generarCodigo(),
            fotoUrl: foto?.url ?? null,
            fotoKey: foto?.key ?? null,
            consentimientos: consentimientosDe(d, inst.nombre, evento.nombre),
            consentVersion: CONSENT_VERSION,
            consentAt: new Date(),
            datosCompletosAt: new Date(),
          },
          select: { id: true, codigo: true },
        });
      } catch (e) {
        // El código chocó con otro (índice único): se prueba con otro.
        if (!(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002")) throw e;
      }
    }
    if (!creado) return { status: "error", error: MENSAJE_COMUN };
    fotoNueva = null;

    await enviarEnlacesDeEntrada({ workspaceId: inst.workspaceId, inscriptoIds: [creado.id], soloSinEnviar: true });
    return { status: "ok", destino: rutaRelativaDeEntrada(creado) };
  } catch (error) {
    console.error("[fotoffice][eventos] no se pudo inscribir desde la web", { detalle: error instanceof Error ? error.message : "desconocido" });
    return { status: "error", error: MENSAJE_COMUN };
  } finally {
    if (fotoNueva) await borrarFotoInscripto(fotoNueva);
  }
}
