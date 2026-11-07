"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { recortarNombreEspacio, retornoPermitido, urlDeVuelta } from "@/lib/fotoffice-conexion/llaves";
import { crearCodigo } from "@/lib/fotoffice-conexion/servicio";
import { stateValido } from "./state";

function leer(formData: FormData) {
  const txt = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return { state: txt("state"), espacio: txt("espacio"), vuelta: txt("vuelta") };
}

function paginaInvalida(): never {
  redirect("/conectar/fotoffice?invalido=1");
}

/** «Autorizar»: crea un código de un solo uso (2 minutos) y vuelve a FOTOFFICE con `?code=…&state=…`. */
export async function autorizarFotofficeAction(formData: FormData) {
  const { state, espacio, vuelta } = leer(formData);
  if (!retornoPermitido(vuelta) || !stateValido(state)) paginaInvalida();

  const qs = new URLSearchParams({ state, espacio, vuelta }).toString();
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error === "No autenticado") redirect(`/login?redirect=${encodeURIComponent(`/conectar/fotoffice?${qs}`)}`);
  // `requireAuth` también deja pasar cuentas LAB puras: sólo fotógrafos autorizan. Si no lo es, vuelve a la página,
  // que muestra el aviso (no al login).
  if (!user || (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER)) redirect(`/conectar/fotoffice?${qs}`);

  const code = await crearCodigo({ userId: user.id, externalLabel: recortarNombreEspacio(espacio), returnUrl: vuelta });
  redirect(urlDeVuelta(vuelta, { code, state }));
}

/** «Cancelar»: vuelve a FOTOFFICE con `?error=cancelado&state=…`, sin crear nada. */
export async function cancelarFotofficeAction(formData: FormData) {
  const { state, vuelta } = leer(formData);
  if (!retornoPermitido(vuelta) || !stateValido(state)) paginaInvalida();
  redirect(urlDeVuelta(vuelta, { error: "cancelado", state }));
}
