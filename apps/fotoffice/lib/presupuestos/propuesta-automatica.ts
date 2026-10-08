import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { moduloDeRegistroEncendido } from "@/lib/campos/modulos";
import { leerAjustes as leerAjustesConsultas, type DepsAjustes } from "@/lib/consultas/ajustes";
import { destinatarioDelAviso } from "@/lib/consultas/aviso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { yaRespondida } from "@/lib/plantillas/automaticos";
import { TOPE_AUTOMATICOS_DIA } from "@/lib/plantillas/constantes";
import { correoValido, destinoDe } from "@/lib/plantillas/contexto";
import { AUTOMATICOS, leerAutomatico } from "@/lib/plantillas/definiciones";
import {
  candadoDeDireccion,
  CODIGO_ENVIO_EN_CURSO,
  correosEnviadosHoy,
  liberarReserva,
  MENSAJES_ENVIO,
  reservarEnvioAutomatico,
  sinAvisosAlEquipo,
} from "@/lib/plantillas/envio";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { numeroDe } from "@/lib/numeracion/asignar";
import { crearTareaDeConsulta, destinatarioDelPresupuesto } from "./avisos";
import { QUOTES_MODULE_KEY } from "./acceso";
import { leerAjustes } from "./ajustes";
import { ENTIDAD_NUMERACION } from "./constantes";
import { itemsDeLaPropuesta } from "./items-de-la-propuesta";
import { enviarPresupuestoDelSistema, type DepsEnvioPresupuesto } from "./envio";
import { vencimientoDesde } from "./estados";
import { leerPropuestaModelo, plantillaDePropuesta } from "./propuestas-modelo";
import { normalizarBorrador } from "./versiones";

/**
 * La consulta web recibe su propuesta modelo sola (etapa 2, Entrega B, spec §2 B.13): el "tercer
 * modo" de la respuesta automática.
 *
 * La llama SÓLO el alta única (`lib/consultas/alta.ts`), en el paso 4 de una consulta del
 * formulario web, después del número, el circuito y el aviso al equipo. Si la categoría de la
 * consulta tiene una propuesta modelo con "Enviar sola al llegar una consulta web":
 *   1. crea el presupuesto como el sistema (sin usuario), con los ítems de la propuesta al precio
 *      de lista de HOY (nombre, descripción y precio salen del catálogo en este momento) y las
 *      condiciones de la propuesta (o las generales);
 *   2. el responsable es el de los ajustes de Consultas o, si no sirve, el dueño;
 *   3. lo envía por correo con su plantilla (`enviarPresupuestoDelSistema`): correo automático,
 *      con el tope diario de los automáticos y registrado con `automatic=true`.
 *
 * **Nunca salen dos respuestas** **[decisión: la propuesta modelo reemplaza a la autorespuesta
 * común para esa consulta]**. Esta función sólo intenta la propuesta y dice qué pasó; con
 * `correspondeAutorespuestaComun` el alta decide si manda la común. Además, las dos comparten la
 * regla de una respuesta por dirección cada 24 h (`yaRespondida`), que cuenta también los envíos
 * fallidos: si la propuesta llegó a intentarse, la común no sale.
 *
 * Sólo sale con la respuesta automática común ENCENDIDA (es uno de sus modos, Global
 * Constraints): apagada, no sale nada.
 *
 * Nunca lanza ni frena el alta, y el registro sólo guarda códigos (nunca datos de la persona).
 */

