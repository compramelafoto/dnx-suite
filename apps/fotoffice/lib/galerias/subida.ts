/**
 * Reglas del lado del navegador para subir fotos (módulo PURO, sin red ni DOM): qué archivos se
 * aceptan, cómo se corre una cola con un tope de subidas en paralelo y cómo se resume el avance.
 * Las mismas reglas las vuelve a aplicar el servidor (`pedirSubidaFoto`).
 */
import { MAX_FOTOS_POR_GALERIA, TAMANO_MAXIMO_ORIGINAL, type TipoFotoPermitido } from "./constantes";

/** Subidas simultáneas. */
export const SUBIDAS_EN_PARALELO = 4;

export const ERRORES_SUBIDA = {
  tipo: "Sólo se pueden subir fotos JPG o PNG.",
  tamano: "Pesa más de 50 MB.",
  vacio: "El archivo está vacío.",
  subida: "La subida no se completó.",
} as const;

/** Tipo de la foto por lo que informa el navegador o, si viene vacío, por la extensión. null si no es JPG ni PNG. */
export function tipoDeFoto(nombre: string, tipoDelNavegador: string): TipoFotoPermitido | null {
  const t = tipoDelNavegador.toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
  if (t === "image/png") return "image/png";
  if (t !== "") return null;
  const ext = nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return null;
}

/** Revisión previa de un archivo: el motivo si no se puede subir, o null. */
export function revisarFotoParaSubir(f: { name: string; type: string; size: number }): string | null {
  if (tipoDeFoto(f.name, f.type) === null) return ERRORES_SUBIDA.tipo;
  if (f.size <= 0) return ERRORES_SUBIDA.vacio;
  if (f.size > TAMANO_MAXIMO_ORIGINAL) return ERRORES_SUBIDA.tamano;
  return null;
}

export type Clasificados<T> = { aceptados: T[]; rechazados: { archivo: T; motivo: string }[]; sobrantes: number };

/** Separa los archivos que se pueden subir de los que no y recorta a los lugares que quedan en la galería. */
export function clasificarArchivos<T extends { name: string; type: string; size: number }>(archivos: readonly T[], lugaresLibres: number): Clasificados<T> {
  const aceptados: T[] = [];
  const rechazados: { archivo: T; motivo: string }[] = [];
  let sobrantes = 0;
  const libres = Math.max(0, Math.min(lugaresLibres, MAX_FOTOS_POR_GALERIA));
  for (const archivo of archivos) {
    const motivo = revisarFotoParaSubir(archivo);
    if (motivo) rechazados.push({ archivo, motivo });
    else if (aceptados.length >= libres) sobrantes++;
    else aceptados.push(archivo);
  }
  return { aceptados, rechazados, sobrantes };
}

/**
 * Cola de trabajos con un tope de simultáneos: se puede seguir agregando mientras corre. `trabajo` no
 * debe lanzar (informa sus fallas por su cuenta); si lo hace, se ignora y la cola sigue.
 */
export function crearCola<T>(limite: number, trabajo: (item: T) => Promise<void>) {
  const espera: T[] = [];
  let activos = 0;
  const tope = Math.max(1, limite);
  const bombear = () => {
    while (activos < tope && espera.length > 0) {
      const item = espera.shift() as T;
      activos++;
      void Promise.resolve()
        .then(() => trabajo(item))
        .catch(() => undefined)
        .finally(() => {
          activos--;
          bombear();
        });
    }
  };
  return {
    agregar(items: readonly T[]) {
      espera.push(...items);
      bombear();
    },
    activos: () => activos,
    pendientes: () => espera.length,
    /** Saca de la espera los que cumplen la condición (los activos siguen). */
    descartar(cuando: (item: T) => boolean) {
      for (let i = espera.length - 1; i >= 0; i--) if (cuando(espera[i])) espera.splice(i, 1);
    },
  };
}

export type EstadoSubida = "ESPERA" | "SUBIENDO" | "PROCESANDO" | "LISTA" | "ERROR";

export type ResumenSubida = { total: number; listas: number; conError: number; enCurso: number; enEspera: number; terminado: boolean };

export function resumirSubidas(estados: Iterable<EstadoSubida>): ResumenSubida {
  const r = { total: 0, listas: 0, conError: 0, enCurso: 0, enEspera: 0 };
  for (const e of estados) {
    r.total++;
    if (e === "LISTA") r.listas++;
    else if (e === "ERROR") r.conError++;
    else if (e === "ESPERA") r.enEspera++;
    else r.enCurso++;
  }
  return { ...r, terminado: r.enCurso === 0 && r.enEspera === 0 };
}

/** "3,2 MB" / "850 KB" para mostrar el peso de una foto. */
export function pesoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("es-AR")} KB`;
}
