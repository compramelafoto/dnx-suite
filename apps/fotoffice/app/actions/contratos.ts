"use server";

import { revalidatePath } from "next/cache";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MENSAJES_CONTRATO } from "@/lib/contratos/acceso";
import { FIRMA_EMPRESA_MAX_BYTES, guardarAjustesContratos, guardarFirmaEmpresa, quitarFirmaEmpresa, type ResultadoAjustes } from "@/lib/contratos/ajustes";
import { contextoDeContratos } from "@/lib/contratos/contexto";
import { fijarContratante, quitarContratante2, type ResultadoContratante } from "@/lib/contratos/contratantes";
import {
  crearPlantilla, editarPlantilla, eliminarPlantilla, type ResultadoPlantilla, type ResultadoSimple,
} from "@/lib/contratos/plantillas";
import { buscarContactos, type ContactoEncontrado } from "@/lib/consultas/ficha";

// Archivo "use server": sólo exporta funciones async. Cada acción revisa la forma de lo que llega,
// arma el contexto (sesión + workspace de la sesión + módulo `contracts` encendido + el nivel pedido)
// y recién ahí escribe. Los permisos finos (`configurar` para plantillas y ajustes) y los ids se
// validan contra el workspace en `lib/contratos`.

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function esId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

const DATOS_INVALIDOS = { ok: false, error: MENSAJES_CONTRATO.datosInvalidos } as const;
const SIN_PERMISO = { ok: false, error: MENSAJES_CONTRATO.sinPermiso } as const;

const RUTA_AJUSTES = "/workspace/configuracion/contratos";
const RUTA_PLANTILLAS = "/workspace/configuracion/contratos/plantillas";

// --- Ajustes (configurar) ---------------------------------------------------------------------

/** Configuración → Contratos: datos de la empresa, cláusula de consentimiento y recordatorios. */
export async function guardarAjustesContratosAction(datos: unknown): Promise<ResultadoAjustes> {
  if (!esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await guardarAjustesContratos(ctx, datos);
  if (r.ok) revalidatePath(RUTA_AJUSTES);
  return r;
}

/** Sube la imagen de la firma de la empresa (campo `archivo` del formulario; PNG o JPG hasta 1 MB). */
export async function subirFirmaEmpresaAction(formData: FormData): Promise<ResultadoAjustes> {
  const archivo = formData instanceof FormData ? formData.get("archivo") : null;
  if (!(archivo instanceof File)) return DATOS_INVALIDOS;
  if (archivo.size > FIRMA_EMPRESA_MAX_BYTES) return { ok: false, error: MENSAJES_CONTRATO.firmaTamano };
  const ctx = await contextoDeContratos("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await guardarFirmaEmpresa(ctx, new Uint8Array(await archivo.arrayBuffer()));
  if (r.ok) revalidatePath(RUTA_AJUSTES);
  return r;
}

export async function quitarFirmaEmpresaAction(): Promise<ResultadoAjustes> {
  const ctx = await contextoDeContratos("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await quitarFirmaEmpresa(ctx);
  if (r.ok) revalidatePath(RUTA_AJUSTES);
  return r;
}

// --- Plantillas (configurar) ------------------------------------------------------------------

export async function crearPlantillaContratoAction(datos: unknown): Promise<ResultadoPlantilla> {
  if (!esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await crearPlantilla(ctx, datos);
  if (r.ok) revalidatePath(RUTA_PLANTILLAS);
  return r;
}

export async function editarPlantillaContratoAction(id: string, datos: unknown): Promise<ResultadoSimple> {
  if (!esId(id) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await editarPlantilla(ctx, id, datos);
  if (r.ok) revalidatePath(RUTA_PLANTILLAS);
  return r;
}

export async function eliminarPlantillaContratoAction(id: string): Promise<ResultadoSimple> {
  if (!esId(id)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("ver");
  if (!ctx) return SIN_PERMISO;
  const r = await eliminarPlantilla(ctx, id);
  if (r.ok) revalidatePath(RUTA_PLANTILLAS);
  return r;
}

// --- Contratantes del pedido (Gestionar) ------------------------------------------------------

export async function fijarContratanteAction(datos: { pedidoId: string; orden: 1 | 2; clientId: string }): Promise<ResultadoContratante> {
  if (!esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await fijarContratante(ctx, datos);
  if (r.ok && esId(datos.pedidoId)) revalidatePath(`/pedidos/${datos.pedidoId}`);
  return r;
}

export async function quitarContratante2Action(pedidoId: string): Promise<ResultadoContratante> {
  if (!esId(pedidoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await quitarContratante2(ctx, pedidoId);
  if (r.ok) revalidatePath(`/pedidos/${pedidoId}`);
  return r;
}

/**
 * Buscador de contactos para elegir contratantes: "Gestionar" en Contratos y, además, "Ver" en Clientes
 * (regla R10: es el padrón de clientes).
 */
export async function buscarContactosContratosAction(
  texto: string,
): Promise<{ ok: true; contactos: ContactoEncontrado[] } | { ok: false; error: string }> {
  if (typeof texto !== "string" || texto.length > 200) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  if (!puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) return { ok: false, error: MENSAJES_CONTRATO.buscarClientes };
  return { ok: true, contactos: await buscarContactos(ctx.workspaceId, texto) };
}
