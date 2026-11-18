import { prisma, type Prisma } from "@repo/db";
import { META_APP_ID } from "./coexistencia";
import { PAUSA_BOT_HORAS_POR_DEFECTO, type Canal } from "./constantes";
import { partirPorBytes } from "./instagram/partir";
import { perfilInstagram, type PerfilInstagram } from "./instagram/perfil";
import { alEco, alEntrante, atiendeElBot, MINUTOS_PENDIENTE_INCIERTO, type EstadoChat, type ParcheChat, type ResultadoRegla } from "./reglas";
import { mismoTelefono, ultimos6 } from "./telefono";
import { vistaPreviaDe } from "./vista-previa";
import { mismoTextoSeguro, type EventoEco, type EventoEntrante, type EventoEstado, type EventoWa } from "./webhook";

/**
 * Registro de la Bandeja de WhatsApp (servidor): aplica los eventos del webhook a chats y mensajes
 * (§3, §4 y §5 del diseño). Idempotente por `waMessageId`: Meta reintenta, y un reintento no
 * vuelve a sumar no leídos ni a aplicar reglas. Nunca loguea textos ni teléfonos.
 */

/** `fallidos`: eventos que fallaron por un error inesperado (el resto del lote se aplicó igual). */
/** `paraElBot`: chats donde entró un mensaje del cliente y los atiende el bot (los contesta `responderConBot`). */
/** `medios`: mensajes nuevos del cliente con un archivo de Meta para bajar (`descargarMedios`). */
export type ResultadoRegistro = { aplicados: number; duplicados: number; ignorados: number; fallidos: number; paraElBot: string[]; medios: string[] };

type Db = Prisma.TransactionClient;

/** Estados desde los que se puede avanzar a cada uno: uno posterior no se pisa con uno anterior que llega tarde. */
const ESTADOS_PREVIOS: Record<string, string[]> = {
  ENVIADO: ["PENDIENTE", "SIMULADO"],
  ENTREGADO: ["PENDIENTE", "SIMULADO", "ENVIADO"],
  LEIDO: ["PENDIENTE", "SIMULADO", "ENVIADO", "ENTREGADO"],
};

const esChoqueDeUnico = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

/**
 * Cliente del workspace con ese teléfono (§4). Se vincula sólo si hay EXACTAMENTE uno; con varios
 * o ninguno devuelve `null` y el panel ofrece vincular a mano.
 */
export async function clienteDelTelefono(workspaceId: string, waId: string, db: Pick<Db, "$queryRaw"> = prisma): Promise<string | null> {
  // Prefiltro en la base por los últimos 6 dígitos (no traer todo el padrón); confirma `mismoTelefono`.
  const fin = ultimos6(waId);
  if (!fin) return null;
  const fichas = await db.$queryRaw<{ id: string; phone: string | null }[]>`
    -- clientes-por-telefono
    SELECT "id", "phone" FROM "Client"
    WHERE "workspaceId" = ${workspaceId}
      AND "phone" IS NOT NULL
      AND right(regexp_replace("phone", '[^0-9]', '', 'g'), 6) = ${fin}`;
  const coinciden = fichas.filter((f) => mismoTelefono(waId, f.phone));
  return coinciden.length === 1 ? coinciden[0].id : null;
}

/**
 * Aplica los eventos en orden. Cada evento se aísla: si uno falla por un error inesperado se lo
 * cuenta en `fallidos` (y se loguea índice y tipo, nada personal) y el resto del lote sigue. Quien
 * llama debe responder 500 si hay fallidos: Meta reintenta y lo ya aplicado es idempotente.
 */
