"use server";

import { redirect } from "next/navigation";
import { codigoDeError } from "@/lib/avisos";
import { requireLevel } from "@/lib/guards";
import { reportTarget, reportUser } from "@/lib/usuarios/reportes";

function texto(formData: FormData, campo: string): string {
  const v = formData.get(campo);
  return typeof v === "string" ? v : "";
}

/**
 * «Reportar a esta persona». El formulario manda sólo el origen y el número (y, desde los
 * interesados, a quién); a quién se reporta y el contexto se resuelven en el servidor. Vuelve a
 * la misma pantalla con un código (nunca texto libre en la URL).
 */
export async function reportarUsuario(formData: FormData) {
  const origen = texto(formData, "origen");
  const ref = Number(texto(formData, "ref"));
  const persona = Number(texto(formData, "persona")) || undefined;

  const provisorio =
    origen === "venta" ? "/compras" : origen === "interesado" ? "/mis-publicaciones" : "/equipos";
  const user = await requireLevel("identidad", provisorio);

  const destino = await reportTarget(user.id, origen, ref, persona);
  if (!destino) redirect(provisorio);

  let url = `${destino.volver}?ok=REPORTE_USUARIO_ENVIADO`;
  try {
    await reportUser(user.id, destino.reportedId, texto(formData, "motivo"), destino.context);
  } catch (err) {
    url = `${destino.volver}?error=${codigoDeError(err, { origen: "reportar-usuario" })}`;
  }
  redirect(url);
}
