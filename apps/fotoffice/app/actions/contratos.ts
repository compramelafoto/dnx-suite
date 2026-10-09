"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MENSAJES_CONTRATO } from "@/lib/contratos/acceso";
import { FIRMA_EMPRESA_MAX_BYTES, guardarAjustesContratos, guardarFirmaEmpresa, quitarFirmaEmpresa, type ResultadoAjustes } from "@/lib/contratos/ajustes";
import { contextoDeContratos } from "@/lib/contratos/contexto";
import { actualizarDatos, anular, editarBorrador, generarContrato, marcarFirmadoEnPapel, type ResultadoContrato, type ResultadoGenerar } from "@/lib/contratos/contratos";
import { enviar, enviarCorreoAlFirmante, enviarCorreosDeVersion, reenviarEnlace, type ResultadoEnviar, type ResultadoReenviar } from "@/lib/contratos/envio";
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

// --- Contrato: generar, editar, enviar, anular (Gestionar) -------------------------------------------

function refrescar(contratoId?: string): void {
  revalidatePath("/contratos");
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}

/** Genera un contrato en borrador desde un pedido y una plantilla. */
export async function generarContratoAction(pedidoId: string, templateId: string): Promise<ResultadoGenerar> {
  if (!esId(pedidoId) || !esId(templateId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await generarContrato(ctx, pedidoId, templateId);
  if (r.ok) {
    refrescar(r.id);
    revalidatePath(`/pedidos/${pedidoId}`);
  }
  return r;
}

export async function editarBorradorContratoAction(contratoId: string, datos: unknown): Promise<ResultadoContrato> {
  if (!esId(contratoId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await editarBorrador(ctx, contratoId, datos);
  if (r.ok) refrescar(contratoId);
  return r;
}

/** "Actualizar datos": vuelve a armar el texto desde la plantilla y pisa lo editado a mano (hay que confirmar). */
export async function actualizarDatosContratoAction(contratoId: string, confirmar: boolean): Promise<ResultadoGenerar> {
  if (!esId(contratoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await actualizarDatos(ctx, contratoId, confirmar);
  if (r.ok) refrescar(contratoId);
  return r;
}

/**
 * Envía el contrato a firmar. Con el contrato ya enviado, `textoCorregido` crea una versión nueva y revoca
 * la anterior. Los correos salen con `after()`: no frenan la respuesta y una falla del proveedor no deshace nada.
 */
export async function enviarContratoAction(contratoId: string, textoCorregido?: string): Promise<ResultadoEnviar> {
  if (!esId(contratoId) || (textoCorregido !== undefined && typeof textoCorregido !== "string")) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await enviar(ctx, contratoId, { textoCorregido });
  if (r.ok) {
    const { workspaceId } = ctx;
    after(() => enviarCorreosDeVersion(workspaceId, contratoId, r.versionId).then(() => undefined));
    refrescar(contratoId);
  }
  return r;
}

export async function reenviarEnlaceContratoAction(firmanteId: string): Promise<ResultadoReenviar> {
  if (!esId(firmanteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await reenviarEnlace(ctx, firmanteId);
  if (r.ok) {
    const { workspaceId } = ctx;
    after(() => enviarCorreoAlFirmante(workspaceId, firmanteId).then(() => undefined));
    refrescar(r.contratoId);
  }
  return r;
}

export async function anularContratoAction(contratoId: string, motivo: string): Promise<ResultadoContrato> {
  if (!esId(contratoId) || typeof motivo !== "string") return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await anular(ctx, contratoId, motivo);
  if (r.ok) refrescar(contratoId);
  return r;
}

/** Marca el contrato como firmado en papel, con el escaneo subido a la ficha del contacto como respaldo. */
export async function marcarFirmadoEnPapelAction(contratoId: string, adjuntoId: string): Promise<ResultadoContrato> {
  if (!esId(contratoId) || !esId(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeContratos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await marcarFirmadoEnPapel(ctx, contratoId, adjuntoId);
  if (r.ok) refrescar(contratoId);
  return r;
}
