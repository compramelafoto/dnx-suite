"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { buscarContactos, type ContactoEncontrado } from "@/lib/consultas/ficha";
import { MENSAJES_GALERIA } from "@/lib/galerias/acceso";
import { guardarAjustesGaleria, type ResultadoAjustesGaleria } from "@/lib/galerias/ajustes";
import {
  agregarClienteGaleria, anularEnlace, enlaceDeCliente, pedirEnvioPorCorreo, regenerarEnlace, whatsappDeCliente,
  type ResultadoCliente, type ResultadoSimpleCliente,
} from "@/lib/galerias/clientes";
import { finalizarSeleccion, reactivarSeleccion, responderComentario, type ResultadoRespuesta, type ResultadoTransicion } from "@/lib/galerias/revision";
import { contextoDeGalerias } from "@/lib/galerias/contexto";
import { prepararDescargaDelEstudio, urlDeParteDelEstudio, type ResultadoPedido, type SalidaUrl } from "@/lib/galerias/descargas";
import { enviarCorreoEnlace } from "@/lib/galerias/correos";
import {
  archivarGaleria, borrarFotoDeGaleria, buscarProyectos, crearGaleria, editarGaleria, establecerModoOrden, fotosPorIds,
  publicarGaleria, reactivarGaleria, vistasPorIds, type ProyectoEncontrado, type ResultadoGaleria, type ResultadoSimpleGaleria,
} from "@/lib/galerias/galerias";
import { marcarCompraPagadaAMano, type ResultadoPagoAMano } from "@/lib/galerias/compras";
import { guardarVentaGaleria, type ResultadoVenta } from "@/lib/galerias/venta";
import { establecerPortada, pedirSubidaFoto, reordenarFotos, type FotoVisible } from "@/lib/galerias/fotos";

// Archivo "use server": sólo exporta funciones async. Cada acción revisa la forma de lo que llega, arma
// el contexto (sesión + workspace de la sesión + módulo `gallery` encendido + el nivel pedido) y recién
// ahí escribe. Los permisos finos y la pertenencia de cada id al workspace se vuelven a validar en
// `lib/galerias`.

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function esId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

const DATOS_INVALIDOS = { ok: false, error: MENSAJES_GALERIA.datosInvalidos } as const;
const SIN_PERMISO = { ok: false, error: MENSAJES_GALERIA.sinPermiso } as const;

const RUTA_AJUSTES = "/workspace/configuracion/galeria";

function refrescar(galeriaId?: string, proyectoId?: string): void {
  revalidatePath("/galerias");
  if (galeriaId) revalidatePath(`/galerias/${galeriaId}`);
  if (proyectoId) revalidatePath(`/proyectos/${proyectoId}`);
}

// --- Ajustes (configurar) ---------------------------------------------------------------------

/** Configuración → Galería: los valores con los que nace cada galería nueva. */
export async function guardarAjustesGaleriaAction(datos: unknown): Promise<ResultadoAjustesGaleria> {
  if (!esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("configurar");
  if (!ctx) return SIN_PERMISO;
  const r = await guardarAjustesGaleria(ctx, datos);
  if (r.ok) revalidatePath(RUTA_AJUSTES);
  return r;
}

// --- Galería: crear, editar y cambiar de estado (Gestionar) ----------------------------------------------

/** Crea una galería en borrador para un proyecto (con los valores por omisión de Configuración → Galería). */
export async function crearGaleriaAction(datos: unknown): Promise<ResultadoGaleria> {
  if (!esObjeto(datos) || !esId(datos.proyectoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await crearGaleria(ctx, datos);
  if (r.ok) refrescar(undefined, datos.proyectoId);
  return r;
}

export async function editarGaleriaAction(galeriaId: string, datos: unknown): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await editarGaleria(ctx, galeriaId, datos);
  if (r.ok) refrescar(galeriaId);
  return r;
}

export async function publicarGaleriaAction(galeriaId: string): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await publicarGaleria(ctx, galeriaId);
  if (r.ok) refrescar(galeriaId);
  return r;
}

export async function archivarGaleriaAction(galeriaId: string): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await archivarGaleria(ctx, galeriaId);
  if (r.ok) refrescar(galeriaId);
  return r;
}

export async function reactivarGaleriaAction(galeriaId: string): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await reactivarGaleria(ctx, galeriaId);
  if (r.ok) refrescar(galeriaId);
  return r;
}

/** Buscador de proyectos para crear una galería desde el listado. */
export async function buscarProyectosGaleriaAction(
  texto: string,
): Promise<{ ok: true; proyectos: ProyectoEncontrado[] } | { ok: false; error: string }> {
  if (typeof texto !== "string" || texto.length > 200) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  return buscarProyectos(ctx, texto);
}

// --- Fotos (Gestionar) -------------------------------------------------------------------------------

