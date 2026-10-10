import { describe, expect, it } from "vitest";
import { copiarTextosAExpositores, type TextosDeObra } from "./copiar";

type Fila = { id: string; activityId: string; status: string } & TextosDeObra;

/** Una transacción de mentira que aplica el `where` de `updateMany` sobre filas en memoria. */
function base(filas: Fila[]) {
  const tx = {
    culturalExhibitorWork: {
      updateMany: async ({ where, data }: { where: Partial<Fila>; data: Partial<TextosDeObra> }) => {
        let count = 0;
        for (const f of filas) {
          if (Object.entries(where).every(([k, v]) => f[k as keyof Fila] === v)) {
            Object.assign(f, data);
            count++;
          }
        }
        return { count };
      },
    },
  };
  return tx as unknown as Parameters<typeof copiarTextosAExpositores>[0];
}

const textos = { title: "Río", year: 2020, technique: "Giclée" };

describe("copiarTextosAExpositores", () => {
  it("copia a una obra aprobada lo que cambió", async () => {
    const filas: Fila[] = [{ id: "e1", activityId: "a1", status: "APPROVED", ...textos }];
    await copiarTextosAExpositores(base(filas), "a1", [{ id: "w1", ...textos, title: "Río grande" }], new Map([["w1", "e1"]]), new Map([["w1", textos]]));
    expect(filas[0]).toMatchObject({ title: "Río grande", year: 2020, technique: "Giclée" });
  });

  it("no pisa una obra con cambios pedidos aunque la ficha cambie", async () => {
    const corrigiendo = { title: "Lo que corrige quien expone", year: 2021, technique: "Analógica" };
    const filas: Fila[] = [{ id: "e1", activityId: "a1", status: "CHANGES_REQUESTED", ...corrigiendo }];
    await copiarTextosAExpositores(base(filas), "a1", [{ id: "w1", ...textos, title: "Otro" }], new Map([["w1", "e1"]]), new Map([["w1", textos]]));
    expect(filas[0]).toMatchObject(corrigiendo);
  });

  it("sólo lo que cambió: guardar sin tocar el título no lo pisa", async () => {
    const filas: Fila[] = [{ id: "e1", activityId: "a1", status: "APPROVED", title: "Título del expositor", year: 2020, technique: "Giclée" }];
    await copiarTextosAExpositores(base(filas), "a1", [{ id: "w1", ...textos, year: 2019 }], new Map([["w1", "e1"]]), new Map([["w1", textos]]));
    expect(filas[0]).toMatchObject({ title: "Título del expositor", year: 2019, technique: "Giclée" });
  });

  it("sin cambios no escribe; otra muestra nunca", async () => {
    const filas: Fila[] = [{ id: "e1", activityId: "otra", status: "APPROVED", ...textos }];
    await copiarTextosAExpositores(base(filas), "a1", [{ id: "w1", ...textos, title: "X" }], new Map([["w1", "e1"]]), new Map([["w1", textos]]));
    expect(filas[0]!.title).toBe("Río");
  });
});
