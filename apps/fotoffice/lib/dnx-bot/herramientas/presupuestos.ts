import { randomUUID } from "node:crypto";
import { defineTool, z, type BotTool } from "@repo/dnx-bot";
import { formatCuantoCobroCurrency } from "@repo/cuanto-cobro-core";
import { leerPerfilPrecios } from "@/lib/precios/perfil";
import { MENSAJES_PRESUPUESTO } from "@/lib/presupuestos/acceso";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { ajustadosIniciales, firmaDelBorrador, itemsParaGuardar } from "@/lib/presupuestos/editor";
import { perfilParaPanel } from "@/lib/presupuestos/panel-cuanto-cobro";
import { leerPropuestaModelo } from "@/lib/presupuestos/propuestas-modelo";
import { crearPresupuesto, guardarBorrador, leerPresupuesto, type DetallePresupuesto } from "@/lib/presupuestos/presupuestos";
import { calcularTotales } from "@/lib/presupuestos/totales";
import type { EntradaBorrador, VersionVista } from "@/lib/presupuestos/versiones";
import type { CtxBot } from "../acceso";
import { buscarConsultasDelBot, consultaParaBorrador, type ConsultaBot } from "../consultas";
import { perfilBase } from "../motor";
import { cotizar, esquemaCotizacion, tarjetaDeCotizacion, type Cotizacion, type ResultadoCotizacion } from "../motor-trabajo";

/**
 * Etapa 2 · ¿Cuánto cobro esto? → borrador de presupuesto (spec §6.2).
 *
 * - `cotizar_trabajo` (lectura, `configurar`): precio del motor, sin escribir nada.
 * - `buscar_consultas` (lectura, `configurar` + «Ver» en Consultas): para elegir la consulta.
 * - `ver_presupuesto` (lectura, cualquiera con «Ver» en Presupuestos; sin costos si no configura).
 * - `crear_borrador_de_presupuesto` y `sumar_al_borrador` (escritura, `configurar` + «Gestionar»).
 *
 * Las escrituras van SIEMPRE por `crearPresupuesto` y `guardarBorrador`, que vuelven a validar
 * permisos, candado, versión sin enviar y recalculan cada ítem (R2). Nada escribe en Prisma acá.
 * El total que vio la persona viaja en la entrada (`totalEsperado`): si al describir o al confirmar
 * el motor da otro (cambió el perfil), no se guarda otra cosa.
 */

export type DepsPresupuestosBot = {
  leerPerfil: typeof leerPerfilPrecios;
  buscarConsultas: typeof buscarConsultasDelBot;
  consulta: typeof consultaParaBorrador;
  leerPresupuesto: (ctx: CtxBot, id: string) => Promise<DetallePresupuesto | null>;
  crearPresupuesto: (ctx: CtxBot, datos: { consultaLeadId: string }) => ReturnType<typeof crearPresupuesto>;
  guardarBorrador: (ctx: CtxBot, id: string, entrada: EntradaBorrador, control?: { version: Date; firma: string }) => ReturnType<typeof guardarBorrador>;
  itemsDePropuestaModelo: (workspaceId: string, categoriaId: string | null) => Promise<number>;
  ahora: () => Date;
  nuevaClave: () => string;
};

const DEPS: DepsPresupuestosBot = {
  leerPerfil: leerPerfilPrecios,
  buscarConsultas: buscarConsultasDelBot,
  consulta: consultaParaBorrador,
  leerPresupuesto: (ctx, id) => leerPresupuesto(ctx, id),
  crearPresupuesto: (ctx, datos) => crearPresupuesto(ctx, datos),
  guardarBorrador: (ctx, id, entrada, control) => guardarBorrador(ctx, id, entrada, {}, control),
  itemsDePropuestaModelo: async (workspaceId, categoriaId) => (categoriaId ? ((await leerPropuestaModelo(workspaceId, categoriaId))?.items.length ?? 0) : 0),
  ahora: () => new Date(),
  nuevaClave: () => `bot${randomUUID().replace(/-/g, "").slice(0, 20)}`,
};