export async function aplicarEventos(
  eventos: EventoWa[],
  ahora: Date = new Date(),
  /** `workspaceId`: sólo para el simulador de Configuración. Resuelve la conexión por institución en vez de por `phoneNumberId`. */
  opciones: { workspaceId?: string } = {},
): Promise<ResultadoRegistro> {
  const r: ResultadoRegistro = { aplicados: 0, duplicados: 0, ignorados: 0, fallidos: 0, paraElBot: [], medios: [] };
  const conexiones = new Map<string, { workspaceId: string; pausaBotHoras: number } | null>();
  /** Un aviso de estado sin mensaje conocido más nuevo que esto se cuenta como fallido, para que Meta reintente. */
  const REINTENTO_ESTADO_MS = 5 * 60_000;

  for (const [indice, ev] of eventos.entries()) {
    try {
      // En Instagram `phoneNumberId` lleva el id de la cuenta: la clave lleva el canal para no
      // confundirlo con un número de WhatsApp con los mismos dígitos.
      const instagram = ev.canal === "INSTAGRAM";
      const clave = opciones.workspaceId ?? `${instagram ? "ig" : "wa"}:${ev.phoneNumberId}`;
      let conexion = conexiones.get(clave);
      if (conexion === undefined) {
        const c = await prisma.fotofficeWaConexion.findUnique({
          where: opciones.workspaceId
            ? { workspaceId: opciones.workspaceId }
            : instagram
              ? { igAccountId: ev.phoneNumberId }
              : { phoneNumberId: ev.phoneNumberId },
          select: { workspaceId: true, pausaBotHoras: true, modo: true, igActivo: true },
        });
        // Por `phoneNumberId` (o `igAccountId`) sólo cuentan las conexiones REALES: una simulada no
        // puede reclamar un número ni una cuenta ajenos. Instagram, además, tiene que estar encendido.
        const vale = c && (opciones.workspaceId || (c.modo === "REAL" && (!instagram || c.igActivo)));
        conexion = c && vale ? { workspaceId: c.workspaceId, pausaBotHoras: c.pausaBotHoras ?? PAUSA_BOT_HORAS_POR_DEFECTO } : null;
        conexiones.set(clave, conexion);
      }
      if (!conexion) {
        r.ignorados++;
        continue;
      }
      if (ev.tipo === "ESTADO") {
        const salida = await aplicarEstado(conexion.workspaceId, ev);
        if (salida === "aplicado") r.aplicados++;
        else if (salida === "desconocido" && reintentable(ev.en, ahora, REINTENTO_ESTADO_MS)) r.fallidos++;
        else r.ignorados++;
        continue;
      }
      const salida = await registrarMensaje(conexion.workspaceId, conexion.pausaBotHoras, ev, ahora);
      if (salida === "duplicado") r.duplicados++;
      else {
        r.aplicados++;
        if (salida.paraElBot && !r.paraElBot.includes(salida.paraElBot)) r.paraElBot.push(salida.paraElBot);
        if (salida.mensajeConMedio) r.medios.push(salida.mensajeConMedio);
      }
    } catch (error) {
      r.fallidos++;
      const canalDelLog = ev.canal === "INSTAGRAM" ? "instagram" : "whatsapp";
      console.error(`[fotoffice][${canalDelLog}] falló un evento del lote`, { indice, tipo: ev.tipo, ...detalleDeError(error) });
    }
  }
  return r;
}

/** Se reintenta sólo si la hora es legible, no está más de 1 minuto en el futuro y tiene menos de `maxMs`. */
function reintentable(en: Date | null, ahora: Date, maxMs: number): boolean {
  const edad = en ? ahora.getTime() - en.getTime() : null;
  return edad !== null && edad >= -60_000 && edad < maxMs;
}

/** Del error, sólo el nombre y el código de Prisma: el mensaje puede traer textos o teléfonos. */
export function detalleDeError(error: unknown): { error: string; codigo?: string } {
  const codigo = (error as { code?: unknown } | null)?.code;
  return {
    error: error instanceof Error ? error.name : "desconocido",
    ...(typeof codigo === "string" ? { codigo } : {}),
  };
}

async function registrarMensaje(
  workspaceId: string,
  pausaBotHoras: number,
  ev: EventoEntrante | EventoEco,
  ahora: Date,
): Promise<Escrito | "duplicado"> {
  const existe = () =>
    prisma.fotofficeWaMensaje.findUnique({ where: { workspaceId_waMessageId: { workspaceId, waMessageId: ev.waMessageId } }, select: { id: true } });
  if (await existe()) return "duplicado";

  const canal: Canal = ev.canal ?? "WHATSAPP";
  let perfil: PerfilInstagram | null = null;
  if (canal === "INSTAGRAM") {
    // Instagram avisa también lo que manda el bot (WhatsApp no): ese eco no es "el estudio contestó desde el celular".
    if (ev.tipo === "ECO" && (await ecoPropioDeInstagram(workspaceId, ev, ahora))) return "duplicado";
    // El perfil se pide afuera de la transacción (es una llamada a Meta) y sólo para un chat nuevo.
    const yaEsta = await prisma.fotofficeWaChat.findUnique({
      where: { workspaceId_canal_waId: { workspaceId, canal, waId: ev.waId } },
      select: { id: true },
    });
    if (!yaEsta) perfil = await perfilInstagram(workspaceId, ev.waId).catch(() => null);
  }

  // Dos intentos: el choque de único puede ser el mensaje (reintento simultáneo de Meta: ya está,
  // no se reaplica nada) o la creación simultánea del chat (la segunda vuelta ya lo encuentra).
  for (let intento = 0; ; intento++) {
    try {
      return await prisma.$transaction((tx) => escribir(tx, workspaceId, pausaBotHoras, ev, ahora, canal, perfil));
    } catch (e) {
      if (!esChoqueDeUnico(e)) throw e;
      if (await existe()) return "duplicado";
      if (intento >= 1) throw e;
    }
  }
}

