import "server-only";
import { prisma } from "@repo/db";
import type { ResultadoAutomatico } from "@/lib/plantillas/automaticos";
import { contextoDe, correoValido, destinoDe, type ContextoMensaje, type UsuarioQueEnvia } from "@/lib/plantillas/contexto";
import { leerAutomatico } from "@/lib/plantillas/definiciones";
import {
  candadoDeDireccion, completarTextos, enviarCorreo, liberarReserva, MENSAJES_ENVIO, reservarEnvioAutomatico, type CtxEnvio, type DepsEnvio,
} from "@/lib/plantillas/envio";
import { pesos } from "@/lib/presupuestos/editor";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { ETIQUETA_MEDIO_COBRO, esMedioCobro, LEYENDA_RECIBO } from "./constantes";
import { enlaceDelPedidoDelSistema, enlacesDeRecibos, type DepsEnlace } from "./enlace";
import { importeEnLetras } from "./numero-a-letras";
import { nombreDeContacto } from "./pedidos";
import { pesosConCentavos } from "./pantalla";
import { fechaDeBase, pesosDeBase } from "./plan";
import { aCentavos, desdeCentavos } from "./plan-cuotas";
import { asegurarPlantillaRecibo } from "./plantillas";

/**
 * Recibo X interno de un cobro (etapa 3, spec §2 A.5): sus datos, el contexto de las plantillas de
 * tipo PEDIDO (`[pedido_*]` y `[recibo_*]`) y el envío automático "Recibo de pago".
 *
 * Nunca loguea datos personales: sólo códigos.
 */

/** Pesos con centavos, como va en el recibo ("$ 120.000,50"). Vive en `pantalla.ts` (puro). */
export { pesosConCentavos };

// --- Datos del recibo -------------------------------------------------------------------------

export type CuotaDelRecibo = { position: number; dueDate: string; amountArs: number };

/**
 * Lo que dice el recibo. Sirve para la ficha y para la página pública: no lleva el motivo de la
 * anulación, ni costos, ni notas internas, ni datos de otros pedidos.
 */
export type ReciboLeido = {
  cobroId: string;
  pedidoId: string;
  numero: string;
  /** Día del pago en Argentina, "aaaa-mm-dd". */
  fecha: string;
  cliente: string;
  pedidoNumero: string;
  eventLabel: string | null;
  /** "aaaa-mm-dd". */
  eventDate: string | null;
  /** "Pedido N° 2026-0001 · Boda · Laura Pérez". */
  concepto: string;
  importe: number;
  importeEnLetras: string;
  medio: string;
  medioEtiqueta: string;
  cuotas: CuotaDelRecibo[];
  anulado: boolean;
  leyenda: typeof LEYENDA_RECIBO;
};

