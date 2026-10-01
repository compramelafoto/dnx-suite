import { prisma } from "@repo/db";
import { codificarCursor, condicionDesdeCursor, parsearCursor, type Cursor } from "@/lib/vivo";
import { DURACION, SELECT_DE_VARIANTES, enlaceParaMirar } from "@/lib/moderacion/vista";
import { varianteParaMirar } from "@/lib/variantes/medidas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Las fotos nuevas de un evento, en vivo.
 *
 * Server-Sent Events y no WebSocket: acá el tráfico va en una sola dirección
 * —el servidor avisa, la pantalla escucha— y SSE reconecta solo. Con WebSocket
 * habría que escribir la reconexión a mano y sostener un servidor con estado.
 *
 * **Por qué se corta sola a los cuatro minutos:** la función tiene un tope de
 * cinco. En vez de que la mate el tiempo a mitad de un mensaje, se cierra
 * ordenada y el navegador reconecta con `Last-Event-ID`. Un corte prolijo cada
 * cuatro minutos es invisible; uno abrupto pierde fotos.
 */

/*
  Un segundo y no dos: el criterio del backlog es que ocultar una foto la saque
  de la pantalla en **menos de dos segundos**, y ese presupuesto incluye la
  consulta, la red y el repintado. Con dos segundos de espera ya no entraba.
*/
const CADA_CUANTO_SE_MIRA_MS = 1_000;
const DURACION_DE_LA_CONEXION_MS = 240_000;
const LATIDO_CADA_MS = 20_000;
/** Cada tanto se manda la lista completa de lo vigente, por si se perdió un aviso. */
const RECONCILIAR_CADA_MS = 30_000;

export async function GET(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo.toUpperCase() },
    select: { id: true, status: true },
  });
  if (!evento) return new Response("No existe", { status: 404 });

  let cursor: Cursor | null = parsearCursor(
    req.headers.get("last-event-id") ?? new URL(req.url).searchParams.get("desde"),
  );

  const codificador = new TextEncoder();
  const arranque = Date.now();

  const flujo = new ReadableStream({
    async start(control) {
      let vivo = true;
      const cerrar = () => {
        if (!vivo) return;
        vivo = false;
        try {
          control.close();
        } catch {
          // Ya estaba cerrado: la pantalla se fue antes.
        }
      };

      // Si el navegador se va, no tiene sentido seguir consultando la base.
      req.signal.addEventListener("abort", cerrar);

      const mandar = (texto: string) => {
        if (!vivo) return;
        try {
          control.enqueue(codificador.encode(texto));
        } catch {
          cerrar();
        }
      };

      // Le dice al navegador que espere 3 segundos antes de reconectar.
      mandar("retry: 3000\n\n");

      let ultimoLatido = Date.now();
      let ultimaReconciliacion = 0;
      // Los cambios se miran por `updatedAt`: ocultar, bloquear y borrar lo tocan.
      let desdeCambios = new Date(Date.now() - 60_000);

      while (vivo && Date.now() - arranque < DURACION_DE_LA_CONEXION_MS) {
        const nuevas = await prisma.subilafotoMedia.findMany({
          where: { ...condicionDesdeCursor(evento.id, cursor), kind: "PHOTO" },
          orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
          take: 20,
          select: {
            id: true,
            caption: true,
            guestName: true,
            publishedAt: true,
            variants: SELECT_DE_VARIANTES,
          },
        });

        for (const foto of nuevas) {
          const clave = varianteParaMirar(foto.variants, "pantalla");

          /*
            El cursor avanza aunque la foto se saltee. Cuando una foto se publica su
            variante ya existe —se genera antes de decidir—, así que llegar acá sin
            variante significa que la generación falló y no va a aparecer sola. Frenar el
            cursor en ella dejaría la pantalla clavada para siempre en una foto que nunca
            se va a poder mostrar.
          */
          cursor = { publishedAt: foto.publishedAt!, id: foto.id };
          if (!clave) continue;

          const url = await enlaceParaMirar(clave, DURACION.proyeccion);

          // El `id:` es lo que el navegador devuelve al reconectar.
          mandar(
            `id: ${codificarCursor(cursor)}\n` +
              `event: foto\n` +
              `data: ${JSON.stringify({
                id: foto.id,
                url,
                pie: foto.caption,
                nombre: foto.guestName,
              })}\n\n`,
          );
          ultimoLatido = Date.now();
        }

        /*
          Las bajas. Se miran aparte de las altas porque no comparten cursor:
          las altas se reanudan con el `Last-Event-ID` y las bajas no tienen
          por qué reenviarse — para eso está la reconciliación de más abajo.
        */
        const dadasDeBaja = await prisma.subilafotoMedia.findMany({
          where: {
            eventId: evento.id,
            updatedAt: { gt: desdeCambios },
            OR: [{ status: { not: "APPROVED" } }, { publishedAt: null }],
          },
          select: { id: true, updatedAt: true },
        });

        for (const foto of dadasDeBaja) {
          mandar(`event: quitar\ndata: ${JSON.stringify({ id: foto.id })}\n\n`);
          if (foto.updatedAt > desdeCambios) desdeCambios = foto.updatedAt;
          ultimoLatido = Date.now();
        }

        /*
          La red de seguridad: cada treinta segundos, la lista completa de lo
          que está vigente. Un aviso de baja se puede perder en un corte; esto
          corrige la diferencia sin que nadie se dé cuenta. Sin esto, una foto
          ocultada mientras la pantalla estuvo unos segundos desconectada se
          queda proyectada toda la noche.
        */
        if (Date.now() - ultimaReconciliacion > RECONCILIAR_CADA_MS) {
          const vigentes = await prisma.subilafotoMedia.findMany({
            where: { ...condicionDesdeCursor(evento.id, null), kind: "PHOTO" },
            orderBy: [{ publishedAt: "desc" }],
            take: 200,
            select: { id: true },
          });
          mandar(
            `event: vigentes\ndata: ${JSON.stringify({ ids: vigentes.map((v) => v.id) })}\n\n`,
          );
          ultimaReconciliacion = Date.now();
          ultimoLatido = Date.now();
        }

        // Un comentario cada tanto para que ningún proxy dé la conexión por
        // muerta cuando la fiesta está tranquila.
        if (Date.now() - ultimoLatido > LATIDO_CADA_MS) {
          mandar(": sigo acá\n\n");
          ultimoLatido = Date.now();
        }

        await new Promise((r) => setTimeout(r, CADA_CUANTO_SE_MIRA_MS));
      }

      cerrar();
    },
  });

  return new Response(flujo, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Sin esto, algunos proxies acumulan la respuesta y no llega nada hasta el final.
      "X-Accel-Buffering": "no",
    },
  });
}