/**
 * ¿El eco de Instagram es de un mensaje nuestro (bot o panel)? Lo es si hay una respuesta saliente
 * reciente del chat sin `mid` todavía (el envío no lo guardó aún) con el mismo texto: entonces se le
 * asigna el `mid` del eco. Una respuesta de más de 1000 bytes sale partida (`partirPorBytes`) y
 * vuelve un eco por parte: también es propio el eco igual a una de sus partes, aunque la fila ya
 * tenga `mid` (lo pudo poner el eco de otra parte); el `mid` se asigna sólo si sigue vacío.
 * También si lo mandó nuestra app de Meta (`app_id` = `META_APP_ID` de `coexistencia.ts`).
 */
async function ecoPropioDeInstagram(workspaceId: string, ev: EventoEco, ahora: Date): Promise<boolean> {
  const chat = ev.texto
    ? await prisma.fotofficeWaChat.findUnique({
        where: { workspaceId_canal_waId: { workspaceId, canal: "INSTAGRAM", waId: ev.waId } },
        select: { id: true },
      })
    : null;
  if (chat && ev.texto) {
    const candidatos = await prisma.fotofficeWaMensaje.findMany({
      where: {
        chatId: chat.id,
        direccion: "SALIENTE",
        estadoEnvio: { in: ["PENDIENTE", "ENVIADO"] },
        createdAt: { gte: new Date(ahora.getTime() - MINUTOS_PENDIENTE_INCIERTO * 60_000) },
      },
      select: { id: true, texto: true, waMessageId: true },
      orderBy: { createdAt: "asc" },
    });
    // Se compara sin espacios en los bordes: las partes salen recortadas y Meta puede recortar el eco.
    const texto = ev.texto.trim();
    const propio =
      candidatos.find((m) => m.waMessageId === null && mismoTextoSeguro((m.texto ?? "").trim(), texto)) ??
      candidatos.find((m) => {
        const partes = partirPorBytes(m.texto ?? "");
        return partes.length > 1 && partes.some((p) => mismoTextoSeguro(p.trim(), texto));
      });
    if (propio) {
      // Si el envío (o el eco de otra parte) ya guardó un `mid`, queda ése (el `where` lo exige nulo).
      if (propio.waMessageId === null) {
        try {
          await prisma.fotofficeWaMensaje.updateMany({ where: { id: propio.id, waMessageId: null }, data: { waMessageId: ev.waMessageId } });
        } catch (e) {
          if (!esChoqueDeUnico(e)) throw e;
        }
      }
      return true;
    }
  }
  return Boolean(ev.media?.appId && ev.media.appId === META_APP_ID.trim());
}

/** `paraElBot`: el chat, si entró un mensaje del cliente y lo atiende el bot. `mensajeConMedio`: el mensaje, si el cliente mandó un archivo. */
type Escrito = { paraElBot: string | null; mensajeConMedio: string | null };

