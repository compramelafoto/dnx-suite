import "server-only";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { clientDisplayName } from "@/lib/clients/display";
import { esTablaFaltante, esTokenValido, rutaPublica } from "./base";
import { faltantesDeFabrica } from "./de-fabrica";
import { enlacesDeEnvio, type EnlacesDeEnvio } from "./mensaje";
import { agruparPorSeccion, normalizarRespuestas, TOPE_ENVIO, type ErrorDeRespuesta, type GrupoDeRespuestas } from "./respuestas";
import { leerDefinicion, leerRespuestasGuardadas, type DefinicionCuestionario, type RespuestaGuardada } from "./tipos";

/**
 * Cuestionarios para clientes, la parte con base de datos.
 *
 * Las tablas se crean a mano (`20270216090000_fotoffice_cuestionarios`). Hasta entonces todo lo de
 * acá devuelve vacío o `null` en vez de romper la ficha del cliente.
 */

function avisar(donde: string, error: unknown) {
  console.error(`[fotoffice][cuestionarios] ${donde}`, { detalle: error instanceof Error ? error.message : String(error) });
}

/** Ejecuta una consulta y, si las tablas todavía no existen, devuelve `vacio`. */
async function tolerante<T>(donde: string, vacio: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (esTablaFaltante(error)) return vacio;
    avisar(donde, error);
    throw error;
  }
}

function nuevoToken(): string {
  return randomBytes(24).toString("base64url");
}

/** El origen público de la aplicación (para armar el enlace), o el de la visita si no está configurado. */
export async function origenPublico(): Promise<string> {
  const configurado = appUrl();
  if (configurado) return configurado;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function nombreDelEstudio(workspaceId: string): Promise<{ nombre: string; logoUrl: string | null }> {
  const [ws, branding] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { commercialName: true, logoUrl: true } }).catch(() => null),
  ]);
  return { nombre: branding?.commercialName?.trim() || ws?.name || "", logoUrl: branding?.logoUrl?.trim() || null };
}

/**
 * Crea los cuestionarios de fábrica que le falten al workspace. Idempotente: `skipDuplicates`
 * sobre el único (workspaceId, clave), así dos pedidos a la vez no duplican nada. Uno que el
 * estudio desactivó no se vuelve a activar, y uno que editó no se pisa.
 */
export async function asegurarCuestionariosDeFabrica(workspaceId: string): Promise<void> {
  await tolerante("asegurar de fábrica", undefined, async () => {
    const existentes = await prisma.fotofficeCuestionario.findMany({ where: { workspaceId }, select: { clave: true } });
    const faltan = faltantesDeFabrica(existentes.map((e) => e.clave));
    if (faltan.length === 0) return;
    await prisma.fotofficeCuestionario.createMany({
      data: faltan.map((c) => ({
        workspaceId,
        clave: c.clave,
        nombre: c.nombre,
        intro: c.intro,
        orden: c.orden,
        definicion: c.definicion as unknown as object,
      })),
      skipDuplicates: true,
    });
  });
}

export type CuestionarioListado = { id: string; clave: string; nombre: string; activo: boolean };

/** Los cuestionarios del workspace (crea los de fábrica la primera vez). */
export async function listarCuestionarios(workspaceId: string, opciones: { soloActivos?: boolean } = {}): Promise<CuestionarioListado[]> {
  await asegurarCuestionariosDeFabrica(workspaceId);
  return tolerante("listar", [] as CuestionarioListado[], () =>
    prisma.fotofficeCuestionario.findMany({
      where: { workspaceId, ...(opciones.soloActivos ? { activo: true } : {}) },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, clave: true, nombre: true, activo: true },
    }),
  );
}

type ClienteParaEnvio = { nombre: string; telefono: string | null; correo: string | null };

async function clienteDelWorkspace(workspaceId: string, clientId: string): Promise<ClienteParaEnvio | null> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { kind: true, firstName: true, lastName: true, businessName: true, phone: true, email: true },
  });
  if (!c) return null;
  return { nombre: clientDisplayName(c), telefono: c.phone, correo: c.email };
}

export type ResultadoCrearEnvio =
  | ({ ok: true; envioId: string; cuestionarioNombre: string; reusado: boolean } & EnlacesDeEnvio)
  | { ok: false; error: string };

/**
 * Le prepara a un cliente el enlace de un cuestionario. Si ya tiene uno PENDIENTE del mismo
 * cuestionario se reusa (así reenviar no deja enlaces sueltos); si ya lo respondió, se crea uno
 * nuevo (p. ej. para otro evento).
 */
