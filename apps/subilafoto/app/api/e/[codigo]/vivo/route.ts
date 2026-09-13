import { prisma } from "@repo/db";
import { codificarCursor, condicionDesdeCursor, parsearCursor, type Cursor } from "@/lib/vivo";
import { DURACION, enlaceParaMirar } from "@/lib/moderacion/vista";

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

const CADA_CUANTO_SE_MIRA_MS = 2_000;
const DURACION_DE_LA_CONEXION_MS = 240_000;
const LATIDO_CADA_MS = 20_000;

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

      while (vivo && Date.now() - arranque < DURACION_DE_LA_CONEXION_MS) {
        const nuevas = await prisma.subilafotoMedia.findMany({
          where: { ...condicionDesdeCursor(evento.id, cursor), kind: "PHOTO" },
          orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
          take: 20,
          select: { id: true, originalKey: true, caption: true, guestName: true, publishedAt: true },
        });

        for (const foto of nuevas) {
          const url = await enlaceParaMirar(foto.originalKey, DURACION.proyeccion);
          cursor = { publishedAt: foto.publishedAt!, id: foto.id };

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