/** El recibo de un cobro del workspace, o null. Sin permisos: quien llama ya validó el acceso. */
export async function leerRecibo(workspaceId: string, cobroId: string): Promise<ReciboLeido | null> {
  const c = await prisma.fotofficeCobro.findFirst({
    where: { id: cobroId, workspaceId },
    select: { id: true, pedidoId: true, clientId: true, paidAt: true, method: true, amountArs: true, receiptNumber: true, voidedAt: true },
  });
  if (!c) return null;
  const [p, cliente, imputaciones] = await Promise.all([
    prisma.fotofficePedido.findFirst({ where: { id: c.pedidoId, workspaceId }, select: { number: true, eventLabel: true, eventDate: true } }),
    prisma.client.findFirst({ where: { id: c.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
    prisma.fotofficeCobroImputacion.findMany({ where: { workspaceId, cobroId: c.id }, select: { cuotaId: true, amountArs: true } }),
  ]);
  if (!p) return null;
  const cuotas = imputaciones.length
    ? await prisma.fotofficePedidoCuota.findMany({
        where: { workspaceId, pedidoId: c.pedidoId, id: { in: imputaciones.map((i) => i.cuotaId) } },
        select: { id: true, position: true, dueDate: true },
      })
    : [];
  const porId = new Map(cuotas.map((q) => [q.id, q]));
  const importe = pesosDeBase(c.amountArs);
  const nombre = nombreDeContacto(cliente);
  return {
    cobroId: c.id,
    pedidoId: c.pedidoId,
    numero: c.receiptNumber,
    fecha: diaEnBuenosAires(c.paidAt),
    cliente: nombre,
    pedidoNumero: p.number,
    eventLabel: p.eventLabel,
    eventDate: p.eventDate ? fechaDeBase(p.eventDate) : null,
    concepto: [`Pedido N° ${p.number}`, p.eventLabel].filter(Boolean).join(" · "),
    importe,
    importeEnLetras: importeEnLetras(importe),
    medio: c.method,
    medioEtiqueta: esMedioCobro(c.method) ? ETIQUETA_MEDIO_COBRO[c.method] : c.method,
    cuotas: imputaciones
      .map((i) => {
        const q = porId.get(i.cuotaId);
        return q ? { position: q.position, dueDate: fechaDeBase(q.dueDate), amountArs: pesosDeBase(i.amountArs) } : null;
      })
      .filter((x): x is CuotaDelRecibo => x !== null)
      .sort((a, b) => a.position - b.position),
    anulado: c.voidedAt !== null,
    leyenda: LEYENDA_RECIBO,
  };
}

// --- Contexto de las plantillas PEDIDO --------------------------------------------------------

/** ¿Alguno de los textos usa esa variable (`[clave]` o `[si:clave]`)? */
function usa(clave: string, textos: readonly (string | null | undefined)[]): boolean {
  return textos.some((t) => typeof t === "string" && t.includes(clave));
}

export type ContextoPedido =
  | { ok: true; contexto: ContextoMensaje; clientId: string; pedidoId: string; enlaceRecibo: string | null }
  | { ok: false; codigo: "NO_ENCONTRADO" | "SIN_ENLACE" };

/**
 * Contexto de un mensaje de tipo PEDIDO: el del contacto del pedido (persona, organización, firma)
 * más `[pedido_numero]`, `[pedido_saldo]`, `[pedido_enlace]` y, con `cobroId`, `[recibo_numero]`,
 * `[recibo_enlace]` y `[recibo_importe]`. El enlace del pedido se crea sólo si algún texto lo usa
 * (crearlo guarda su hash). Sin permisos: quien llama ya validó quién envía.
 */
export async function contextoDeMensajePedido(
  workspaceId: string,
  pedidoId: string,
  opciones: { cobroId?: string | null; usuario: UsuarioQueEnvia; ahora: Date; textos: readonly (string | null | undefined)[] },
  deps: DepsEnlace = {},
): Promise<ContextoPedido> {
  const p = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, number: true, clientId: true, totalArs: true } });
  if (!p) return { ok: false, codigo: "NO_ENCONTRADO" };
  const base = await contextoDe(workspaceId, "CLIENTE", p.clientId, opciones.usuario, opciones.ahora);
  if (!base) return { ok: false, codigo: "NO_ENCONTRADO" };

  const vigentes = await prisma.fotofficeCobro.findMany({ where: { workspaceId, pedidoId: p.id, voidedAt: null }, select: { amountArs: true } });
  const cobrado = vigentes.reduce((s, c) => s + aCentavos(pesosDeBase(c.amountArs)), 0);
  const saldo = desdeCentavos(Math.max(0, aCentavos(pesosDeBase(p.totalArs)) - cobrado));

  let enlacePedido: string | null = null;
  if (usa("pedido_enlace", opciones.textos)) {
    const e = await enlaceDelPedidoDelSistema(workspaceId, p.id, {}, deps);
    if (!e.ok) return { ok: false, codigo: "SIN_ENLACE" };
    enlacePedido = e.url;
  }

  let recibo: NonNullable<ContextoMensaje["variables"]["recibo"]> | undefined;
  let enlaceRecibo: string | null = null;
  if (opciones.cobroId) {
    const c = await prisma.fotofficeCobro.findFirst({
      where: { id: opciones.cobroId, workspaceId, pedidoId: p.id },
      select: { id: true, receiptNumber: true, amountArs: true },
    });
    if (!c) return { ok: false, codigo: "NO_ENCONTRADO" };
    const enlaces = await enlacesDeRecibos(workspaceId, [c.id], deps);
    if (!enlaces.ok || !enlaces.urls.get(c.id)) return { ok: false, codigo: "SIN_ENLACE" };
    enlaceRecibo = enlaces.urls.get(c.id)!;
    recibo = { numero: c.receiptNumber, enlace: enlaceRecibo, importe: pesosConCentavos(pesosDeBase(c.amountArs)) };
  }

  const contexto: ContextoMensaje = {
    ...base,
    variables: {
      ...base.variables,
      // Saldo 0 → null: así el bloque `[si:pedido_saldo]` desaparece en vez de decir "$ 0".
      pedido: { numero: p.number, enlace: enlacePedido, saldo: aCentavos(saldo) > 0 ? pesos(saldo) : null },
      ...(recibo ? { recibo } : {}),
    },
  };
  return { ok: true, contexto, clientId: p.clientId, pedidoId: p.id, enlaceRecibo };
}

/** El enlace al final del texto (antes de `[firma]`, si está) cuando la plantilla no lo trae. */
export function conEnlaceDelRecibo(cuerpo: string, enlace: string): string {
  if (cuerpo.includes(enlace)) return cuerpo;
  const linea = `Podés ver el recibo acá: ${enlace}`;
  const i = cuerpo.lastIndexOf("[firma]");
  if (i === -1) return `${cuerpo.trimEnd()}\n\n${linea}`;
  return `${cuerpo.slice(0, i).trimEnd()}\n\n${linea}\n\n${cuerpo.slice(i)}`;
}

// --- Recibo de pago automático ----------------------------------------------------------------

export type DepsRecibo = DepsEnvio & DepsEnlace;

