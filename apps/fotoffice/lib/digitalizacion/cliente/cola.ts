/**
 * Cola de subida de pedacitos: los guarda antes de intentar (sobreviven a un corte de red o a
 * recargar), sube de a 2 y reintenta con espera creciente mientras la página esté abierta.
 * El almacén y la subida se inyectan: los tests usan memoria; la estación, IndexedDB.
 */

export type ParteEnCola = { id: string; grabacionId: string; tramo: number; indice: number; datos: Blob };

export interface AlmacenCola {
  guardar(p: ParteEnCola): Promise<void>;
  borrar(id: string): Promise<void>;
  pendientes(): Promise<ParteEnCola[]>;
}

export type ResumenCola = { pendientes: number; bytesPendientes: number; ultimoError: string | null; descartadas: number };

/** El servidor dijo que no tiene sentido reintentar (grabación cerrada, ajena o descartada). */
export class ErrorDefinitivo extends Error {}

export function idParte(grabacionId: string, tramo: number, indice: number): string {
  return `${grabacionId}:${tramo}:${String(indice).padStart(6, "0")}`;
}

export function esperaReintento(intento: number): number {
  return Math.min(60_000, 2000 * 2 ** intento);
}

export function almacenEnMemoria(): AlmacenCola {
  const m = new Map<string, ParteEnCola>();
  return {
    async guardar(p) { m.set(p.id, p); },
    async borrar(id) { m.delete(id); },
    async pendientes() { return [...m.values()]; },
  };
}

type Opciones = {
  concurrencia?: number;
  dormir?: (ms: number) => Promise<void>;
  alCambiar?: (r: ResumenCola) => void;
};

export class ColaDeSubida {
  private readonly esperando: ParteEnCola[] = [];
  private readonly enCurso = new Map<string, number>();
  private readonly conocidas = new Set<string>();
  private ultimoError: string | null = null;
  private descartadas = 0;
  private avisosVacia: (() => void)[] = [];
  private readonly concurrencia: number;
  private readonly dormir: (ms: number) => Promise<void>;

  constructor(
    private readonly almacen: AlmacenCola,
    private readonly subir: (p: ParteEnCola) => Promise<void>,
    private readonly opciones: Opciones = {},
  ) {
    this.concurrencia = opciones.concurrencia ?? 2;
    this.dormir = opciones.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async agregar(p: ParteEnCola): Promise<void> {
    await this.almacen.guardar(p);
    this.encolar([p]);
  }

  /** Lo que quedó guardado de una sesión anterior, en orden de grabación. */
  async reanudar(): Promise<void> {
    const guardadas = (await this.almacen.pendientes()).sort((a, b) => {
      if (a.grabacionId !== b.grabacionId) return a.grabacionId < b.grabacionId ? -1 : 1;
      if (a.tramo !== b.tramo) return a.tramo - b.tramo;
      return a.indice - b.indice;
    });
    this.encolar(guardadas);
  }

  resumen(): ResumenCola {
    const bytes = this.esperando.reduce((s, p) => s + p.datos.size, 0) + [...this.enCurso.values()].reduce((s, n) => s + n, 0);
    return { pendientes: this.esperando.length + this.enCurso.size, bytesPendientes: bytes, ultimoError: this.ultimoError, descartadas: this.descartadas };
  }

  vaciada(): Promise<void> {
    if (this.esperando.length === 0 && this.enCurso.size === 0) return Promise.resolve();
    return new Promise((r) => this.avisosVacia.push(r));
  }

  private encolar(ps: ParteEnCola[]) {
    for (const p of ps) {
      if (this.conocidas.has(p.id)) continue;
      this.conocidas.add(p.id);
      this.esperando.push(p);
    }
    this.avisar();
    this.bombear();
  }

  private bombear() {
    while (this.enCurso.size < this.concurrencia && this.esperando.length > 0) {
      const p = this.esperando.shift()!;
      this.enCurso.set(p.id, p.datos.size);
      void this.procesar(p);
    }
    if (this.esperando.length === 0 && this.enCurso.size === 0) {
      const avisos = this.avisosVacia;
      this.avisosVacia = [];
      avisos.forEach((r) => r());
    }
  }

  private async procesar(p: ParteEnCola) {
    try {
      for (let intento = 0; ; intento++) {
        try {
          await this.subir(p);
          this.ultimoError = null;
          break;
        } catch (e) {
          if (e instanceof ErrorDefinitivo) {
            this.descartadas += 1;
            this.ultimoError = e.message;
            break;
          }
          this.ultimoError = e instanceof Error ? e.message : "Error de subida";
          this.avisar();
          await this.dormir(esperaReintento(intento));
        }
      }
      try {
        await this.almacen.borrar(p.id);
      } catch (e) {
        this.ultimoError = e instanceof Error ? e.message : "Error al borrar del almacén";
      }
    } finally {
      this.enCurso.delete(p.id);
      this.conocidas.delete(p.id);
      this.avisar();
      this.bombear();
    }
  }

  private avisar() {
    this.opciones.alCambiar?.(this.resumen());
  }
}