/** Reserva la foto (fila PENDIENTE) y devuelve el PUT firmado de 15 minutos. El navegador sube directo a R2 y después confirma por `/api/galerias/[id]/fotos/confirmar`. */
export async function pedirSubidaFotoAction(
  galeriaId: string,
  archivo: { nombre: string; tipo: string; tamano: number },
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (!esId(galeriaId) || !esObjeto(archivo)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  return pedirSubidaFoto(ctx, galeriaId, { nombre: archivo.nombre, tipo: archivo.tipo, tamano: archivo.tamano });
}

/** Fotos puntuales (hasta 100) con sus miniaturas firmadas: la grilla las pide mientras se sube. */
export async function fotosPorIdsAction(galeriaId: string, ids: string[]): Promise<{ ok: true; fotos: FotoVisible[] } | { ok: false; error: string }> {
  if (!esId(galeriaId) || !Array.isArray(ids) || ids.length > 100 || !ids.every(esId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("ver");
  if (!ctx) return SIN_PERMISO;
  return { ok: true, fotos: await fotosPorIds(ctx, galeriaId, ids) };
}

/** La vista grande (2048 px) de la foto que se abre y sus vecinas (hasta 20): se pide al abrirla, no al armar la ficha. */
export async function vistasPorIdsAction(galeriaId: string, ids: string[]): Promise<{ ok: true; vistas: Record<string, string> } | { ok: false; error: string }> {
  if (!esId(galeriaId) || !Array.isArray(ids) || ids.length > 20 || !ids.every(esId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("ver");
  if (!ctx) return SIN_PERMISO;
  return { ok: true, vistas: await vistasPorIds(ctx, galeriaId, ids) };
}

export async function borrarFotoAction(galeriaId: string, fotoId: string): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId) || !esId(fotoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await borrarFotoDeGaleria(ctx, galeriaId, fotoId);
  if (r.ok) revalidatePath("/galerias");
  return r;
}

/** Orden manual: las fotos indicadas quedan en ese orden (la galería pasa a orden manual). */
export async function reordenarFotosAction(galeriaId: string, ids: string[]): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId) || !Array.isArray(ids) || ids.length > 3000 || !ids.every(esId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  return reordenarFotos(ctx, galeriaId, ids);
}

export async function establecerModoOrdenAction(galeriaId: string, modo: string): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId) || typeof modo !== "string") return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  return establecerModoOrden(ctx, galeriaId, modo);
}

export async function establecerPortadaAction(galeriaId: string, fotoId: string | null): Promise<ResultadoSimpleGaleria> {
  if (!esId(galeriaId) || (fotoId !== null && !esId(fotoId))) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await establecerPortada(ctx, galeriaId, fotoId);
  if (r.ok) revalidatePath("/galerias");
  return r;
}

// --- Clientes de la galería (Gestionar) ---------------------------------------------------------------------

/**
 * Buscador de contactos para agregar un cliente: "Gestionar" en Galería y, además, "Ver" en Clientes
 * (regla R10: es el padrón de clientes).
 */
export async function buscarContactosGaleriaAction(
  texto: string,
): Promise<{ ok: true; contactos: ContactoEncontrado[] } | { ok: false; error: string }> {
  if (typeof texto !== "string" || texto.length > 200) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  if (!puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) return { ok: false, error: MENSAJES_GALERIA.buscarClientes };
  return { ok: true, contactos: await buscarContactos(ctx.workspaceId, texto) };
}

