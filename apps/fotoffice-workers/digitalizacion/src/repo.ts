import {
  estadoDeConversion,
  estadoHls,
  marcarError,
  marcarFalloHls,
  marcarHls,
  marcarLista,
  marcarPartesBorradas,
  marcarPartesBorradasSinImagen,
  marcarSinImagen,
  renovarLock,
  renovarLockRelleno,
  type PrismaCola,
} from "./cola";
import type { BrandingMarca } from "./marca";
import type { GrabacionParaPlan, ParteR2 } from "./plan";

export type DatosGrabacion = {
  id: string;
  workspaceId: string;
  intentos: number;
  grabacion: GrabacionParaPlan;
  partes: ParteR2[];
  branding: BrandingMarca;
};

export type Repo = {
  cargar(id: string): Promise<DatosGrabacion | null>;
  /** Todas devuelven las filas afectadas: 0 = el token de bloqueo ya no es nuestro. */
  marcarSinImagen(id: string, lock: Date): Promise<number>;
  marcarPartesBorradasSinImagen(id: string): Promise<number>;
  marcarError(id: string, lock: Date, mensaje: string): Promise<number>;
  marcarLista(id: string, lock: Date, d: { videoKey: string; videoBytes: number; videoDuracionSeg: number; hlsKey?: string | null }): Promise<number>;
  marcarPartesBorradas(id: string, videoKey: string): Promise<number>;
  renovarLock(id: string, viejo: Date, nuevo: Date): Promise<number>;
  estado(id: string): Promise<string | null>;
};

/** Lo que necesita el relleno de la versión para mirar (E10). */
export type RepoRelleno = {
  cargarRelleno(id: string): Promise<{ id: string; workspaceId: string; videoKey: string | null } | null>;
  renovarLockRelleno(id: string, viejo: Date, nuevo: Date): Promise<number>;
  marcarHls(id: string, lock: Date, hlsKey: string): Promise<number>;
  marcarFalloHls(id: string, lock: Date, mensaje: string): Promise<number>;
  estadoHls(id: string): Promise<string | null>;
};

/** Repositorio sobre SQL crudo (las columnas de conversión pueden no estar en el cliente generado). */
export function crearRepo(db: PrismaCola): Repo & RepoRelleno {
  return {
    async cargar(id) {
      const filas = await db.$queryRawUnsafe<
        {
          id: string;
          workspaceId: string;
          tipo: string;
          corregirProporcion: boolean;
          sinImagen: boolean;
          primeraImagenSeg: number | null;
          ultimaImagenSeg: number | null;
          ultimaImagenTramo: number | null;
          conversionIntentos: number;
        }[]
      >(
        `SELECT id, "workspaceId", tipo, "corregirProporcion", "sinImagen", "primeraImagenSeg", "ultimaImagenSeg", "ultimaImagenTramo", "conversionIntentos"
         FROM "DigitalizacionGrabacion" WHERE id=$1`,
        id,
      );
      const g = filas[0];
      if (!g) return null;
      const partes = await db.$queryRawUnsafe<ParteR2[]>(
        `SELECT tramo, indice, key FROM "DigitalizacionParte" WHERE "grabacionId"=$1 AND estado='LISTA' ORDER BY tramo, indice`,
        id,
      );
      const br = await db.$queryRawUnsafe<
        { nombre: string | null; commercialName: string | null; logoUrl: string | null; whatsapp: string | null }[]
      >(
        `SELECT w.name AS nombre, b."commercialName", b."logoUrl", b.whatsapp
         FROM "Workspace" w LEFT JOIN "FotofficeWorkspaceBranding" b ON b."workspaceId"=w.id WHERE w.id=$1`,
        g.workspaceId,
      );
      const b0 = br[0];
      return {
        id: g.id,
        workspaceId: g.workspaceId,
        intentos: Number(g.conversionIntentos),
        grabacion: {
          tipo: g.tipo,
          corregirProporcion: g.corregirProporcion,
          sinImagen: g.sinImagen,
          primeraImagenSeg: g.primeraImagenSeg,
          ultimaImagenSeg: g.ultimaImagenSeg,
          ultimaImagenTramo: g.ultimaImagenTramo,
        },
        partes: partes.map((p) => ({ tramo: Number(p.tramo), indice: Number(p.indice), key: p.key })),
        branding: {
          commercialName: b0?.commercialName?.trim() || b0?.nombre?.trim() || "",
          logoUrl: b0?.logoUrl ?? null,
          whatsapp: b0?.whatsapp ?? null,
        },
      };
    },
    marcarSinImagen: (id, lock) => marcarSinImagen(db, id, lock),
    marcarPartesBorradasSinImagen: (id) => marcarPartesBorradasSinImagen(db, id),
    marcarError: (id, lock, m) => marcarError(db, id, lock, m),
    marcarLista: (id, lock, d) => marcarLista(db, id, lock, d),
    marcarPartesBorradas: (id, key) => marcarPartesBorradas(db, id, key),
    renovarLock: (id, viejo, nuevo) => renovarLock(db, id, viejo, nuevo),
    estado: (id) => estadoDeConversion(db, id),
    async cargarRelleno(id) {
      const f = await db.$queryRawUnsafe<{ id: string; workspaceId: string; videoKey: string | null }[]>(
        `SELECT id, "workspaceId", "videoKey" FROM "DigitalizacionGrabacion" WHERE id=$1`,
        id,
      );
      return f[0] ?? null;
    },
    renovarLockRelleno: (id, viejo, nuevo) => renovarLockRelleno(db, id, viejo, nuevo),
    marcarHls: (id, lock, k) => marcarHls(db, id, lock, k),
    marcarFalloHls: (id, lock, m) => marcarFalloHls(db, id, lock, m),
    estadoHls: (id) => estadoHls(db, id),
  };
}
