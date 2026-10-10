import "server-only";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { cuandoEsLaInauguracion, lugarDeLaInauguracion } from "@/lib/inauguracion/lugar";
import { enviar } from "./enviar";
import { textoAsistencia, textoLugarLiberado } from "./textos-inauguracion";

/**
 * Correos de la asistencia. Ninguno tira y devuelven si salió: con el correo apagado, todo anda
 * igual (el enlace personal se muestra en pantalla al confirmar).
 */
export type MuestraDelCorreo = {
  title: string; slug: string; openingAt: Date | null; openingEndsAt: Date | null;
  venueName: string | null; address: string | null; city: string | null;
};

function datos(nombre: string, m: MuestraDelCorreo) {
  const invitacion = `${baseUrlPublica()}/m/${m.slug}/inauguracion`;
  return { nombre, muestra: m.title, cuando: cuandoEsLaInauguracion(m), lugar: lugarDeLaInauguracion(m), invitacion, ics: `${invitacion}/evento.ics` };
}

export async function avisarAsistencia(p: { email: string; nombre: string; estado: "CONFIRMED" | "WAITLIST"; enlace: string; muestra: MuestraDelCorreo }): Promise<boolean> {
  try {
    const t = textoAsistencia({ ...datos(p.nombre, p.muestra), estado: p.estado, enlace: p.enlace });
    return await enviar(p.email, t.subject, t.parrafos, t.enlace);
  } catch (err) {
    console.error("[muestras] falló el aviso de asistencia", err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function avisarLugarLiberado(p: { email: string; nombre: string; muestra: MuestraDelCorreo }): Promise<boolean> {
  try {
    const t = textoLugarLiberado(datos(p.nombre, p.muestra));
    return await enviar(p.email, t.subject, t.parrafos, t.enlace);
  } catch (err) {
    console.error("[muestras] falló el aviso de lugar liberado", err instanceof Error ? err.message : String(err));
    return false;
  }
}