async function escribir(
  tx: Db,
  workspaceId: string,
  pausaBotHoras: number,
  ev: EventoEntrante | EventoEco,
  ahora: Date,
  canal: Canal,
  /** Instagram: perfil de quien escribe, ya pedido (sólo si el chat no existía). */
  perfil: PerfilInstagram | null,
): Promise<Escrito> {
  // La hora del hecho, sin pasar de la de recepción (un reloj adelantado no debe fijar una pausa eterna).
  const cuando = ev.en && ev.en.getTime() < ahora.getTime() ? ev.en : ahora;
  const entrante = ev.tipo === "ENTRANTE";

  const clave = { workspaceId_canal_waId: { workspaceId, canal, waId: ev.waId } };
  // En Instagram el `waId` es un IGSID, no un teléfono: nunca se busca un cliente por él.
  const buscaCliente = canal === "WHATSAPP";
  let chat = await tx.fotofficeWaChat.findUnique({ where: clave });
  /** Cliente ya buscado al crear el chat: no se busca de nuevo en el mismo evento. */
  let clienteBuscado: { id: string | null } | null = null;
  if (chat) {
    // Candado de fila: un "Tomar" simultáneo del panel espera a que terminemos (o lo esperamos), y
    // volvemos a leer el chat ya con sus cambios antes de calcular el parche de las reglas.
    await tx.$executeRaw`SELECT 1 FROM "FotofficeWaChat" WHERE id = ${chat.id} FOR UPDATE`;
    chat = (await tx.fotofficeWaChat.findUnique({ where: clave })) ?? chat;
  } else {
    clienteBuscado = { id: buscaCliente ? await clienteDelTelefono(workspaceId, ev.waId, tx) : null };
    const nombre = canal === "INSTAGRAM"
      ? (perfil?.nombre ?? (perfil?.usuario ? `@${perfil.usuario}` : null))
      : entrante ? ev.nombre : null;
    chat = await tx.fotofficeWaChat.create({
      data: {
        workspaceId, canal, waId: ev.waId, nombre, ultimoMensajeEn: cuando, ...vistaPreviaDe(ev.texto, ev.mensajeTipo),
        clientId: clienteBuscado.id,
        ...(canal === "INSTAGRAM" ? { usuarioInstagram: perfil?.usuario ?? null } : {}),
      },
    });
  }

  const creado = await tx.fotofficeWaMensaje.create({
    data: {
      workspaceId, chatId: chat.id, waMessageId: ev.waMessageId, createdAt: cuando,
      direccion: entrante ? "ENTRANTE" : "SALIENTE",
      autor: entrante ? "CLIENTE" : "CELULAR",
      estadoEnvio: entrante ? "RECIBIDO" : "ENVIADO",
      tipo: ev.mensajeTipo, texto: ev.texto,
      ...(ev.media ? { media: ev.media as Prisma.InputJsonObject } : {}),
    },
  });

  const estado: EstadoChat = {
    estado: chat.estado as EstadoChat["estado"],
    asignadoUserId: chat.asignadoUserId,
    botPausadoHasta: chat.botPausadoHasta,
    ultimoEntranteEn: chat.ultimoEntranteEn,
  };
  const regla: ResultadoRegla = entrante ? alEntrante(estado, cuando) : alEco(estado, cuando, ev.texto, pausaBotHoras);

  const parche: ParcheChat & Record<string, unknown> = { ...regla.parche };
  // `noLeidos` se suma en la base (increment), no se lee-y-escribe.
  // Un mensaje viejo (reintento tardío) no retrocede las horas del chat.
  if (parche.ultimoEntranteEn && chat.ultimoEntranteEn && chat.ultimoEntranteEn.getTime() > parche.ultimoEntranteEn.getTime()) {
    parche.ultimoEntranteEn = chat.ultimoEntranteEn;
  }
  if (cuando.getTime() > chat.ultimoMensajeEn.getTime()) {
    parche.ultimoMensajeEn = cuando;
    Object.assign(parche, vistaPreviaDe(ev.texto, ev.mensajeTipo));
  }
  if (entrante) {
    parche.noLeidos = { increment: 1 };
    if (ev.nombre && ev.nombre !== chat.nombre) parche.nombre = ev.nombre;
  }
  if (buscaCliente && !chat.clientId && !clienteBuscado) {
    const clientId = await clienteDelTelefono(workspaceId, ev.waId, tx);
    if (clientId) parche.clientId = clientId;
  }
  await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: parche });

  if (regla.sistema) {
    await tx.fotofficeWaMensaje.create({
      data: {
        workspaceId, chatId: chat.id, direccion: "SISTEMA", autor: "SISTEMA", tipo: "TEXTO",
        texto: regla.sistema.texto, createdAt: new Date(cuando.getTime() + 1),
      },
    });
  }
  return {
    paraElBot: entrante && atiendeElBot({ ...estado, ...regla.parche }, ahora) ? chat.id : null,
    // WhatsApp trae el id del archivo en Meta; Instagram, su dirección.
    mensajeConMedio: entrante && (ev.media?.id || ev.media?.url) ? creado.id : null,
  };
}

/**
 * Estado de envío de un mensaje nuestro. "desconocido" si no lo conocemos (quien llama decide si
 * reintentar); "ignorado" si no avanza. El
 * `where` del `updateMany` exige que el estado actual sea de rango menor: dos avisos simultáneos
 * (entregado y leído) no pueden retroceder el resultado. FALLO es terminal y sólo vale antes de la entrega.
 */
async function aplicarEstado(workspaceId: string, ev: EventoEstado): Promise<"aplicado" | "ignorado" | "desconocido"> {
  const m = await prisma.fotofficeWaMensaje.findUnique({
    where: { workspaceId_waMessageId: { workspaceId, waMessageId: ev.waMessageId } },
    select: { id: true, direccion: true },
  });
  if (!m) {
    // Aviso de estado sin mensaje: puede ser que el envío no haya guardado todavía su waMessageId.
    console.warn("[fotoffice][whatsapp] estado de un mensaje desconocido", { estado: ev.estado, codigo: ev.errorCodigo });
    return "desconocido";
  }
  if (m.direccion !== "SALIENTE") return "ignorado";
  const previos = (ev.estado === "FALLO" ? ["PENDIENTE", "SIMULADO", "ENVIADO"] : ESTADOS_PREVIOS[ev.estado]) as string[];
  const r = await prisma.fotofficeWaMensaje.updateMany({
    where: { id: m.id, estadoEnvio: { in: previos } },
    data: { estadoEnvio: ev.estado, errorCodigo: ev.estado === "FALLO" ? ev.errorCodigo : null },
  });
  return r.count > 0 ? "aplicado" : "ignorado";
}