const RUTA_PRECIOS = "/workspace/configuracion/precios";
export const CAMBIO_EL_CALCULO = "El cálculo cambió desde que te lo mostré: volvé a cotizar.";

const pesos = (n: number) => formatCuantoCobroCurrency(n, "ARS");
const totalDe = (items: readonly ItemPresupuesto[]) => Math.round(items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0));
const idPresupuesto = z.string().min(1).max(64);
const totalEsperado = z
  .string()
  .regex(/^\d{1,12}$/)
  .describe("El `totalParaConfirmar` que devolvió cotizar_trabajo para este mismo trabajo. Si el cálculo cambió, la acción no se hace.");
const seccion = z.string().max(120).optional().describe("Sección del presupuesto donde van los ítems (opcional).");

async function cotizarCon(ctx: CtxBot, c: Cotizacion, deps: DepsPresupuestosBot, seccionDe?: string): Promise<ResultadoCotizacion> {
  const g = await deps.leerPerfil(ctx);
  return cotizar(perfilBase(g?.perfil ?? null), c, { nuevaClave: deps.nuevaClave, ahora: deps.ahora(), seccion: seccionDe ?? null });
}

/** Mensaje de por qué no hay precio, para el modelo y para la tarjeta. */
function sinPrecio(r: Exclude<ResultadoCotizacion, { estado: "OK" }>): string {
  if (r.estado === "PERFIL_INCOMPLETO") return `Sin perfil de precios completo no hay precio. Falta: ${r.faltan.join(", ")}. Se completa en ${RUTA_PRECIOS}.`;
  return r.faltan.length ? `${r.error} Falta: ${r.faltan.join(", ")}.` : r.error;
}

export function siguientePaso(c: ConsultaBot): string {
  if (!c.tieneFicha) return `Le falta el contacto: hay que completarla en /consultas/${c.leadId} antes de presupuestar.`;
  const borrador = c.presupuestos.find((p) => p.tieneBorrador);
  if (borrador) return `Ya tiene un presupuesto en borrador: usá sumar_al_borrador con presupuestoId ${borrador.id}.`;
  return "Se puede crear el borrador con crear_borrador_de_presupuesto.";
}

function textoConsulta(c: ConsultaBot): string {
  const extra = [c.categoria, c.fechaEvento].filter(Boolean).join(" · ");
  return `la consulta ${c.numero ? `N.º ${c.numero}` : "sin número"}${extra ? ` (${extra})` : ""}`;
}

function lineaItems(items: readonly ItemPresupuesto[]): string {
  return items.map((i) => `${i.nombre} ${pesos(i.precioUnitario * i.cantidad)}`).join(" · ");
}

function gananciaDe(r: Extract<ResultadoCotizacion, { estado: "OK" }>): string {
  const t = r.resumen.total;
  return t.gananciaPct ? `${t.ganancia} (${t.gananciaPct})` : t.ganancia;
}

/** Lo que se manda a `guardarBorrador` con estos ítems, sin tocar descuento, condiciones ni propuesta de pago. */
function entradaCon(items: ItemPresupuesto[], borrador: VersionVista): EntradaBorrador {
  return {
    items: itemsParaGuardar(items, true, ajustadosIniciales(items)),
    descuento: borrador.totals.descuento ?? null,
    condiciones: borrador.terms,
    propuestaPago: borrador.paymentProposal,
  };
}

async function validarCreacion(ctx: CtxBot, input: Cotizacion & { consultaLeadId: string; totalEsperado: string; seccion?: string }, deps: DepsPresupuestosBot) {
  const consulta = await deps.consulta(ctx, input.consultaLeadId);
  if (!consulta) return { ok: false, error: MENSAJES_PRESUPUESTO.consulta } as const;
  if (!consulta.tieneFicha) return { ok: false, error: `${MENSAJES_PRESUPUESTO.consultaSinContacto} Está en /consultas/${consulta.leadId}.` } as const;
  const borrador = consulta.presupuestos.find((p) => p.tieneBorrador);
  if (borrador) {
    return { ok: false, error: `Esa consulta ya tiene el presupuesto ${borrador.numero ? `N.º ${borrador.numero}` : ""} en borrador: usá sumar_al_borrador con presupuestoId ${borrador.id}.` } as const;
  }
  const r = await cotizarCon(ctx, input, deps, input.seccion);
  if (r.estado !== "OK") return { ok: false, error: sinPrecio(r) } as const;
  if (String(totalDe(r.items)) !== input.totalEsperado) return { ok: false, error: CAMBIO_EL_CALCULO } as const;
  return { ok: true, consulta, r } as const;
}

