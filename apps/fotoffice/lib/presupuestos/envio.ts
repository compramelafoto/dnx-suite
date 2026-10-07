import "server-only";
import { prisma } from "@repo/db";
import { notificarEvento } from "@/lib/circuitos/eventos";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";
import { numeroDe } from "@/lib/numeracion/asignar";
import { CANALES, MAX_ASUNTO, TOPE_AUTOMATICOS_DIA, TOPE_CORREOS_DIA, type Canal } from "@/lib/plantillas/constantes";
import { conListaDePrecios, contextoDe, correoValido, type ContextoMensaje } from "@/lib/plantillas/contexto";
import { listarPlantillas, plantillaParaUsar } from "@/lib/plantillas/definiciones";
import {
  abrirWhatsapp,
  completarTextos,
  correosEnviadosHoy,
  enviarCorreo,
  MENSAJES_ENVIO,
  type CtxEnvio,
  type DepsEnvio,
} from "@/lib/plantillas/envio";
import { tieneMarcadorSinCompletar } from "@/lib/plantillas/motor";
import { MENSAJES_PRESUPUESTO, puedeGestionarPresupuestos, QUOTES_MODULE_KEY, type CtxPresupuestos } from "./acceso";
import { leerAjustes } from "./ajustes";
import { ENTIDAD_NUMERACION, esEstadoPresupuesto } from "./constantes";
import { pesos } from "./editor";
import { resolverClaveDeEnlace, tokenDeVersion, urlDelPresupuesto, vencimientoDelToken, hashDeToken } from "./enlace";
import { estadoEfectivo, textoDeFecha } from "./estados";
import { asegurarPlantillasPresupuesto } from "./plantillas";
import { datosDeEnvio, numerarPresupuesto, pasarEstado } from "./presupuestos";
import { sitioDelWorkspace, type SitioDelPresupuesto } from "./sitio";
import { bloquearPresupuesto, congelarVersion, itemsGuardados, revocarAnteriores, type TotalesGuardados } from "./versiones";

/**
 * Enviar un presupuesto (spec etapa 2 §2 A.4, A.8; Task 5).
 *
 * Con "Gestionar" en Presupuestos. Dos casos:
 *
 * - **Hay un borrador** (la V1 sin enviar o la versión siguiente): en UNA transacción, con el
 *   candado del presupuesto, se congela la versión con el hash de su token y el vencimiento del
 *   token (validez + 30 días), se revocan los tokens de las versiones anteriores, se le da número
 *   (el primer envío) y el presupuesto pasa a ENVIADO con la validez renovada (`datosDeEnvio`) y
 *   la versión como vigente. Después, afuera de la transacción, sale el mensaje (correo con
 *   `enviarCorreo` o enlace de WhatsApp con `abrirWhatsapp`, los dos con su registro y sus topes) y
 *   se avisa al motor `PRESUPUESTO_ENVIADO`.
 * - **No hay borrador** (`reenviar`): se vuelve a mandar el mensaje con el enlace de la vigente, sin
 *   tocar estado, número ni validez. Un vencido o rechazado no se reenvía: necesita versión nueva.
 *
 * **Doble clic.** El candado serializa los dos pedidos: el segundo ya no encuentra borrador y,
 * si la vigente se envió hace menos de `VENTANA_REPETIDO_MS`, devuelve `repetido` sin mandar
 * nada. Un reenvío "reclama" el envío moviendo `updatedAt` sólo si el último cambio es más viejo
 * que esa ventana: el segundo reenvío seguido ve el reclamo del primero y tampoco manda.
 *
 * **Texto.** El de la plantilla elegida (PRESUPUESTO o GENERAL, del canal) o el que llega
 * (`asunto`/`cuerpo`, con variables). Se completa en el servidor con las variables de la consulta
 * y del presupuesto. Si el texto no tiene el enlace, se agrega al final (antes de la firma).
 * Antes de congelar se revisa todo lo que puede fallar sin depender del envío (destinatario,
 * plantilla, textos, tope diario), así un error así no deja el presupuesto enviado sin mensaje.
 *
 * Nunca loguea datos personales.
 */

