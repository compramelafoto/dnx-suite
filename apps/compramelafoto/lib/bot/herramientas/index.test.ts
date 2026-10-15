import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, Prisma: {} }));

import { toolsForActor } from "./index";

const ESCOLARES = [
  "ver_progreso_escolar",
  "crear_escuela",
  "cargar_cursos",
  "invitar_admin_escuela",
  "vincular_album_a_escuela",
  "elegir_identificacion_alumnos",
  "configurar_comision_escuela",
  "avisar_familias_fotos_listas",
];
const nombres = (role: string) =>
  toolsForActor({ userId: 7, role, email: "f@x.com", name: "F" }, { conversationId: "c1" }).map((t) => t.name);

describe("toolsForActor", () => {
  it("fotógrafos y laboratorios reciben las herramientas escolares", () => {
    for (const role of ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]) expect(nombres(role)).toEqual(expect.arrayContaining(ESCOLARES));
  });
  it("los demás roles no", () => {
    const n = nombres("CUSTOMER");
    for (const e of ESCOLARES) expect(n).not.toContain(e);
  });
  it("no hay nombres repetidos ni herramientas para cargar packs cobrados por fuera", () => {
    const n = nombres("PHOTOGRAPHER");
    expect(new Set(n).size).toBe(n.length);
    expect(n.filter((x) => /extern|por_fuera|canje/i.test(x))).toEqual([]);
  });
});