export type ResultadoPropuestaAutomatica =
  /** Salió la propuesta: no va la común. */
  | "ENVIADA"
  /** La respuesta automática está apagada (o Captación): no sale nada. */
  | "APAGADA"
  /** Ya se le respondió a esa dirección en las últimas 24 h: no sale nada. */
  | "YA_RESPONDIDO"
  /** Sin ficha, sin propuesta activa para la categoría o con Presupuestos apagado: va la común. */
  | "NO_APLICA"
  /** Sin correo válido: la común lo vuelve a mirar (y tampoco sale). */
  | "SIN_CORREO"
  /** Se llegó al tope de los automáticos: la común lo vuelve a mirar. */
  | "TOPE"
  /** No se pudo armar o enviar: va la común (si se llegó a intentar el correo, la frena la regla de 24 h). */
  | "FALLO"
  /** Algo falló antes de que el presupuesto saliera: va la común. */
  | "ERROR"
  /** Algo falló DESPUÉS de congelar el presupuesto: el correo pudo haber salido, la común no va. */
  | "ERROR_TRAS_ENVIO";

/** ¿Va la respuesta automática común? Sólo si la propuesta no salió y no hay motivo para no responder. */
export function correspondeAutorespuestaComun(r: ResultadoPropuestaAutomatica): boolean {
  return r !== "ENVIADA" && r !== "APAGADA" && r !== "YA_RESPONDIDO" && r !== "ERROR_TRAS_ENVIO";
}

export type DepsPropuestaAutomatica = DepsEnvioPresupuesto & DepsAjustes;

function aviso(codigo: string): void {
  console.warn("[presupuestos] la propuesta modelo no salió sola", { codigo });
}

