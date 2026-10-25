"use server";

import { redirect } from "next/navigation";
import { contextoFacturacion } from "@/lib/invoicing/access";
import { esAmbiente } from "@/lib/invoicing/constants";
import { generarPedidoCertificado, guardarPerfil, probarConexion, subirCertificado, type PruebaConexion } from "@/lib/invoicing/servicio";

const RUTA = "/workspace/configuracion/facturacion";

function volver(params: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (params.ok) q.set("ok", params.ok);
  if (params.error) q.set("error", params.error.slice(0, 400));
  redirect(`${RUTA}?${q.toString()}`);
}

/** Sesión, workspace, módulo encendido y dueño/administrador: todo sale de la sesión. */
async function contexto() {
  const c = await contextoFacturacion();
  if (!c || !c.puedeConfigurar) volver({ error: "Sólo el dueño o un administrador pueden configurar la facturación." });
  return c;
}

function campo(fd: FormData, nombre: string, max = 300): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.slice(0, max) : "";
}

export async function guardarPerfilAction(fd: FormData) {
  const c = await contexto();
  const r = await guardarPerfil(c.ctx, {
    cuit: campo(fd, "cuit", 20),
    razonSocial: campo(fd, "razonSocial"),
    ivaCondition: campo(fd, "ivaCondition", 30),
    domicilioFiscal: campo(fd, "domicilioFiscal"),
    ingresosBrutos: campo(fd, "ingresosBrutos", 50),
    inicioActividades: campo(fd, "inicioActividades", 10),
    defaultPointOfSale: campo(fd, "defaultPointOfSale", 6),
    activeEnvironment: campo(fd, "activeEnvironment", 20),
  });
  if (!r.ok) volver({ error: r.error });
  volver({ ok: "Datos fiscales guardados." });
}

export async function generarCsrAction(fd: FormData) {
  const c = await contexto();
  const env = campo(fd, "environment", 20);
  if (!esAmbiente(env)) volver({ error: "Ambiente inválido." });
  const r = await generarPedidoCertificado(c.ctx, env, campo(fd, "alias", 50).trim(), fd.get("reemplazar") === "1");
  if (!r.ok) volver({ error: r.error });
  volver({ ok: "Listo: ya podés descargar el pedido de certificado y subirlo a ARCA." });
}

export async function subirCertificadoAction(fd: FormData) {
  const c = await contexto();
  const env = campo(fd, "environment", 20);
  if (!esAmbiente(env)) volver({ error: "Ambiente inválido." });
  const archivo = fd.get("certificado");
  let texto = campo(fd, "certificadoTexto", 20_000);
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > 20_000) volver({ error: "Ese archivo es demasiado grande para ser un certificado." });
    texto = await archivo.text();
  }
  if (!texto.trim()) volver({ error: "Elegí el archivo del certificado (.crt) que bajaste de ARCA." });
  const r = await subirCertificado(c.ctx, env, texto);
  if (!r.ok) volver({ error: r.error });
  volver({ ok: "Certificado guardado. Probá la conexión." });
}

export type EstadoPrueba = { resultado: PruebaConexion | null; error: string | null };

export async function probarConexionAction(_prev: EstadoPrueba | undefined, fd: FormData): Promise<EstadoPrueba> {
  const c = await contextoFacturacion();
  if (!c || !c.puedeConfigurar) return { resultado: null, error: "Sólo el dueño o un administrador." };
  const env = campo(fd, "environment", 20);
  if (!esAmbiente(env)) return { resultado: null, error: "Ambiente inválido." };
  return { resultado: await probarConexion(c.workspace.id, env), error: null };
}