export async function crearEnvio(input: {
  workspaceId: string;
  clientId: string;
  cuestionarioId: string;
  userId: string | null;
}): Promise<ResultadoCrearEnvio> {
  try {
    const [cliente, cuestionario] = await Promise.all([
      clienteDelWorkspace(input.workspaceId, input.clientId),
      prisma.fotofficeCuestionario.findFirst({
        where: { id: input.cuestionarioId, workspaceId: input.workspaceId, activo: true },
        select: { id: true, nombre: true },
      }),
    ]);
    if (!cliente) return { ok: false, error: "No encontramos ese cliente." };
    if (!cuestionario) return { ok: false, error: "Ese cuestionario no existe o está desactivado." };

    const existente = await prisma.fotofficeCuestionarioEnvio.findFirst({
      where: { workspaceId: input.workspaceId, clientId: input.clientId, cuestionarioId: cuestionario.id, estado: "PENDIENTE" },
      orderBy: { createdAt: "desc" },
      select: { id: true, token: true },
    });
    const envio =
      existente ??
      (await prisma.fotofficeCuestionarioEnvio.create({
        data: {
          workspaceId: input.workspaceId,
          clientId: input.clientId,
          cuestionarioId: cuestionario.id,
          token: nuevoToken(),
          estado: "PENDIENTE",
          enviadoPorUserId: input.userId,
        },
        select: { id: true, token: true },
      }));

    const [origen, estudio] = await Promise.all([origenPublico(), nombreDelEstudio(input.workspaceId)]);
    return {
      ok: true,
      envioId: envio.id,
      cuestionarioNombre: cuestionario.nombre,
      reusado: Boolean(existente),
      ...enlacesDeEnvio({
        enlace: rutaPublica(origen, envio.token),
        nombreCliente: cliente.nombre,
        nombreCuestionario: cuestionario.nombre,
        nombreEstudio: estudio.nombre,
        telefono: cliente.telefono,
        correo: cliente.correo,
      }),
    };
  } catch (error) {
    if (esTablaFaltante(error)) return { ok: false, error: "Los cuestionarios todavía no están habilitados en esta base." };
    avisar("crear envío", error);
    return { ok: false, error: "No se pudo preparar el cuestionario. Probá de nuevo." };
  }
}

// ── La página pública ─────────────────────────────────────────────────────────

export type EnvioPublico = {
  estado: "PENDIENTE" | "RESPONDIDO";
  respondidoEn: Date | null;
  cuestionario: { nombre: string; intro: string | null; definicion: DefinicionCuestionario };
  respuestas: RespuestaGuardada[];
  estudio: { nombre: string; logoUrl: string | null };
  nombreCliente: string;
};

async function filaPorToken(token: string) {
  if (!esTokenValido(token)) return null;
  const envio = await prisma.fotofficeCuestionarioEnvio.findUnique({
    where: { token },
    select: { id: true, workspaceId: true, cuestionarioId: true, clientId: true, estado: true, respuestas: true, respondidoEn: true },
  });
  if (!envio) return null;
  const cuestionario = await prisma.fotofficeCuestionario.findFirst({
    where: { id: envio.cuestionarioId, workspaceId: envio.workspaceId },
    select: { nombre: true, intro: true, definicion: true },
  });
  if (!cuestionario) return null;
  return { envio, cuestionario: { nombre: cuestionario.nombre, intro: cuestionario.intro, definicion: leerDefinicion(cuestionario.definicion) } };
}

/** Lo que ve el cliente desde el enlace. `null` = enlace inexistente (o tablas sin crear). */
export async function envioPorToken(token: string): Promise<EnvioPublico | null> {
  return tolerante("leer por token", null, async () => {
    const fila = await filaPorToken(token);
    if (!fila) return null;
    const [estudio, cliente] = await Promise.all([
      nombreDelEstudio(fila.envio.workspaceId),
      prisma.client.findFirst({
        where: { id: fila.envio.clientId, workspaceId: fila.envio.workspaceId },
        select: { kind: true, firstName: true, lastName: true, businessName: true },
      }),
    ]);
    return {
      estado: fila.envio.estado === "RESPONDIDO" ? "RESPONDIDO" : "PENDIENTE",
      respondidoEn: fila.envio.respondidoEn,
      cuestionario: fila.cuestionario,
      respuestas: leerRespuestasGuardadas(fila.envio.respuestas),
      estudio,
      nombreCliente: cliente ? clientDisplayName(cliente) : "",
    };
  });
}

export type ResultadoResponder = { ok: true } | { ok: false; error: string; errores?: ErrorDeRespuesta[] };

/**
 * Guarda lo que mandó el cliente. Se puede volver a mandar para corregir: la última versión
 * reemplaza a la anterior y la fecha de respuesta se actualiza.
 */