export const VENTANA_REPETIDO_MS = 15_000;

export const MENSAJES_ENVIO_PRESUPUESTO = {
  sinClave: "El envío de presupuestos no está configurado. Avisale a quien administra FOTOFFICE.",
  sinSitio: "Para enviar presupuestos, la organización necesita su dirección pública (Configuración → Sitio web).",
  sinItems: "Agregá al menos un ítem antes de enviar.",
  sinTexto: "Elegí una plantilla o escribí el mensaje.",
  yaEnviado: "Esta versión ya se envió. Para mandarla otra vez usá «Reenviar»; para cambiarla, creá una versión nueva.",
  noReenviable: "Este presupuesto está vencido o rechazado: creá una versión nueva para volver a enviarlo.",
  sinVigente: "Este presupuesto todavía no se envió.",
  canal: "Elegí correo o WhatsApp.",
} as const;

export type DatosEnvioPresupuesto = {
  canal: unknown;
  templateId?: unknown;
  /** Texto propio (con variables). Sin él, el de la plantilla. */
  asunto?: unknown;
  cuerpo?: unknown;
  /** Volver a mandar la versión vigente (no hay borrador). */
  reenviar?: unknown;
};

export type ResultadoEnvioPresupuesto =
  | {
      ok: true;
      /** Doble clic: no se mandó nada nuevo. */
      repetido: boolean;
      versionId: string | null;
      numero: string | null;
      enlace: string | null;
      /** WhatsApp: el enlace `wa.me` para abrir. */
      whatsappUrl: string | null;
    }
  | {
      ok: false;
      error: string;
      /** El presupuesto quedó enviado (congelado) aunque el mensaje falló: se puede reenviar. */
      enviado?: boolean;
      enlace?: string | null;
    };

export type DepsEnvioPresupuesto = DepsEnvio & {
  /** La clave de los enlaces (undefined: la del entorno). */
  clave?: string | null;
  /** Dirección de FOTOFFICE (undefined: la del entorno). */
  appOrigin?: string;
};

type Falla = { ok: false; error: string };
const no = (error: string): Falla => ({ ok: false, error });

