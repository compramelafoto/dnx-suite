import { describe, expect, it } from "vitest";
import { crearBaseEnMemoria } from "../circuitos/base-en-memoria";

// La base en memoria de las pruebas conoce las tablas de la Entrega B1, con sus valores por omisión y
// sus únicos (como la migración), así las pruebas de los módulos que vienen miran resultados reales.
describe("base en memoria: tablas de la Entrega B1", () => {
  it("una cuenta a pagar nace sin pagar ni anular", () => {
    const B = crearBaseEnMemoria();
    const c = B.agregar("fotofficeCuentaPagar", { workspaceId: "ws", concept: "Imprenta", amountArs: "100.00" });
    expect(c).toMatchObject({ pedidoId: null, paidAt: null, paidMethod: null, paidCashMovementId: null, voidedAt: null, idempotencyKey: null });
  });

  it("la misma clave de pago dos veces en el workspace choca; sin clave, no", () => {
    const B = crearBaseEnMemoria();
    const base = { workspaceId: "ws", concept: "X", amountArs: "1.00" };
    B.agregar("fotofficeCuentaPagar", base);
    B.agregar("fotofficeCuentaPagar", base);
    B.agregar("fotofficeCuentaPagar", { ...base, idempotencyKey: "k" });
    expect(() => B.agregar("fotofficeCuentaPagar", { ...base, idempotencyKey: "k" })).toThrow(expect.objectContaining({ code: "P2002" }));
    expect(B.agregar("fotofficeCuentaPagar", { ...base, paidCashMovementId: "m" })).toBeTruthy();
    expect(() => B.agregar("fotofficeCuentaPagar", { ...base, paidCashMovementId: "m" })).toThrow(expect.objectContaining({ code: "P2002" }));
  });

  it("un recordatorio por (cuota, vencimiento), comparando la fecha por valor", () => {
    const B = crearBaseEnMemoria();
    const r = { workspaceId: "ws", cuotaId: "cu-1" };
    B.agregar("fotofficeCuotaRecordatorio", { ...r, dueDate: new Date("2026-10-10T00:00:00.000Z") });
    expect(() => B.agregar("fotofficeCuotaRecordatorio", { ...r, dueDate: new Date("2026-10-10T00:00:00.000Z") })).toThrow(expect.objectContaining({ code: "P2002" }));
    // Si se mueve el vencimiento, vuelve a avisar.
    expect(B.agregar("fotofficeCuotaRecordatorio", { ...r, dueDate: new Date("2026-10-12T00:00:00.000Z") })).toBeTruthy();
  });

  it("los ajustes nacen con aviso un día antes y apagado, uno por workspace", () => {
    const B = crearBaseEnMemoria();
    const a = B.agregar("fotofficePedidoAjustes", { workspaceId: "ws" });
    expect(a).toMatchObject({ reminderDays: 1, reminderEnabled: false, incomeCategoryId: null, checklistTemplates: null });
    expect(() => B.agregar("fotofficePedidoAjustes", { workspaceId: "ws" })).toThrow(expect.objectContaining({ code: "P2002" }));
  });

  it("una tarea del checklist nace sin hacer", () => {
    const B = crearBaseEnMemoria();
    const t = B.agregar("fotofficePedidoTarea", { workspaceId: "ws", pedidoId: "p", position: 1, title: "Firmar contrato" });
    expect(t).toMatchObject({ doneAt: null, doneByUserId: null });
  });
});