export async function responderPorToken(token: string, crudo: unknown): Promise<ResultadoResponder> {
  let tamanio: number;
  try {
    tamanio = JSON.stringify(crudo ?? null).length;
  } catch {
    return { ok: false, error: "No pudimos leer las respuestas." };
  }
  if (tamanio > TOPE_ENVIO) return { ok: false, error: "Hay demasiado texto para enviar de una vez." };

  try {
    const fila = await filaPorToken(token);
    if (!fila) return { ok: false, error: "Este enlace ya no está disponible." };
    const r = normalizarRespuestas(fila.cuestionario.definicion, crudo);
    if (!r.ok) return { ok: false, error: r.mensaje, errores: r.errores };
    await prisma.fotofficeCuestionarioEnvio.update({
      where: { id: fila.envio.id },
      data: { estado: "RESPONDIDO", respondidoEn: new Date(), respuestas: r.respuestas as unknown as object[] },
    });
    return { ok: true };
  } catch (error) {
    if (esTablaFaltante(error)) return { ok: false, error: "Este enlace ya no está disponible." };
    avisar("responder", error);
    return { ok: false, error: "No se pudieron guardar las respuestas. Revisá la conexión y probá de nuevo." };
  }
}

// ── La ficha del cliente ──────────────────────────────────────────────────────

export type CuestionarioRespondido = {
  envioId: string;
  cuestionarioNombre: string;
  respondidoEn: string | null;
  grupos: GrupoDeRespuestas[];
  enlace: string;
};

export type CuestionarioPendiente = {
  envioId: string;
  cuestionarioNombre: string;
  creadoEn: string;
} & EnlacesDeEnvio;

export type DatosDeCuestionariosDelCliente = {
  /** false = las tablas todavía no existen en esta base. */
  disponible: boolean;
  /** Los activos, para elegir cuál mandar. */
  cuestionarios: { id: string; nombre: string }[];
  respondidos: CuestionarioRespondido[];
  pendientes: CuestionarioPendiente[];
  cliente: { nombre: string; telefono: string | null; correo: string | null };
};

/**
 * Todo lo que necesitan `<EnviarCuestionario>` e `<InformacionAdicional>` para un cliente.
 * NO controla permisos: la llama la página de la ficha, que ya pasó por `requireClientsViewer`.
 * Las fechas van como texto ISO para poder pasarlas a un componente de cliente.
 */
export async function datosDeCuestionariosDelCliente(workspaceId: string, clientId: string): Promise<DatosDeCuestionariosDelCliente> {
  const cliente = (await clienteDelWorkspace(workspaceId, clientId)) ?? { nombre: "", telefono: null, correo: null };
  const vacio: DatosDeCuestionariosDelCliente = { disponible: false, cuestionarios: [], respondidos: [], pendientes: [], cliente };
  try {
    await asegurarCuestionariosDeFabrica(workspaceId);
    const [todos, envios, origen, estudio] = await Promise.all([
      prisma.fotofficeCuestionario.findMany({
        where: { workspaceId },
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
        select: { id: true, nombre: true, activo: true, definicion: true },
      }),
      prisma.fotofficeCuestionarioEnvio.findMany({
        where: { workspaceId, clientId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, cuestionarioId: true, token: true, estado: true, respuestas: true, respondidoEn: true, createdAt: true },
      }),
      origenPublico(),
      nombreDelEstudio(workspaceId),
    ]);
    const porId = new Map(todos.map((c) => [c.id, c]));
    const respondidos: CuestionarioRespondido[] = [];
    const pendientes: CuestionarioPendiente[] = [];
    for (const e of envios) {
      const c = porId.get(e.cuestionarioId);
      const nombre = c?.nombre ?? "Cuestionario";
      const enlace = rutaPublica(origen, e.token);
      if (e.estado === "RESPONDIDO") {
        const respuestas = leerRespuestasGuardadas(e.respuestas);
        respondidos.push({
          envioId: e.id,
          cuestionarioNombre: nombre,
          respondidoEn: e.respondidoEn?.toISOString() ?? null,
          grupos: agruparPorSeccion(respuestas, c ? leerDefinicion(c.definicion) : undefined),
          enlace,
        });
      } else {
        pendientes.push({
          envioId: e.id,
          cuestionarioNombre: nombre,
          creadoEn: e.createdAt.toISOString(),
          ...enlacesDeEnvio({
            enlace,
            nombreCliente: cliente.nombre,
            nombreCuestionario: nombre,
            nombreEstudio: estudio.nombre,
            telefono: cliente.telefono,
            correo: cliente.correo,
          }),
        });
      }
    }
    return {
      disponible: true,
      cuestionarios: todos.filter((c) => c.activo).map((c) => ({ id: c.id, nombre: c.nombre })),
      respondidos,
      pendientes,
      cliente,
    };
  } catch (error) {
    if (esTablaFaltante(error)) return vacio;
    avisar("datos del cliente", error);
    return vacio;
  }
}