/** Para deshacer la transacción con un mensaje. */
class Corte extends Error {
  constructor(readonly mensaje: string) {
    super("corte");
  }
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

export function origenDe(deps: DepsEnvioPresupuesto): string {
  return (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
}

/** "aaaa-mm-dd" → "dd/mm/aaaa". */
export function ddmmaaaa(fecha: Date | null): string | null {
  const t = textoDeFecha(fecha);
  return t ? t.split("-").reverse().join("/") : null;
}

/** El enlace al final del texto (antes de `[firma]`, si está) cuando la plantilla no lo trae. */
export function conEnlace(cuerpo: string, enlace: string): string {
  if (cuerpo.includes(enlace)) return cuerpo;
  const linea = `Podés ver el presupuesto acá: ${enlace}`;
  const i = cuerpo.lastIndexOf("[firma]");
  if (i === -1) return `${cuerpo.trimEnd()}\n\n${linea}`;
  return `${cuerpo.slice(0, i).trimEnd()}\n\n${linea}\n\n${cuerpo.slice(i)}`;
}

export type Fuente = { asunto: string | null; cuerpo: string; templateId: string | null };

/** El texto a completar: el que llegó o el de la plantilla (PRESUPUESTO o GENERAL, del canal). */
async function fuenteDelTexto(workspaceId: string, canal: Canal, datos: DatosEnvioPresupuesto, automatico = false): Promise<Fuente | Falla> {
  let templateId: string | null = null;
  let plantilla: { subject: string | null; body: string } | null = null;
  if (datos.templateId !== undefined && datos.templateId !== null && datos.templateId !== "") {
    const p = await plantillaParaUsar(workspaceId, datos.templateId, canal, "PRESUPUESTO");
    // El envío automático sólo sale con una plantilla de PRESUPUESTO (no GENERAL), como exige `enviarCorreo`.
    if (!p || (automatico && p.entityType !== "PRESUPUESTO")) return no(MENSAJES_ENVIO.plantillaNoEncontrada);
    templateId = p.id;
    plantilla = { subject: p.subject, body: p.body };
  }
  if (typeof datos.cuerpo === "string" && datos.cuerpo.trim()) {
    const asunto = canal === "EMAIL" ? (typeof datos.asunto === "string" ? datos.asunto : "") : null;
    return { asunto, cuerpo: datos.cuerpo, templateId };
  }
  if (!plantilla) return no(MENSAJES_ENVIO_PRESUPUESTO.sinTexto);
  return { asunto: canal === "EMAIL" ? (plantilla.subject ?? "") : null, cuerpo: plantilla.body, templateId };
}

export type ValoresPresupuesto = NonNullable<ContextoMensaje["variables"]["presupuesto"]>;

/** Completa el texto con las variables (las del presupuesto incluidas) y lo deja listo para enviar. */
export function textosFinales(
  contexto: ContextoMensaje,
  canal: Canal,
  fuente: Fuente,
  valores: ValoresPresupuesto,
): { ok: true; asunto: string | null; cuerpo: string } | Falla {
  const conValores: ContextoMensaje = { ...contexto, variables: { ...contexto.variables, presupuesto: valores } };
  const r = completarTextos(conValores, "PRESUPUESTO", canal === "EMAIL" ? (fuente.asunto ?? "") : null, fuente.cuerpo);
  if (!r.ok) return r;
  const cuerpo = valores.enlace ? conEnlace(r.cuerpo, valores.enlace) : r.cuerpo;
  if (canal === "EMAIL" && (!r.asunto || r.asunto.length > MAX_ASUNTO)) return no(MENSAJES_ENVIO.asunto);
  if (tieneMarcadorSinCompletar(r.asunto) || tieneMarcadorSinCompletar(cuerpo)) return no(MENSAJES_ENVIO.marcadorSinCompletar);
  return { ok: true, asunto: canal === "EMAIL" ? r.asunto : null, cuerpo };
}

type Hecho =
  | { tipo: "REPETIDO" }
  | { tipo: "NUEVA" | "REENVIO"; versionId: string; validUntil: Date | null; numero: string | null; totals: TotalesGuardados | null };

/** Quién envía: una persona del equipo (con "Gestionar") o el sistema (la propuesta modelo, Entrega B). */
type Emisor = { workspaceId: string; ctxEnvio: CtxEnvio; nombre: string | null; automatico: boolean; registroId?: string };

export async function enviarPresupuesto(
  ctx: CtxPresupuestos,
  presupuestoId: unknown,
  datos: DatosEnvioPresupuesto,
  deps: DepsEnvioPresupuesto = {},
): Promise<ResultadoEnvioPresupuesto> {
  if (!puedeGestionarPresupuestos(ctx)) return no(MENSAJES_PRESUPUESTO.sinPermiso);
  const ctxEnvio: CtxEnvio = { workspaceId: ctx.workspaceId, userId: ctx.userId, userLabel: ctx.userLabel, role: ctx.role, acceso: ctx.acceso };
  return enviarComo({ workspaceId: ctx.workspaceId, ctxEnvio, nombre: ctx.userLabel ?? null, automatico: false }, presupuestoId, datos, deps);
}

/**
 * El sistema envía el borrador de un presupuesto por correo con una plantilla de PRESUPUESTO (la
 * propuesta modelo de la consulta web, `./propuesta-automatica.ts`). Sin usuario ni permisos: lo
 * llama sólo el servidor. Es un correo AUTOMÁTICO: cuenta en el tope de los automáticos
 * (`TOPE_AUTOMATICOS_DIA`), no en el de los manuales, y queda registrado con `automatic=true`.
 * La regla de una respuesta por dirección cada 24 h la mira quien llama, antes de crear nada; con
 * `registroId` el registro completa la reserva que hizo quien llama (`reservarEnvioAutomatico`).
 */
export async function enviarPresupuestoDelSistema(
  workspaceId: string,
  presupuestoId: string,
  templateId: string,
  deps: DepsEnvioPresupuesto = {},
  opciones: { registroId?: string } = {},
): Promise<ResultadoEnvioPresupuesto> {
  const ctxEnvio: CtxEnvio = { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
  const emisor: Emisor = { workspaceId, ctxEnvio, nombre: null, automatico: true, registroId: opciones.registroId };
  return enviarComo(emisor, presupuestoId, { canal: "EMAIL", templateId }, deps);
}

async function enviarComo(
  emisor: Emisor,
  presupuestoId: unknown,
  datos: DatosEnvioPresupuesto,
  deps: DepsEnvioPresupuesto,
): Promise<ResultadoEnvioPresupuesto> {
  if (!idValido(presupuestoId) || !datos || typeof datos !== "object") return no(MENSAJES_PRESUPUESTO.datosInvalidos);
  if (typeof datos.canal !== "string" || !(CANALES as readonly string[]).includes(datos.canal)) return no(MENSAJES_ENVIO_PRESUPUESTO.canal);
  const canal = datos.canal as Canal;
  // El sistema sólo envía por correo (WhatsApp abre un enlace que alguien tiene que mandar).
  if (emisor.automatico && canal !== "EMAIL") return no(MENSAJES_ENVIO_PRESUPUESTO.canal);
  const reenviar = datos.reenviar === true;
  const { workspaceId } = emisor;
  const ahora = (deps.ahora ?? (() => new Date()))();

  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return no(MENSAJES_ENVIO_PRESUPUESTO.sinClave);

  const p = await prisma.fotofficePresupuesto.findFirst({
    where: { id: presupuestoId, workspaceId },
    select: { id: true, status: true, consultaLeadId: true, currentVersionId: true, validUntil: true },
  });
  if (!p || !esEstadoPresupuesto(p.status)) return no(MENSAJES_PRESUPUESTO.noExiste);
  if (p.status === "ACEPTADO") return no(MENSAJES_PRESUPUESTO.aceptado);

  const sitio = await sitioDelWorkspace(workspaceId);
  const origen = origenDe(deps);
  const enlaceDe = (versionId: string) => (sitio ? urlDelPresupuesto({ ...sitio, appOrigin: origen, token: tokenDeVersion(versionId, clave) }) : null);
  if (!sitio || !urlDelPresupuesto({ ...sitio, appOrigin: origen, token: "x" })) return no(MENSAJES_ENVIO_PRESUPUESTO.sinSitio);

  // Lo que puede fallar sin depender del envío, ANTES de congelar.
  const fuente = await fuenteDelTexto(workspaceId, canal, datos, emisor.automatico);
  if ("ok" in fuente) return fuente;
  const usuario = { nombre: emisor.nombre, email: null };
  const leido = await contextoDe(workspaceId, "CONSULTA", p.consultaLeadId, usuario, ahora);
  if (!leido) return no(MENSAJES_PRESUPUESTO.consulta);
  const contexto = await conListaDePrecios(workspaceId, leido, fuente.asunto, fuente.cuerpo);
  if (canal === "EMAIL" && !correoValido(contexto.destino.email)) return no(MENSAJES_ENVIO.sinCorreo);
  if (canal === "WHATSAPP" && !normalizeWhatsappNumber(contexto.destino.telefono)) return no(MENSAJES_ENVIO.sinWhatsapp);
  const borradorAntes = await prisma.fotofficePresupuestoVersion.findFirst({
    where: { workspaceId, presupuestoId, sentAt: null },
    select: { id: true },
  });
  const ajustes = await leerAjustes(workspaceId);
  const objetivo = borradorAntes?.id ?? p.currentVersionId;
  const prueba = textosFinales(contexto, canal, fuente, {
    numero: "0",
    enlace: objetivo ? enlaceDe(objetivo) : null,
    total: pesos(0),
    vence: ddmmaaaa(datosDeEnvio(ahora, ajustes).validUntil),
  });
  if (!prueba.ok) return prueba;
  if (canal === "EMAIL") {
    // Cada grupo con su tope: los automáticos no consumen el de los manuales (ni al revés).
    if (emisor.automatico) {
      if ((await correosEnviadosHoy(workspaceId, ahora, true)) >= TOPE_AUTOMATICOS_DIA) return no(MENSAJES_ENVIO.topeAutomaticos);
    } else if ((await correosEnviadosHoy(workspaceId, ahora)) >= TOPE_CORREOS_DIA) {
      return no(MENSAJES_ENVIO.tope);
    }
  }

  let hecho: Hecho;
  try {
    hecho = await prisma.$transaction(async (tx): Promise<Hecho> => {
      await bloquearPresupuesto(tx, presupuestoId);
      const actual = await tx.fotofficePresupuesto.findFirst({
        where: { id: presupuestoId, workspaceId },
        select: { status: true, currentVersionId: true, validUntil: true, updatedAt: true },
      });
      if (!actual || !esEstadoPresupuesto(actual.status)) throw new Corte(MENSAJES_PRESUPUESTO.noExiste);
      if (actual.status === "ACEPTADO") throw new Corte(MENSAJES_PRESUPUESTO.aceptado);

      const borrador = await tx.fotofficePresupuestoVersion.findFirst({
        where: { workspaceId, presupuestoId, sentAt: null },
        select: { id: true, items: true, totals: true },
      });
      if (borrador) {
        if (itemsGuardados(borrador.items).length === 0) throw new Corte(MENSAJES_ENVIO_PRESUPUESTO.sinItems);
        const envio = datosDeEnvio(ahora, ajustes);
        const token = tokenDeVersion(borrador.id, clave);
        const congelada = await congelarVersion(tx, {
          workspaceId, versionId: borrador.id, ahora, tokenHash: hashDeToken(token), tokenExpiresAt: vencimientoDelToken(envio.validUntil),
        });
        if (!congelada) throw new Corte(MENSAJES_PRESUPUESTO.cambio);
        await revocarAnteriores(tx, { workspaceId, presupuestoId, vigenteId: borrador.id, ahora });
        const numero = await numerarPresupuesto(tx, { workspaceId, presupuestoId, fecha: ahora });
        const estado = await pasarEstado(tx, {
          workspaceId, presupuestoId, a: "ENVIADO", ahora,
          datos: { ...envio, currentVersionId: borrador.id, updatedAt: ahora },
        });
        if (!estado.ok) throw new Corte(estado.error);
        return { tipo: "NUEVA", versionId: borrador.id, validUntil: envio.validUntil, numero: numero.display, totals: borrador.totals as TotalesGuardados };
      }

      const vigente = actual.currentVersionId
        ? await tx.fotofficePresupuestoVersion.findFirst({
            where: { id: actual.currentVersionId, workspaceId, presupuestoId },
            select: { id: true, sentAt: true, totals: true },
          })
        : null;
      if (!vigente?.sentAt) throw new Corte(MENSAJES_ENVIO_PRESUPUESTO.sinVigente);
      if (!reenviar) {
        // Doble clic en "Enviar": la otra pestaña (o el primer clic) ya la mandó.
        if (ahora.getTime() - vigente.sentAt.getTime() < VENTANA_REPETIDO_MS) return { tipo: "REPETIDO" };
        throw new Corte(MENSAJES_ENVIO_PRESUPUESTO.yaEnviado);
      }
      const efectivo = estadoEfectivo(actual.status, actual.validUntil, ahora);
      if (efectivo === "VENCIDO" || efectivo === "RECHAZADO" || efectivo === "BORRADOR") throw new Corte(MENSAJES_ENVIO_PRESUPUESTO.noReenviable);
      const reclamo = await tx.fotofficePresupuesto.updateMany({
        where: { id: presupuestoId, workspaceId, updatedAt: { lt: new Date(ahora.getTime() - VENTANA_REPETIDO_MS) } },
        data: { updatedAt: ahora },
      });
      if (reclamo.count !== 1) return { tipo: "REPETIDO" };
      return { tipo: "REENVIO", versionId: vigente.id, validUntil: actual.validUntil, numero: null, totals: vigente.totals as TotalesGuardados };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    console.error("[presupuestos] enviarPresupuesto falló", { codigo: typeof (e as { code?: unknown })?.code === "string" ? (e as { code: string }).code : null });
    return no(MENSAJES_PRESUPUESTO.fallo);
  }

  if (hecho.tipo === "REPETIDO") return { ok: true, repetido: true, versionId: null, numero: null, enlace: null, whatsappUrl: null };

  const numero = hecho.numero ?? (await numeroDe(workspaceId, ENTIDAD_NUMERACION, [presupuestoId])).get(presupuestoId) ?? null;
  const enlace = enlaceDe(hecho.versionId);
  const textos = textosFinales(contexto, canal, fuente, {
    numero,
    enlace,
    total: pesos(hecho.totals?.total ?? 0),
    vence: ddmmaaaa(hecho.validUntil),
  });

  if (hecho.tipo === "NUEVA") {
    // El motor nunca lanza; un evento repetido (misma versión) no mueve dos veces.
    await notificarEvento(workspaceId, { tipo: "CAPTACION", id: p.consultaLeadId }, "PRESUPUESTO_ENVIADO", hecho.versionId);
  }

  const quedoEnviado = (error: string): ResultadoEnvioPresupuesto => ({
    ok: false,
    error: hecho.tipo === "NUEVA" ? `El presupuesto quedó enviado, pero el mensaje no salió: ${error} Podés reenviarlo.` : error,
    enviado: true,
    enlace,
  });
  if (!textos.ok) return quedoEnviado(textos.error);

  const { ctxEnvio } = emisor;
  const opciones = { modulo: QUOTES_MODULE_KEY, tipoPlantilla: "PRESUPUESTO" as const };
  if (canal === "EMAIL") {
    const r = await enviarCorreo(
      ctxEnvio,
      {
        entityType: "CONSULTA", entityId: p.consultaLeadId, templateId: fuente.templateId, asunto: textos.asunto, cuerpo: textos.cuerpo,
        automatico: emisor.automatico,
        ...(emisor.registroId ? { registroId: emisor.registroId } : {}),
      },
      { enviar: deps.enviar, ahora: () => ahora },
      opciones,
    );
    if (!r.ok) return quedoEnviado(r.error);
    return { ok: true, repetido: false, versionId: hecho.versionId, numero, enlace, whatsappUrl: null };
  }
  const r = await abrirWhatsapp(ctxEnvio, { entityType: "CONSULTA", entityId: p.consultaLeadId, templateId: fuente.templateId, cuerpo: textos.cuerpo }, opciones);
  if (!r.ok) return quedoEnviado(r.error);
  return { ok: true, repetido: false, versionId: hecho.versionId, numero, enlace, whatsappUrl: r.url };
}

// --- Lo que necesita la pantalla para enviar ------------------------------------------------------

export type PlantillaDeEnvio = { id: string; nombre: string; canal: Canal; asunto: string | null; cuerpo: string };

export type OpcionesDeEnvio = {
  plantillas: PlantillaDeEnvio[];
  destino: { correo: boolean; whatsapp: boolean };
  /** Enlace de la versión vigente ya enviada ("Copiar enlace"), o null. */
  enlace: string | null;
  /** Hay un borrador para enviar. */
  hayBorrador: boolean;
  /** La vigente se puede reenviar (enviada o vista, sin vencer). */
  puedeReenviar: boolean;
  /** Por qué no se puede enviar nada (sin clave o sin dirección pública), o null. */
  bloqueo: string | null;
};

/**
 * Plantillas (PRESUPUESTO y GENERAL de cada canal, con su texto con variables), si la persona
 * tiene correo o WhatsApp, y el enlace vigente. Siembra una vez las plantillas de PRESUPUESTO.
 * Con "Gestionar"; si no, null.
 */
export async function opcionesDeEnvio(
  ctx: CtxPresupuestos,
  presupuestoId: string,
  deps: { clave?: string | null; appOrigin?: string; ahora?: () => Date } = {},
): Promise<OpcionesDeEnvio | null> {
  if (!puedeGestionarPresupuestos(ctx) || !idValido(presupuestoId)) return null;
  const { workspaceId } = ctx;
  const ahora = (deps.ahora ?? (() => new Date()))();
  const p = await prisma.fotofficePresupuesto.findFirst({
    where: { id: presupuestoId, workspaceId },
    select: { status: true, consultaLeadId: true, currentVersionId: true, validUntil: true },
  });
  if (!p || !esEstadoPresupuesto(p.status)) return null;
  await asegurarPlantillasPresupuesto(workspaceId);
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  const [sitio, email, whatsapp, borrador, vigente, lead] = await Promise.all([
    sitioDelWorkspace(workspaceId),
    listarPlantillas(workspaceId, { canal: "EMAIL", tipo: "PRESUPUESTO" }),
    listarPlantillas(workspaceId, { canal: "WHATSAPP", tipo: "PRESUPUESTO" }),
    prisma.fotofficePresupuestoVersion.findFirst({ where: { workspaceId, presupuestoId, sentAt: null }, select: { id: true } }),
    p.currentVersionId
      ? prisma.fotofficePresupuestoVersion.findFirst({ where: { id: p.currentVersionId, workspaceId, presupuestoId }, select: { id: true, sentAt: true } })
      : Promise.resolve(null),
    prisma.serviceSalesLead.findFirst({ where: { id: p.consultaLeadId, workspaceId }, select: { email: true, phone: true } }),
  ]);
  const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
  const conSitio = (s: SitioDelPresupuesto | null, token: string) => (s ? urlDelPresupuesto({ ...s, appOrigin: origen, token }) : null);
  const bloqueo = !clave ? MENSAJES_ENVIO_PRESUPUESTO.sinClave : !conSitio(sitio, "x") ? MENSAJES_ENVIO_PRESUPUESTO.sinSitio : null;
  const enviada = vigente?.sentAt ? vigente : null;
  const efectivo = estadoEfectivo(p.status, p.validUntil, ahora);
  const plantilla = (f: { id: string; name: string; channel: Canal; subject: string | null; body: string }): PlantillaDeEnvio => ({
    id: f.id, nombre: f.name, canal: f.channel, asunto: f.subject, cuerpo: f.body,
  });
  return {
    plantillas: [...email, ...whatsapp].map(plantilla),
    destino: { correo: correoValido(lead?.email?.trim()), whatsapp: normalizeWhatsappNumber(lead?.phone) !== null },
    enlace: enviada && clave && !bloqueo ? conSitio(sitio, tokenDeVersion(enviada.id, clave)) : null,
    hayBorrador: borrador !== null && p.status !== "ACEPTADO",
    puedeReenviar: enviada !== null && (efectivo === "ENVIADO" || efectivo === "VISTO"),
    bloqueo,
  };
}
