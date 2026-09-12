import "server-only";
import { prisma } from "@repo/db";
import { calcularVentana } from "./ventana-evento";
import { generarCodigoEvento, generarCodigoPantalla } from "./codigos";

/**
 * Alta de un evento (capítulo 7 del documento maestro).
 *
 * El evento nace en CONFIGURING. La activación pública es otra cosa y sucede después:
 * un evento puede estar pagado y configurándose durante días antes de abrir su ventana.
 */

export type DatosEvento = {
  sellerProfileId: string;
  nombre: string;
  tipo: string;
  fechaHoraLocal: string;
  zonaHoraria: string;
  lugar?: string;
};

export type ResultadoAlta =
  | { ok: true; eventoId: string; codigo: string; cierraEl: { fecha: string; hora: string } }
  | { ok: false; error: string };

const REINTENTOS_POR_COLISION = 5;

export async function crearEvento(datos: DatosEvento): Promise<ResultadoAlta> {
  const nombre = datos.nombre.trim();
  if (nombre.length < 3) {
    return { ok: false, error: "El evento necesita un nombre de al menos 3 letras." };
  }

  let ventana;
  try {
    ventana = calcularVentana({
      fechaHoraLocal: datos.fechaHoraLocal,
      zonaHoraria: datos.zonaHoraria,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "La fecha no es válida." };
  }

  // Los códigos son aleatorios y únicos en la base. La probabilidad de choque es mínima,
  // pero si ocurre no puede romperle el alta a nadie: se reintenta con otro.
  for (let intento = 1; intento <= REINTENTOS_POR_COLISION; intento++) {
    const codigo = generarCodigoEvento();
    const codigoPantalla = generarCodigoPantalla();

    try {
      const evento = await prisma.subilafotoEvent.create({
        data: {
          sellerProfileId: datos.sellerProfileId,
          code: codigo,
          screenCode: codigoPantalla,
          name: nombre,
          eventType: datos.tipo as never,
          venueName: datos.lugar?.trim() || null,
          timezone: datos.zonaHoraria,
          activationAt: ventana.activacionUtc,
          // Se guarda calculado, no se recalcula al leer: el horario de verano haría que
          // el mismo evento cerrara a horas distintas según cuándo se consulte.
          deactivationAt: ventana.desactivacionUtc,
          status: "CONFIGURING",
        },
        select: { id: true, code: true },
      });

      return {
        ok: true,
        eventoId: evento.id,
        codigo: evento.code,
        cierraEl: {
          fecha: ventana.desactivacionLocal.fecha,
          hora: ventana.desactivacionLocal.hora,
        },
      };
    } catch (e) {
      const codigoError = (e as { code?: string }).code;
      // P2002 = choque de índice único. Cualquier otra cosa es un problema real.
      if (codigoError !== "P2002" || intento === REINTENTOS_POR_COLISION) {
        console.error("[subilafoto] no se pudo crear el evento", e);
        return { ok: false, error: "No pudimos crear el evento. Probá de nuevo." };
      }
    }
  }

  return { ok: false, error: "No pudimos generar un código libre. Probá de nuevo." };
}