/** El sistema envía: sin usuario. `enviarCorreo` registra "Automático" como autor. */
function ctxDelSistema(workspaceId: string): CtxEnvio {
  return { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
}

/**
 * Manda el recibo de un cobro recién registrado al contacto del pedido con la plantilla automática
 * `RECIBO_DE_PAGO`, si está encendida (nace encendida). Lo llama la acción de registrar cobro con
 * `after()`: nunca frena ni deshace el cobro, nunca lanza.
 *
 * Reglas de los automáticos (`lib/plantillas/automaticos.ts`):
 * - el tope diario de correos automáticos de la organización (lo mira `enviarCorreo`);
 * - el candado por dirección y la reserva del registro antes de mandar, así dos automáticos a la
 *   misma persona a la vez no se pisan;
 * - una vez por recibo: sale sólo cuando el cobro se crea (un doble clic devuelve el mismo cobro y
 *   no vuelve a mandar), y no sale si el cobro ya está anulado.
 *
 * A diferencia de la respuesta a una consulta, el recibo NO se frena por la regla de "una respuesta
 * por dirección cada 24 h": es la constancia de un pago, y dos cobros el mismo día (o una consulta
 * respondida ayer) no pueden dejar a la persona sin su recibo. Igual cuenta para esa regla de los
 * demás automáticos (queda registrado como automático a esa dirección).
 *
 * Queda registrado en el pedido (`entityType` PEDIDO + su id).
 */
export async function enviarReciboAutomatico(workspaceId: string, cobroId: string, deps: DepsRecibo = {}): Promise<ResultadoAutomatico> {
  try {
    await asegurarPlantillaRecibo(workspaceId);
    const auto = await leerAutomatico(workspaceId, "RECIBO_DE_PAGO");
    if (!auto || !auto.enabled || auto.channel !== "EMAIL" || auto.entityType !== "PEDIDO") return "APAGADA";

    const c = await prisma.fotofficeCobro.findFirst({ where: { id: cobroId, workspaceId }, select: { id: true, pedidoId: true, clientId: true, voidedAt: true } });
    if (!c || c.voidedAt) return "NO_ENCONTRADA";
    // Primero lo barato: sin correo no hace falta armar enlaces ni cargar la firma.
    const destino = await destinoDe(workspaceId, "CLIENTE", c.clientId);
    if (!destino) return "NO_ENCONTRADA";
    if (!correoValido(destino.email)) return "SIN_CORREO";
    const email = destino.email;

    const ahora = (deps.ahora ?? (() => new Date()))();
    const ctxPedido = await contextoDeMensajePedido(
      workspaceId, c.pedidoId,
      { cobroId: c.id, usuario: { nombre: null, email: null }, ahora, textos: [auto.subject, auto.body] },
      deps,
    );
    if (!ctxPedido.ok) {
      console.warn("[pedidos] el recibo automático no se pudo armar", { codigo: ctxPedido.codigo });
      return ctxPedido.codigo === "NO_ENCONTRADO" ? "NO_ENCONTRADA" : "NO_ENVIADO";
    }
    const textos = completarTextos(ctxPedido.contexto, "PEDIDO", auto.subject, auto.body);
    if (!textos.ok) {
      console.warn("[pedidos] el recibo automático tiene variables inválidas", { codigo: "PLANTILLA_CON_ERRORES" });
      return "PLANTILLA_CON_ERRORES";
    }
    const cuerpo = ctxPedido.enlaceRecibo ? conEnlaceDelRecibo(textos.cuerpo, ctxPedido.enlaceRecibo) : textos.cuerpo;

    const reserva = await prisma.$transaction(async (tx) => {
      await candadoDeDireccion(tx, workspaceId, email);
      return reservarEnvioAutomatico(tx, { workspaceId, entityType: "PEDIDO", entityId: c.pedidoId, templateId: auto.id, toAddress: email });
    });

    let r: Awaited<ReturnType<typeof enviarCorreo>>;
    try {
      r = await enviarCorreo(
        ctxDelSistema(workspaceId),
        {
          entityType: "CLIENTE", entityId: c.clientId, templateId: auto.id, asunto: textos.asunto, cuerpo, automatico: true,
          registroId: reserva, registrarEn: { entityType: "PEDIDO", entityId: c.pedidoId },
        },
        deps,
        { tipoPlantilla: "PEDIDO" },
      );
    } catch (e) {
      await liberarReserva(workspaceId, reserva).catch(() => undefined);
      throw e;
    }
    if (r.ok) return "ENVIADO";
    if (!r.registrado) await liberarReserva(workspaceId, reserva);
    console.warn("[pedidos] el recibo automático no salió", { codigo: r.registrado ? "REGISTRADO_FALLIDO" : "NO_ENVIADO" });
    return r.error === MENSAJES_ENVIO.topeAutomaticos ? "TOPE" : "NO_ENVIADO";
  } catch (e) {
    console.error("[pedidos] falló el recibo automático", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return "ERROR";
  }
}
