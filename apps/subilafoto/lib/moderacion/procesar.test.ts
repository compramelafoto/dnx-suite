import { describe, expect, test } from "vitest";
import { procesarFoto, type Dependencias, type FotoParaModerar } from "./procesar";
import type { ProveedorDeModeracion } from "./proveedor";

function proveedorQueDevuelve(
  etiquetas: { nombre: string; confianza: number }[],
): ProveedorDeModeracion {
  return {
    nombre: "falso",
    async analizar() {
      return { ok: true, etiquetas, modelo: "7.0", latenciaMs: 12 };
    },
  };
}

const proveedorRoto: ProveedorDeModeracion = {
  nombre: "falso",
  async analizar() {
    return { ok: false, codigoDeError: "AccessDeniedException", latenciaMs: 5 };
  },
};

const FOTO: FotoParaModerar = {
  id: "m1",
  eventId: "e1",
  originalKey: "eventos/ABC123/m1.jpg",
  perfil: "SOCIAL",
};

/** Arma unas dependencias falsas y registra lo que se guardó. */
function armar(opciones: Partial<Dependencias> & { foto?: FotoParaModerar | null } = {}) {
  const guardados: Parameters<Dependencias["guardar"]>[0][] = [];
  let llamadasAlProveedor = 0;
  let claimado = false;

  const proveedorBase = opciones.proveedor ?? proveedorQueDevuelve([]);

  const deps: Dependencias = {
    async obtenerFoto() {
      return opciones.foto === undefined ? FOTO : opciones.foto;
    },
    async descargar() {
      return new Uint8Array([1, 2, 3]);
    },
    proveedor: {
      nombre: proveedorBase.nombre,
      async analizar(imagen) {
        llamadasAlProveedor++;
        return proveedorBase.analizar(imagen);
      },
    },
    // Simula el `updateMany ... where status = PROCESSING`: sólo el primero gana.
    async guardar(entrada) {
      if (claimado) return false;
      claimado = true;
      guardados.push(entrada);
      return true;
    },
    ...(opciones.descargar ? { descargar: opciones.descargar } : {}),
    ...(opciones.obtenerFoto ? { obtenerFoto: opciones.obtenerFoto } : {}),
    ...(opciones.guardar ? { guardar: opciones.guardar } : {}),
  };

  return { deps, guardados, llamadas: () => llamadasAlProveedor };
}

describe("procesar una foto", () => {
  test("una foto normal se aprueba y queda publicada", async () => {
    const { deps, guardados } = armar();
    const r = await procesarFoto(deps, "m1");

    expect(r.estado).toBe("decidida");
    expect(guardados).toHaveLength(1);
    expect(guardados[0]!.estado).toBe("APPROVED");
    expect(guardados[0]!.publicar).toBe(true);
  });

  test("una foto con violencia se bloquea y no se publica", async () => {
    const { deps, guardados } = armar({
      proveedor: proveedorQueDevuelve([{ nombre: "Violence", confianza: 95 }]),
    });
    const r = await procesarFoto(deps, "m1");

    expect(r.estado).toBe("decidida");
    expect(guardados[0]!.estado).toBe("BLOCKED");
    expect(guardados[0]!.publicar).toBe(false);
  });

  test("si el proveedor falla, la foto queda retenida y no publicada", async () => {
    const { deps, guardados } = armar({ proveedor: proveedorRoto });
    await procesarFoto(deps, "m1");

    expect(guardados[0]!.estado).toBe("REVIEW_REQUIRED");
    expect(guardados[0]!.publicar).toBe(false);
    expect(guardados[0]!.codigoDeError).toBe("AccessDeniedException");
  });

  test("si no se puede bajar la foto del bucket, tampoco se publica", async () => {
    // El archivo puede no estar todavía, o R2 puede fallar. Ninguna de las dos
    // cosas puede terminar en una foto proyectada sin revisar.
    const { deps, guardados } = armar({
      descargar: async () => {
        throw Object.assign(new Error("no está"), { name: "NoSuchKey" });
      },
    });
    await procesarFoto(deps, "m1");

    expect(guardados[0]!.estado).toBe("REVIEW_REQUIRED");
    expect(guardados[0]!.publicar).toBe(false);
    expect(guardados[0]!.codigoDeError).toBe("NoSuchKey");
  });

  test("procesar dos veces la misma foto guarda una sola decisión", async () => {
    // Criterio 2.4: reprocesar no crea dos decisiones ni la publica dos veces.
    const { deps, guardados } = armar();

    const primera = await procesarFoto(deps, "m1");
    const segunda = await procesarFoto(deps, "m1");

    expect(primera.estado).toBe("decidida");
    expect(segunda.estado).toBe("ya-decidida");
    expect(guardados).toHaveLength(1);
  });

  test("dos procesos a la vez tampoco duplican", async () => {
    const { deps, guardados } = armar();
    const [a, b] = await Promise.all([procesarFoto(deps, "m1"), procesarFoto(deps, "m1")]);

    expect(guardados).toHaveLength(1);
    expect([a.estado, b.estado].sort()).toEqual(["decidida", "ya-decidida"]);
  });

  test("si la foto no existe, no se inventa nada", async () => {
    const { deps, guardados, llamadas } = armar({ foto: null });
    const r = await procesarFoto(deps, "m1");

    expect(r.estado).toBe("no-existe");
    expect(guardados).toHaveLength(0);
    expect(llamadas()).toBe(0);
  });

  test("guarda quién decidió, con qué modelo y cuánto tardó", async () => {
    const { deps, guardados } = armar({
      proveedor: proveedorQueDevuelve([{ nombre: "Alcohol", confianza: 99 }]),
    });
    await procesarFoto(deps, "m1");

    const g = guardados[0]!;
    expect(g.perfil).toBe("SOCIAL");
    expect(g.proveedor).toBe("falso");
    expect(g.modelo).toBe("7.0");
    expect(g.latenciaMs).toBe(12);
    expect(g.versionDePolitica).toBeTruthy();
    expect(g.etiquetas).toEqual([{ nombre: "Alcohol", confianza: 99 }]);
  });
});