/** Agrega un cliente a la galería: un contacto (`clientId`) o un alta rápida (`nombre` y `email` o `telefono`). */
export async function agregarClienteGaleriaAction(galeriaId: string, datos: unknown): Promise<ResultadoCliente> {
  if (!esId(galeriaId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  // Elegir un contacto del padrón exige poder ver Clientes; el alta rápida no.
  if (datos.clientId !== undefined && datos.clientId !== null && !puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) {
    return { ok: false, error: MENSAJES_GALERIA.buscarClientes };
  }
  const r = await agregarClienteGaleria(ctx, galeriaId, datos);
  if (r.ok) refrescar(galeriaId);
  return r;
}

/** "Copiar enlace": la dirección vigente de un cliente (galería publicada y enlace sin anular). */
export async function enlaceDeClienteGaleriaAction(galeriaClienteId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!esId(galeriaClienteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  return enlaceDeCliente(ctx, galeriaClienteId);
}

/** "WhatsApp": el enlace wa.me con el texto armado. */
export async function whatsappDeClienteGaleriaAction(galeriaClienteId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!esId(galeriaClienteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  return whatsappDeCliente(ctx, galeriaClienteId);
}

/**
 * "Enviar por correo": valida y deja el pedido en el historial; el correo sale con `after()` (no frena la
 * respuesta y una falla del proveedor no deshace nada). El resultado final queda en el historial.
 */
export async function enviarEnlaceGaleriaPorCorreoAction(galeriaClienteId: string): Promise<ResultadoSimpleCliente> {
  if (!esId(galeriaClienteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await pedirEnvioPorCorreo(ctx, galeriaClienteId);
  if (r.ok) {
    const { workspaceId, userId } = ctx;
    after(() => enviarCorreoEnlace(workspaceId, galeriaClienteId, userId).then(() => undefined));
    refrescar(r.galeriaId);
    return { ok: true };
  }
  return r;
}

export async function regenerarEnlaceGaleriaAction(galeriaClienteId: string): Promise<ResultadoSimpleCliente> {
  if (!esId(galeriaClienteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await regenerarEnlace(ctx, galeriaClienteId);
  if (r.ok) revalidatePath("/galerias");
  return r;
}

export async function anularEnlaceGaleriaAction(galeriaClienteId: string): Promise<ResultadoSimpleCliente> {
  if (!esId(galeriaClienteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await anularEnlace(ctx, galeriaClienteId);
  if (r.ok) revalidatePath("/galerias");
  return r;
}

// --- Revisión de la selección de un cliente (Gestionar) --------------------------------------------------

function refrescarRevision(galeriaId: string, galeriaClienteId: string): void {
  revalidatePath("/galerias");
  revalidatePath(`/galerias/${galeriaId}`);
  revalidatePath(`/galerias/${galeriaId}/clientes/${galeriaClienteId}`);
}

/** El estudio responde en la conversación de una foto del cliente (hasta 2.000 caracteres). */
export async function responderComentarioGaleriaAction(galeriaId: string, galeriaClienteId: string, fotoId: string, texto: string): Promise<ResultadoRespuesta> {
  if (!esId(galeriaId) || !esId(galeriaClienteId) || !esId(fotoId) || typeof texto !== "string") return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  return responderComentario(ctx, galeriaId, galeriaClienteId, fotoId, texto);
}

/** Cierra la selección ya revisada (sólo si el cliente la envió y espera revisión). */
export async function finalizarSeleccionGaleriaAction(galeriaId: string, galeriaClienteId: string): Promise<ResultadoTransicion> {
  if (!esId(galeriaId) || !esId(galeriaClienteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await finalizarSeleccion(ctx, galeriaId, galeriaClienteId);
  if (r.ok) refrescarRevision(galeriaId, galeriaClienteId);
  return r;
}

/** Le devuelve la selección al cliente para que siga eligiendo (conserva lo elegido). */
export async function reactivarSeleccionGaleriaAction(galeriaId: string, galeriaClienteId: string): Promise<ResultadoTransicion> {
  if (!esId(galeriaId) || !esId(galeriaClienteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await reactivarSeleccion(ctx, galeriaId, galeriaClienteId);
  if (r.ok) refrescarRevision(galeriaId, galeriaClienteId);
  return r;
}

// --- Venta de fotos extra (Gestionar) -------------------------------------------------------------------------

/**
 * Guarda la pestaña Venta: modo de venta, incluidas, precio por foto o por paquete, descuentos y rubro de
 * ingreso. Se valida en el servidor (`validarConfigVenta`); no toca las compras ya hechas.
 */
export async function guardarVentaGaleriaAction(galeriaId: string, datos: unknown): Promise<ResultadoVenta> {
  if (!esId(galeriaId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await guardarVentaGaleria(ctx, galeriaId, datos);
  if (r.ok) refrescar(galeriaId);
  return r;
}

/**
 * "Marcar pagada a mano": cobra las fotos extra que el cliente tiene elegidas hoy (el precio lo calcula el
 * servidor), con el medio y la fecha indicados, y lo registra en Caja si está encendida.
 */
export async function marcarCompraPagadaAManoAction(galeriaId: string, galeriaClienteId: string, datos: unknown): Promise<ResultadoPagoAMano> {
  if (!esId(galeriaId) || !esId(galeriaClienteId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await marcarCompraPagadaAMano(ctx, galeriaId, galeriaClienteId, datos);
  if (r.ok) refrescarRevision(galeriaId, galeriaClienteId);
  return r;
}

// --- Descarga completa (entrega) ------------------------------------------------------------------------

/**
 * «Preparar descarga» (galería de entrega): arma en segundo plano el ZIP de todos los archivos, en partes de hasta
 * 1 GB, y avisa por correo al usuario que la pidió. Tope de 3 por día y uno activo a la vez.
 */
export async function prepararDescargaGaleriaAction(galeriaId: string): Promise<ResultadoPedido> {
  if (!esId(galeriaId)) return { ok: false, error: MENSAJES_GALERIA.datosInvalidos, codigo: "GENERICO" };
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return { ok: false, error: MENSAJES_GALERIA.sinPermiso, codigo: "GENERICO" };
  const r = await prepararDescargaDelEstudio(ctx, galeriaId);
  if (r.ok) refrescar(galeriaId);
  return r;
}

/** Enlace firmado (5 minutos) de una parte ya armada, para bajarla desde la ficha. Con permiso de Ver. */
export async function urlParteDescargaGaleriaAction(galeriaId: string, descargaId: string, tipo: "ZIP" | "SUELTO", n: number): Promise<SalidaUrl> {
  if (!esId(galeriaId) || !esId(descargaId) || (tipo !== "ZIP" && tipo !== "SUELTO") || typeof n !== "number" || !Number.isInteger(n)) return { ok: false, error: MENSAJES_GALERIA.datosInvalidos };
  const ctx = await contextoDeGalerias("ver");
  if (!ctx) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  return urlDeParteDelEstudio(ctx, galeriaId, descargaId, tipo, n);
}
