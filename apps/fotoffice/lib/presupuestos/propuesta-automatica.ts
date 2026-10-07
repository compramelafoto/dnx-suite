import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { moduloDeRegistroEncendido } from "@/lib/campos/modulos";
import { leerAjustes as leerAjustesConsultas, type DepsAjustes } from "@/lib/consultas/ajustes";
import { destinatarioDelAviso } from "@/lib/consultas/aviso";
import { decimalArsToMinor } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { yaRespondida } from "@/lib/plantillas/automaticos";
import { TOPE_AUTOMATICOS_DIA } from "@/lib/plantillas/constantes";
import { correoValido, destinoDe } from "@/lib/plantillas/contexto";
import { AUTOMATICOS, leerAutomatico } from "@/lib/plantillas/definiciones";
import { correosEnviadosHoy, MENSAJES_ENVIO } from "@/lib/plantillas/envio";
import { QUOTES_MODULE_KEY } from "./acceso";
import { leerAjustes } from "./ajustes";
import { MAX_DESCRIPCION_ITEM, MAX_NOMBRE_ITEM, type ItemPresupuesto } from "./constantes";
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
  | "ERROR";

/** ¿Va la respuesta automática común? Sólo si la propuesta no salió y no hay motivo para no responder. */
export function correspondeAutorespuestaComun(r: ResultadoPropuestaAutomatica): boolean {
  return r !== "ENVIADA" && r !== "APAGADA" && r !== "YA_RESPONDIDO";
}

export type DepsPropuestaAutomatica = DepsEnvioPresupuesto & DepsAjustes;

function aviso(codigo: string): void {
  console.warn("[presupuestos] la propuesta modelo no salió sola", { codigo });
}

/** Los ítems de la propuesta con nombre, descripción y precio del catálogo de hoy; null si falta alguno. */
async function itemsAlPrecioDeHoy(workspaceId: string, items: ItemPresupuesto[]): Promise<ItemPresupuesto[] | null> {
  const ids = [...new Set(items.map((i) => i.productId).filter((x): x is string => x !== null))];
  const productos = await prisma.product.findMany({
    where: { workspaceId, id: { in: ids }, isActive: true },
    select: { id: true, name: true, description: true, priceArs: true },
  });
  const deId = new Map(productos.map((p) => [p.id, p]));
  const out: ItemPresupuesto[] = [];
  for (const it of items) {
    const p = it.productId ? deId.get(it.productId) : undefined;
    // Un producto que se archivó o se borró después: la propuesta quedó vieja y no se manda a medias.
    if (!p) return null;
    const descripcion = p.description?.trim() ? p.description.trim().slice(0, MAX_DESCRIPCION_ITEM) : null;
    out.push({
      ...it,
      nombre: p.name.trim().slice(0, MAX_NOMBRE_ITEM) || it.nombre,
      descripcion,
      precioUnitario: decimalArsToMinor(p.priceArs) / 100,
      modoPrecio: "LISTA",
      calculo: null,
    });
  }
  return out;
}

export async function enviarPropuestaModelo(
  workspaceId: string,
  leadId: string,
  deps: DepsPropuestaAutomatica = {},
): Promise<ResultadoPropuestaAutomatica> {
  let creado: string | null = null;
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
    const items = await itemsAlPrecioDeHoy(workspaceId, propuesta.items);
    if (!items) {
      aviso("PRODUCTO_FUERA_DEL_CATALOGO");
      return "FALLO";
    }
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

    // El presupuesto, como lo crea `crearPresupuesto` pero del sistema: sin usuario.
    creado = await prisma.$transaction(async (tx) => {
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
      return p.id;
    });

    const r = await enviarPresupuestoDelSistema(workspaceId, creado, plantilla.id, deps);
    if (r.ok && !r.repetido) return "ENVIADA";
    if (!r.ok && r.enviado) {
      // Quedó enviado (congelado) pero el correo no salió: el presupuesto queda para reenviarlo.
      aviso("CORREO_NO_SALIO");
      return "FALLO";
    }
    // No se congeló: el borrador que creó el sistema no le sirve a nadie, se borra.
    await borrarBorradorDelSistema(workspaceId, creado);
    if (!r.ok && r.error === MENSAJES_ENVIO.topeAutomaticos) {
      aviso("TOPE_AUTOMATICOS");
      return "TOPE";
    }
    aviso("NO_ENVIADO");
    return "FALLO";
  } catch (e) {
    console.error("[presupuestos] falló la propuesta modelo automática", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    if (creado) await borrarBorradorDelSistema(workspaceId, creado);
    return "ERROR";
  }
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