export async function enviarPropuestaModelo(
  workspaceId: string,
  leadId: string,
  deps: DepsPropuestaAutomatica = {},
): Promise<ResultadoPropuestaAutomatica> {
  let creado: { presupuestoId: string; reserva: string; owner: number | null } | null = null;
  try {
    const ahora = (deps.ahora ?? (() => new Date()))();

    // Es un modo de la respuesta automática: sin ella encendida (y Captación), no sale nada.
    const auto = await leerAutomatico(workspaceId, "CONSULTA_AUTORESPUESTA");
    if (!auto || !auto.enabled || auto.channel !== AUTOMATICOS.CONSULTA_AUTORESPUESTA.canal) return "APAGADA";
    if (!(await moduloDeRegistroEncendido(workspaceId, AUTOMATICOS.CONSULTA_AUTORESPUESTA.tipo))) return "APAGADA";

    // La categoría sale de la ficha; sin ficha (el respaldo del formulario) no hay propuesta.
    const ficha = await prisma.fotofficeConsulta.findFirst({ where: { workspaceId, leadId }, select: { categoryId: true, clientId: true } });
    if (!ficha) return "NO_APLICA";
    const propuesta = await leerPropuestaModelo(workspaceId, ficha.categoryId);
    if (!propuesta || !propuesta.enviarSola || propuesta.items.length === 0 || !propuesta.plantillaId) return "NO_APLICA";
    if (!(await isModuleEnabledForWorkspace(workspaceId, QUOTES_MODULE_KEY))) return "NO_APLICA";

    // Lo que puede frenar el envío, ANTES de crear nada.
    const destino = await destinoDe(workspaceId, "CONSULTA", leadId);
    if (!destino) return "NO_APLICA";
    if (!correoValido(destino.email)) return "SIN_CORREO";
    if (await yaRespondida(workspaceId, destino.email, ahora)) return "YA_RESPONDIDO";
    if ((await correosEnviadosHoy(workspaceId, ahora, true)) >= TOPE_AUTOMATICOS_DIA) {
      aviso("TOPE_AUTOMATICOS");
      return "TOPE";
    }
    const plantilla = await plantillaDePropuesta(workspaceId, propuesta.plantillaId);
    if (!plantilla) {
      aviso("PLANTILLA_NO_ENCONTRADA");
      return "FALLO";
    }
    const instanciada = await itemsDeLaPropuesta(workspaceId, propuesta.items, ahora);
    if (!instanciada.ok) {
      // PRODUCTO_INACTIVO se registra con el código histórico PRODUCTO_FUERA_DEL_CATALOGO.
      aviso(instanciada.motivo === "PRODUCTO_INACTIVO" ? "PRODUCTO_FUERA_DEL_CATALOGO" : instanciada.motivo);
      return "FALLO";
    }
    const items = instanciada.items;
    const ajustes = await leerAjustes(workspaceId);
    const borrador = await normalizarBorrador(
      workspaceId,
      { items, condiciones: propuesta.condiciones ?? ajustes.condiciones, propuestaPago: ajustes.propuestaPago },
      new Map(),
      ahora,
    );
    if (!borrador.ok) {
      aviso("ITEMS_INVALIDOS");
      return "FALLO";
    }
    const consultas = await leerAjustesConsultas(workspaceId);
    const owner = await destinatarioDelAviso(workspaceId, [consultas.responsableUserId], deps);
    const email = destino.email;
    const filtro = await sinAvisosAlEquipo(workspaceId);

    // Dos envíos simultáneos del formulario con la misma dirección: el candado por organización y
    // dirección los pone en fila. Adentro se vuelve a mirar la regla de 24 h, se crea el
    // presupuesto (como `crearPresupuesto`, pero del sistema: sin usuario) y se reserva el registro
    // del correo; el segundo ve la reserva del primero y no crea nada.
    const hecho = await prisma.$transaction(async (tx) => {
      await candadoDeDireccion(tx, workspaceId, email);
      if (await yaRespondida(workspaceId, email, ahora, { cliente: tx, filtro })) return null;
      const p = await tx.fotofficePresupuesto.create({
        data: {
          workspaceId,
          consultaLeadId: leadId,
          clientId: ficha.clientId,
          status: "BORRADOR",
          ownerUserId: owner,
          validUntil: vencimientoDesde(ahora, ajustes.validezDias),
        },
        select: { id: true },
      });
      const v = await tx.fotofficePresupuestoVersion.create({
        data: {
          workspaceId,
          presupuestoId: p.id,
          number: 1,
          items: borrador.valor.items as unknown as Prisma.InputJsonValue,
          totals: borrador.valor.totals as unknown as Prisma.InputJsonValue,
          terms: borrador.valor.terms,
          paymentProposal: borrador.valor.paymentProposal,
          costSnapshot: borrador.valor.costSnapshot as unknown as Prisma.InputJsonValue,
          createdByUserId: null,
        },
        select: { id: true },
      });
      await tx.fotofficePresupuesto.update({ where: { id: p.id }, data: { currentVersionId: v.id }, select: { id: true } });
      const reserva = await reservarEnvioAutomatico(tx, { workspaceId, entityType: "CONSULTA", entityId: leadId, templateId: plantilla.id, toAddress: email });
      return { presupuestoId: p.id, reserva };
    }, OPCIONES_TRANSACCION);
    if (!hecho) return "YA_RESPONDIDO";
    creado = { ...hecho, owner };

    const r = await enviarPresupuestoDelSistema(workspaceId, hecho.presupuestoId, plantilla.id, deps, { registroId: hecho.reserva });
    if (r.ok && !r.repetido) return "ENVIADA";
    if (!r.ok && r.enviado) {
      // Quedó enviado (congelado) pero el correo no le llegó: tarea para el responsable, que lo
      // puede reenviar desde la ficha.
      const intentado = await correoIntentado(workspaceId, hecho.reserva);
      if (!intentado) await liberarReserva(workspaceId, hecho.reserva);
      await tareaDeRevision(workspaceId, leadId, hecho.presupuestoId, owner, ahora);
      aviso(intentado ? "CORREO_RECHAZADO" : "CORREO_NO_SALIO");
      // Si el correo no se llegó a intentar, va la común (la persona no recibió nada); si el
      // proveedor lo rechazó, quedó registrado y la regla de 24 h frena la común.
      return "FALLO";
    }
    // No se congeló: el borrador que creó el sistema no le sirve a nadie, se borra con su reserva.
    await borrarBorradorDelSistema(workspaceId, hecho.presupuestoId);
    await liberarReserva(workspaceId, hecho.reserva);
    if (!r.ok && r.error === MENSAJES_ENVIO.topeAutomaticos) {
      aviso("TOPE_AUTOMATICOS");
      return "TOPE";
    }
    aviso("NO_ENVIADO");
    return "FALLO";
  } catch (e) {
    console.error("[presupuestos] falló la propuesta modelo automática", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    if (!creado) return "ERROR";
    // Si el presupuesto ya salió (no es borrador), el correo pudo haber llegado: no va la común.
    if (await yaNoEsBorrador(workspaceId, creado.presupuestoId)) {
      // La reserva queda (frena otra respuesta a esa dirección) y el responsable revisa el envío.
      await tareaDeRevision(workspaceId, leadId, creado.presupuestoId, creado.owner, (deps.ahora ?? (() => new Date()))());
      return "ERROR_TRAS_ENVIO";
    }
    await borrarBorradorDelSistema(workspaceId, creado.presupuestoId);
    await liberarReserva(workspaceId, creado.reserva);
    return "ERROR";
  }
}

/** ¿El correo llegó a intentarse? (la reserva ya no está EN_CURSO). Ante la duda, sí. */
async function correoIntentado(workspaceId: string, reserva: string): Promise<boolean> {
  try {
    const f = await prisma.fotofficeMessage.findFirst({ where: { id: reserva, workspaceId }, select: { errorCode: true } });
    return f !== null && f.errorCode !== CODIGO_ENVIO_EN_CURSO;
  } catch {
    return true;
  }
}

/** ¿El presupuesto ya no es borrador (se congeló)? Ante la duda, sí: así nunca salen dos respuestas. */
async function yaNoEsBorrador(workspaceId: string, presupuestoId: string): Promise<boolean> {
  try {
    const p = await prisma.fotofficePresupuesto.findFirst({ where: { id: presupuestoId, workspaceId }, select: { status: true } });
    return p !== null && p.status !== "BORRADOR";
  } catch {
    return true;
  }
}

/** Tarea "Revisar envío del presupuesto N° …" para el responsable (o el dueño). Nunca lanza. */
async function tareaDeRevision(workspaceId: string, leadId: string, presupuestoId: string, owner: number | null, ahora: Date): Promise<void> {
  try {
    const numero = (await numeroDe(workspaceId, ENTIDAD_NUMERACION, [presupuestoId])).get(presupuestoId) ?? null;
    const para = await destinatarioDelPresupuesto(workspaceId, owner);
    await crearTareaDeConsulta(workspaceId, leadId, tituloDeRevision(numero), para, ahora, { unaSolaAbierta: true });
  } catch (e) {
    console.error("[presupuestos] no se pudo crear la tarea de revisión", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
  }
}

/** PURO. Título de la tarea cuando la propuesta quedó enviada pero el correo no llegó. */
export function tituloDeRevision(numero: string | null): string {
  return `Revisar envío del presupuesto ${numero ? `N° ${numero}` : "sin número"}`;
}

/** Borra el presupuesto que creó el sistema SÓLO si sigue en borrador (nunca uno enviado). Nunca lanza. */
async function borrarBorradorDelSistema(workspaceId: string, presupuestoId: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.fotofficePresupuesto.updateMany({
        where: { id: presupuestoId, workspaceId, status: "BORRADOR" },
        data: { currentVersionId: null },
      });
      if (r.count !== 1) return;
      await tx.fotofficePresupuestoVersion.deleteMany({ where: { workspaceId, presupuestoId, sentAt: null } });
      await tx.fotofficePresupuesto.deleteMany({ where: { id: presupuestoId, workspaceId, status: "BORRADOR" } });
    });
  } catch (e) {
    console.error("[presupuestos] no se pudo borrar el borrador de la propuesta automática", {
      codigo: (e as { code?: unknown })?.code ?? "desconocido",
    });
  }
}
