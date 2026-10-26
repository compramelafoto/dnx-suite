"use server";

import { CAMPO_TRAMPA, cayoEnLaTrampa } from "@/lib/consultas/trampa";
import { avisarTestimonioNuevo } from "@/lib/testimonios/aviso";
import { textoConsentimiento, validarTestimonio, type CampoTestimonio } from "@/lib/testimonios/dominio";
import { archivoDeFoto, borrarFotoAutor, revisarFotoAutor, subirFotoAutor } from "@/lib/testimonios/foto";
import {
  FRENO_TESTIMONIOS,
  frenadoPorIp,
  MENSAJE_FRENO_TESTIMONIO,
  sitioDelFormulario,
} from "@/lib/testimonios/formulario-publico";
import { leerInvitacion, responderInvitacion } from "@/lib/testimonios/invitaciones";
import { crearTestimonio } from "@/lib/testimonios/repositorio";

/**
 * El formulario público de testimonio (`/w/<slug>/testimonio`), abierto o con invitación (`t`).
 * Sin sesión: trampa, freno por IP y las reglas de `validarTestimonio`. La foto (opcional, ya
 * achicada por el navegador) viaja en el mismo envío y la sube el servidor después de validar todo. Siempre entra PENDIENTE
 * (lo publica el estudio). Exige el permiso de publicación, y el texto que se guarda como permiso
 * lo arma el servidor con el nombre del estudio: no se acepta el que mande el navegador.
 *
 * Con invitación, la invitación se marca usada y el testimonio se crea en la misma transacción
 * (`responderInvitacion`): un enlace usado o vencido nunca crea un segundo testimonio.
 */
export type EstadoTestimonioPublico =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; error: string; errores?: Partial<Record<CampoTestimonio, string>> }
  | { status: "enlace"; estado: "USADA" | "VENCIDA" | "INEXISTENTE" };

const MENSAJE_COMUN = "No pudimos enviar tu testimonio. Probá de nuevo en unos minutos.";
const MENSAJE_NO_DISPONIBLE = "Este formulario no está disponible.";
const MENSAJE_PERMISO = "Para enviarlo, marcá la casilla que nos da permiso para publicarlo.";
const MENSAJE_REVISAR = "Revisá los datos marcados.";

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
};

export async function enviarTestimonio(_prev: EstadoTestimonioPublico, formData: FormData): Promise<EstadoTestimonioPublico> {
  // Un robot llenó el campo trampa: la misma respuesta que con éxito, sin crear nada.
  if (cayoEnLaTrampa(formData.get(CAMPO_TRAMPA))) {
    console.warn("[testimonios] formulario descartado", { codigo: "CAMPO_TRAMPA" });
    return { status: "ok" };
  }
  let fotoKey: string | null = null;
  try {
    const sitio = await sitioDelFormulario(texto(formData, "workspaceSlug").trim());
    if (!sitio) return { status: "error", error: MENSAJE_NO_DISPONIBLE };

    const validado = validarTestimonio({
      texto: texto(formData, "texto"),
      autorNombre: texto(formData, "autorNombre"),
      autorDetalle: texto(formData, "autorDetalle"),
      autorEnlace: texto(formData, "autorEnlace"),
      autorEmail: texto(formData, "autorEmail"),
      calificacion: texto(formData, "calificacion"),
    });
    if (!validado.ok) return { status: "error", error: MENSAJE_REVISAR, errores: validado.errores };
    if (formData.get("consentimiento") !== "si") return { status: "error", error: MENSAJE_PERMISO };
    // Un enlace que ya no sirve se dice antes de subir nada (la transacción lo vuelve a mirar).
    const token = texto(formData, "t").trim();
    if (token) {
      const leida = await leerInvitacion(sitio.workspaceId, token);
      if (leida.estado !== "VALIDA") return { status: "enlace", estado: leida.estado };
    }
    const archivo = archivoDeFoto(formData.get("foto"));
    const revisada = archivo ? await revisarFotoAutor(archivo) : null;
    if (revisada && !revisada.ok) return { status: "error", error: revisada.error };

    // El freno cuenta sólo envíos válidos, justo antes de escribir (en R2 o en la base).
    if (await frenadoPorIp("testimonio", FRENO_TESTIMONIOS)) return { status: "error", error: MENSAJE_FRENO_TESTIMONIO };

    let foto: { key: string; url: string } | null = null;
    if (revisada) {
      const r = await subirFotoAutor(sitio.workspaceId, revisada);
      if (!r.ok) return { status: "error", error: r.error };
      foto = r.valor;
      fotoKey = r.valor.key;
    }

    const consentimientoTexto = textoConsentimiento(sitio.estudio);
    if (token) {
      const r = await responderInvitacion(sitio.workspaceId, token, validado.datos, {
        consentimiento: true,
        consentimientoTexto,
        autorFotoUrl: foto?.url ?? null,
        autorFotoKey: foto?.key ?? null,
      });
      if (!r.ok) {
        // El enlace ya no servía: la foto de ESTE envío (su propia key) no queda en R2.
        await borrarFotoAutor(fotoKey);
        return { status: "enlace", estado: r.estado };
      }
    } else {
      await crearTestimonio(sitio.workspaceId, validado.datos, {
        origen: "FORMULARIO",
        consentimiento: true,
        consentimientoTexto,
        autorFotoUrl: foto?.url ?? null,
        autorFotoKey: foto?.key ?? null,
      });
    }
    fotoKey = null;
    // Nunca lanza: el testimonio ya quedó guardado.
    await avisarTestimonioNuevo(sitio.workspaceId, { autorNombre: validado.datos.autorNombre, texto: validado.datos.texto });
    return { status: "ok" };
  } catch (error) {
    await borrarFotoAutor(fotoKey);
    // Sólo el tipo y el código: el mensaje de Prisma puede repetir los datos de la persona.
    const e = error as { name?: string; code?: string } | null;
    console.error("[testimonios] formulario público falló", { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
    return { status: "error", error: MENSAJE_COMUN };
  }
}
