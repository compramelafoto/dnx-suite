import type { PilotoConfig } from "../split-1n-piloto/config";
import {
  evaluarElegibilidadPiloto,
  type ElegibilidadInput,
  type ReceptoresPiloto,
} from "../split-1n-piloto/elegibilidad";
import { eventoHabilitado, type CarritoConfig } from "./config";

/** Un álbum del carrito con lo que necesita la elegibilidad del piloto. */
export type AlbumDelCarrito = Omit<ElegibilidadInput, "config"> & {
  eventId: number | null;
  /** Autor de cada foto elegida (`Photo.userId`); null si la subió el dueño del álbum. */
  autoresDeFotos: Array<number | null>;
};

export type MotivoGrupo = { albumId: number | null; motivo: string };

export type ElegibilidadGrupo =
  | { ok: true; receivers: Map<number, ReceptoresPiloto>; receptores: number }
  | { ok: false; motivos: MotivoGrupo[] };

/** Cuentas distintas que cobran, más la plataforma. */
export function contarReceptores(receivers: Iterable<ReceptoresPiloto>): number {
  const cuentas = new Set<string>();
  for (const r of receivers) {
    for (const c of [r.fotografo, r.referidor, r.organizador, r.referidorOrganizador]) {
      if (c != null) cuentas.add(c);
    }
  }
  return cuentas.size + 1;
}

/**
 * ¿El carrito se cobra en un solo pago? Todo o nada (D3): si un solo álbum no puede, ninguno va
 * por el split y el comprador paga cada álbum por separado con el cobro de siempre.
 *
 * Cada álbum se mira con `evaluarElegibilidadPiloto`, las mismas reglas que un álbum del piloto;
 * lo único distinto es que el permiso no sale de la lista de álbumes del piloto sino del evento.
 * El conteo de receptores es aproximado por exceso (cuenta roles con monto cero): el número
 * exacto lo vuelve a controlar `prepararCobroGrupo` antes de cobrar.
 */
export function evaluarElegibilidadGrupo(params: {
  piloto: PilotoConfig;
  carrito: CarritoConfig;
  eventId: number;
  albumes: AlbumDelCarrito[];
}): ElegibilidadGrupo {
  const { piloto, carrito, eventId } = params;
  if (!carrito.enabled || !piloto.enabled || !eventoHabilitado(carrito, eventId)) {
    return { ok: false, motivos: [{ albumId: null, motivo: "carrito_apagado" }] };
  }
  if (params.albumes.length === 0) return { ok: false, motivos: [{ albumId: null, motivo: "carrito_vacio" }] };

  const motivos: MotivoGrupo[] = [];
  const receivers = new Map<number, ReceptoresPiloto>();
  for (const { eventId: albumEventId, autoresDeFotos, ...album } of params.albumes) {
    if (albumEventId !== eventId) {
      motivos.push({ albumId: album.albumId, motivo: "album_de_otro_evento" });
      continue;
    }
    // Nadie cobra fotos de otro: el split le paga al dueño del álbum.
    if (autoresDeFotos.some((autor) => autor != null && autor !== album.photographerUserId)) {
      motivos.push({ albumId: album.albumId, motivo: "album_con_varios_autores" });
      continue;
    }
    const r = evaluarElegibilidadPiloto({
      ...album,
      config: { ...piloto, albumIds: new Set([album.albumId]) },
    });
    if (!r.ok) motivos.push({ albumId: album.albumId, motivo: r.motivo });
    else receivers.set(album.albumId, r.receivers);
  }
  if (motivos.length > 0) return { ok: false, motivos };

  const receptores = contarReceptores(receivers.values());
  if (receptores > carrito.maxReceptores) {
    return { ok: false, motivos: [{ albumId: null, motivo: "demasiados_receptores" }] };
  }
  return { ok: true, receivers, receptores };
}
