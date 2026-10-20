import { marcarError, marcarLista, marcarPartesBorradas, marcarSinImagen, type PrismaCola } from "./cola";
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
  marcarSinImagen(id: string): Promise<void>;
  marcarError(id: string, mensaje: string): Promise<void>;
  marcarLista(id: string, d: { videoKey: string; videoBytes: number; videoDuracionSeg: number }): Promise<void>;
  marcarPartesBorradas(id: string): Promise<void>;
};

/** Repositorio sobre SQL crudo (las columnas de conversión pueden no estar en el cliente generado). */
export function crearRepo(db: PrismaCola): Repo {
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
    marcarSinImagen: (id) => marcarSinImagen(db, id),
    marcarError: (id, m) => marcarError(db, id, m),
    marcarLista: (id, d) => marcarLista(db, id, d),
    marcarPartesBorradas: (id) => marcarPartesBorradas(db, id),
  };
}