async function validarSuma(ctx: CtxBot, input: Cotizacion & { presupuestoId: string; totalEsperado: string; seccion?: string }, deps: DepsPresupuestosBot) {
  const d = await deps.leerPresupuesto(ctx, input.presupuestoId);
  if (!d) return { ok: false, error: MENSAJES_PRESUPUESTO.noExiste } as const;
  if (!d.borrador) return { ok: false, error: `${MENSAJES_PRESUPUESTO.sinBorrador} Si ya se envió, creá una versión nueva desde /presupuestos/${d.id}.` } as const;
  const r = await cotizarCon(ctx, input, deps, input.seccion);
  if (r.estado !== "OK") return { ok: false, error: sinPrecio(r) } as const;
  if (String(totalDe(r.items)) !== input.totalEsperado) return { ok: false, error: CAMBIO_EL_CALCULO } as const;
  return { ok: true, d, borrador: d.borrador, existentes: d.borrador.items as ItemPresupuesto[], r } as const;
}

export function herramientasDePresupuestos(ctx: CtxBot, depsParciales: Partial<DepsPresupuestosBot> = {}): BotTool[] {
  const deps: DepsPresupuestosBot = { ...DEPS, ...depsParciales };
  const { configurar, gestionarPresupuestos, verConsultas } = ctx.capacidades;
  // COLLABORATOR sólo ve lo que le asignan: no se le abre un buscador de todas las consultas.
  const colaborador = ctx.role === "COLLABORATOR";
  const tools: BotTool[] = [];

  if (configurar) {
    tools.push(
      defineTool({
        name: "cotizar_trabajo",
        description:
          "Calcula con ¿Cuánto Cobro? (el motor del panel) el precio de un trabajo descripto por la persona: precio recomendado, mínimo para no perder plata y ganancia, por concepto y total. No escribe nada. Para cualquier variante (sumar un álbum, cambiar horas, fijar un total a mano) volvé a usarla: nunca hagas la cuenta vos.",
        input: esquemaCotizacion,
        kind: "read",
        run: async (input) => {
          const r = await cotizarCon(ctx, input, deps);
          if (r.estado !== "OK") {
            return { ok: true, message: sinPrecio(r), data: { estado: r.estado, faltan: r.faltan, ...(r.estado === "PERFIL_INCOMPLETO" ? { ruta: RUTA_PRECIOS } : {}) } };
          }
          return {
            ok: true,
            message: "Cálculo listo (no se guardó nada).",
            data: { estado: "OK", ...r.resumen, totalParaConfirmar: String(totalDe(r.items)), tarjeta: tarjetaDeCotizacion(r.resumen, input.tipoDeTrabajo) },
          };
        },
      }),
    );
  }

  if (configurar && verConsultas && !colaborador) {
    tools.push(
      defineTool({
        name: "buscar_consultas",
        description:
          "Busca consultas del workspace por texto (nombre de pila, categoría, número) o por fecha del evento. Devuelve hasta 10, con sus presupuestos y qué herramienta usar después. Sólo trae el nombre de pila del cliente.",
        input: z.object({
          texto: z.string().max(80).optional(),
          desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha del evento desde (aaaa-mm-dd)."),
          hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha del evento hasta (aaaa-mm-dd)."),
          soloSinPresupuesto: z.boolean().optional(),
        }),
        kind: "read",
        run: async (filtros) => {
          const consultas = await deps.buscarConsultas(ctx, filtros);
          return {
            ok: true,
            message: consultas.length ? `${consultas.length} consulta(s).` : "No encontré consultas con eso.",
            data: { consultas: consultas.map((c) => ({ ...c, siguientePaso: siguientePaso(c) })) },
          };
        },
      }),
    );
  }

  tools.push(
    defineTool({
      name: "ver_presupuesto",
      description:
        "Lee un presupuesto del workspace: número, estado, ítems y total del borrador (o de la versión vigente). Con permiso de costos, también la ganancia de cada ítem calculado. Pasale el presupuestoId (el id que da la situación o buscar_consultas), no el número N.º.",
      input: z.object({ presupuestoId: idPresupuesto }),
      kind: "read",
      run: async ({ presupuestoId }) => {
        const d = await deps.leerPresupuesto(ctx, presupuestoId);
        if (!d) return { ok: false, message: MENSAJES_PRESUPUESTO.noExiste };
        const v = d.borrador ?? d.vigente;
        const items = (v?.items ?? []) as ItemPresupuesto[];
        let perfilDesactualizado = false;
        if (d.veCostos && configurar) {
          const g = await deps.leerPerfil(ctx);
          perfilDesactualizado = items.some((i) => perfilParaPanel(i.calculo ? i : null, g?.perfil ?? null).desactualizado);
        }
        return {
          ok: true,
          message: "Presupuesto leído.",
          data: {
            id: d.id,
            numero: d.numero,
            estado: d.estado,
            version: v?.number ?? null,
            esBorrador: !!d.borrador,
            enviado: !!d.vigente?.sentAt,
            validoHasta: d.validUntil,
            items: items.map((i) => ({
              nombre: i.nombre,
              modo: i.modoPrecio === "CALCULO" ? "¿Cuánto Cobro?" : "precio de lista",
              precio: pesos(i.precioUnitario * i.cantidad),
              ...(d.veCostos && i.calculo ? { ganancia: pesos(i.calculo.margenElegido) } : {}),
              ...(i.opcional ? { opcional: true } : {}),
            })),
            total: pesos(v?.totals.total ?? 0),
            ...(perfilDesactualizado ? { aviso: "Hay ítems calculados con un perfil de precios anterior." } : {}),
          },
        };
      },
    }),
  );

  if (configurar && gestionarPresupuestos) {
    tools.push(
      defineTool({
        name: "crear_borrador_de_presupuesto",
        description:
          "Propone crear el borrador del presupuesto de una consulta con los ítems calculados (los mismos de cotizar_trabajo), en lugar de los que traería la propuesta modelo. No se hace hasta que la persona toque «Confirmar». No se puede deshacer desde el chat. Si la consulta ya tiene un borrador, usá sumar_al_borrador.",
        input: esquemaCotizacion.extend({ consultaLeadId: idPresupuesto, totalEsperado, seccion }),
        kind: "write",
        describe: async (input) => {
          const v = await validarCreacion(ctx, input, deps);
          if (!v.ok) throw new Error(v.error);
          const modelo = await deps.itemsDePropuestaModelo(ctx.workspaceId, v.consulta.categoriaId);
          return [
            `Crear el borrador del presupuesto de ${textoConsulta(v.consulta)} con ${v.r.items.length} ${v.r.items.length === 1 ? "ítem" : "ítems"}: ${lineaItems(v.r.items)}.`,
            `Total ${pesos(totalDe(v.r.items))}. Ganancia ${gananciaDe(v.r)}.`,
            ...(modelo > 0 ? [`Reemplaza los ${modelo} ítems de la propuesta modelo.`] : []),
            "Esto no se deshace desde acá.",
          ].join(" ");
        },
        run: async (input) => {
          const v = await validarCreacion(ctx, input, deps);
          if (!v.ok) return { ok: false, message: v.error };
          const creado = await deps.crearPresupuesto(ctx, { consultaLeadId: input.consultaLeadId });
          if (!creado.ok) return { ok: false, message: creado.error };
          const d = await deps.leerPresupuesto(ctx, creado.presupuestoId);
          if (!d?.borrador) return { ok: false, message: `Creé el presupuesto pero no pude cargarle los ítems: abrilo en /presupuestos/${creado.presupuestoId}.` };
          const g = await deps.guardarBorrador(ctx, creado.presupuestoId, entradaCon(v.r.items, d.borrador));
          if (!g.ok) return { ok: false, message: `Creé el presupuesto pero no pude cargarle los ítems (${g.error}): abrilo en /presupuestos/${creado.presupuestoId}.` };
          return {
            ok: true,
            message: `Listo: borrador creado con ${v.r.items.length} ítems por ${pesos(totalDe(v.r.items))}. Está en /presupuestos/${creado.presupuestoId}. Enviarlo lo hacés vos desde ahí.`,
            after: { presupuestoId: creado.presupuestoId },
          };
        },
      }),
      defineTool({
        name: "sumar_al_borrador",
        description:
          "Propone sumar ítems calculados (los mismos de cotizar_trabajo) al borrador de un presupuesto existente, sin tocar los que ya tiene. No se hace hasta que la persona toque «Confirmar». Se puede deshacer 10 minutos.",
        input: esquemaCotizacion.extend({ presupuestoId: idPresupuesto, totalEsperado, seccion }),
        kind: "write",
        describe: async (input) => {
          const v = await validarSuma(ctx, input, deps);
          if (!v.ok) throw new Error(v.error);
          const descuento = v.borrador.totals.descuento ?? null;
          const antes = calcularTotales(v.existentes, descuento).total;
          const despues = calcularTotales([...v.existentes, ...v.r.items], descuento).total;
          const g = await deps.leerPerfil(ctx);
          const viejos = v.existentes.some((i) => perfilParaPanel(i.calculo ? i : null, g?.perfil ?? null).desactualizado);
          return [
            `Sumar al borrador del presupuesto ${v.d.numero ? `N.º ${v.d.numero}` : ""} ${v.r.items.length} ${v.r.items.length === 1 ? "ítem" : "ítems"}: ${lineaItems(v.r.items)}.`,
            `El total pasa de ${pesos(antes)} a ${pesos(despues)}.`,
            ...(viejos ? ["Ojo: el borrador tiene ítems calculados con un perfil de precios anterior."] : []),
          ]
            .join(" ")
            .replace(/\s+/g, " ");
        },
        run: async (input) => {
          const v = await validarSuma(ctx, input, deps);
          if (!v.ok) return { ok: false, message: v.error };
          const todos = [...v.existentes, ...v.r.items];
          // Con lo que se acaba de leer: si alguien guardó el borrador en el medio, no se pisa.
          const control = {
            version: v.d.updatedAt,
            firma: firmaDelBorrador(v.existentes, v.borrador.terms, v.borrador.paymentProposal, v.borrador.totals.descuento ?? null),
          };
          const g = await deps.guardarBorrador(ctx, v.d.id, entradaCon(todos, v.borrador), control);
          if (!g.ok) return { ok: false, message: g.error };
          return {
            ok: true,
            message: `Listo: sumé ${v.r.items.length} ítems al borrador. Está en /presupuestos/${v.d.id}: si lo tenés abierto, recargalo antes de seguir editando (si guardás lo de antes, se pierden).`,
            before: { presupuestoId: v.d.id, entrada: entradaCon(v.existentes, v.borrador), idsDespues: todos.map((i) => i.id) },
          };
        },
        undo: async (before) => {
          const b = before as { presupuestoId?: unknown; entrada?: unknown; idsDespues?: unknown } | null;
          if (!b || typeof b.presupuestoId !== "string" || !Array.isArray(b.idsDespues) || !b.entrada) {
            return { ok: false, message: "No tengo cómo volver atrás." };
          }
          const d = await deps.leerPresupuesto(ctx, b.presupuestoId);
          const ids = ((d?.borrador?.items ?? []) as ItemPresupuesto[]).map((i) => i.id);
          // Sólo si el borrador sigue como lo dejó el bot: deshacer no pisa cambios posteriores.
          if (!d?.borrador || JSON.stringify(ids) !== JSON.stringify(b.idsDespues)) {
            return { ok: false, message: "El borrador cambió después: deshacelo desde el editor." };
          }
          const g = await deps.guardarBorrador(ctx, b.presupuestoId, b.entrada as EntradaBorrador);
          return g.ok ? { ok: true, message: "Listo, saqué los ítems que había sumado." } : { ok: false, message: g.error };
        },
      }),
    );
  }
  return tools;
}
