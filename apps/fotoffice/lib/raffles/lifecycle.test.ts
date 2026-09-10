import { describe, expect, it } from "vitest";
import {
  canAnnounce,
  canCancel,
  canDraw,
  canEditPrizes,
  canSeal,
  isRaffleClosed,
  nextPrizeStatus,
} from "./lifecycle";

const AHORA = new Date("2026-09-20T12:00:00Z");
const CIERRE = new Date("2026-09-29T23:00:00Z");
const ACTO = new Date("2026-09-30T23:00:00Z");

describe("anunciar", () => {
  const base = {
    status: "BORRADOR" as const,
    prizeCount: 2,
    entriesCloseAt: CIERRE,
    drawsAt: ACTO,
    now: AHORA,
  };

  it("un borrador con premios y fechas futuras se puede anunciar", () => {
    expect(canAnnounce(base)).toEqual({ ok: true });
  });

  it("no se anuncia un sorteo sin premios", () => {
    expect(canAnnounce({ ...base, prizeCount: 0 })).toEqual({
      ok: false,
      error: "No se puede anunciar un sorteo sin premios.",
    });
  });

  it("no se anuncia dos veces", () => {
    expect(canAnnounce({ ...base, status: "ANUNCIADO" }).ok).toBe(false);
  });

  it("el padrón tiene que cerrar antes del acto", () => {
    expect(canAnnounce({ ...base, entriesCloseAt: ACTO, drawsAt: CIERRE }).ok).toBe(false);
  });

  it("no se anuncia algo cuyo cierre ya pasó", () => {
    expect(canAnnounce({ ...base, now: new Date("2026-10-01T00:00:00Z") }).ok).toBe(false);
  });
});

describe("sellar el padrón", () => {
  const base = {
    status: "ANUNCIADO" as const,
    entriesCloseAt: CIERRE,
    now: new Date("2026-09-30T00:00:00Z"),
    entrantCount: 40,
    prizeCount: 2,
  };

  it("después del cierre, con gente y con premios, se sella", () => {
    expect(canSeal(base)).toEqual({ ok: true });
  });

  it("antes del cierre no se sella: el padrón todavía puede cambiar", () => {
    expect(canSeal({ ...base, now: AHORA }).ok).toBe(false);
  });

  it("sin ningún socio al día no se sella, y el aviso lo dice", () => {
    expect(canSeal({ ...base, entrantCount: 0 })).toEqual({
      ok: false,
      error: "Ningún socio quedó al día al cerrar el padrón. El sorteo no se puede sellar.",
    });
  });

  it("con menos participantes que premios no se sella", () => {
    expect(canSeal({ ...base, entrantCount: 1, prizeCount: 3 }).ok).toBe(false);
  });

  it("con tantos participantes como premios, sí: cada premio tiene dueño", () => {
    expect(canSeal({ ...base, entrantCount: 2, prizeCount: 2 }).ok).toBe(true);
  });

  it("un padrón ya sellado no se vuelve a sellar", () => {
    expect(canSeal({ ...base, status: "PADRON_SELLADO" }).ok).toBe(false);
  });
});

describe("sortear", () => {
  const DESPUES = new Date("2026-10-01T00:00:00Z");

  it("con el padrón sellado y pasado el acto, se sortea", () => {
    expect(canDraw({ status: "PADRON_SELLADO", drawsAt: ACTO, now: DESPUES })).toEqual({ ok: true });
  });

  it("antes del acto, no", () => {
    expect(canDraw({ status: "PADRON_SELLADO", drawsAt: ACTO, now: AHORA }).ok).toBe(false);
  });

  it("sin sellar, no", () => {
    expect(canDraw({ status: "ANUNCIADO", drawsAt: ACTO, now: DESPUES }).ok).toBe(false);
  });

  it("un sorteo ya sorteado no se vuelve a sortear: el resultado es inmutable", () => {
    const r = canDraw({ status: "SORTEADO", drawsAt: ACTO, now: DESPUES });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no se rehace/i);
  });
});

describe("cancelar", () => {
  it("se cancela un borrador", () => {
    expect(canCancel("BORRADOR")).toEqual({ ok: true });
  });

  it("se cancela un anunciado", () => {
    expect(canCancel("ANUNCIADO")).toEqual({ ok: true });
  });

  it("NO se cancela un sorteo ya sorteado", () => {
    expect(canCancel("SORTEADO").ok).toBe(false);
  });

  it("NO se cancela con el padrón sellado: la huella ya se publicó", () => {
    expect(canCancel("PADRON_SELLADO").ok).toBe(false);
  });
});

describe("editar premios y fechas", () => {
  it("sólo en borrador", () => {
    expect(canEditPrizes("BORRADOR")).toBe(true);
    expect(canEditPrizes("ANUNCIADO")).toBe(false);
    expect(canEditPrizes("SORTEADO")).toBe(false);
  });
});

describe("el camino de cada premio", () => {
  it("ganado pasa a notificado", () => {
    expect(nextPrizeStatus("GANADO", "NOTIFICADO", null)).toEqual({ ok: true });
  });

  it("notificado pasa a retirado", () => {
    expect(nextPrizeStatus("NOTIFICADO", "RETIRADO", null)).toEqual({ ok: true });
  });

  it("se puede entregar sin haber marcado el aviso: el socio puede aparecer solo", () => {
    expect(nextPrizeStatus("GANADO", "RETIRADO", null)).toEqual({ ok: true });
  });

  it("vencido el plazo, queda como no retirado", () => {
    expect(nextPrizeStatus("NOTIFICADO", "NO_RETIRADO", null)).toEqual({ ok: true });
  });

  it("anular exige motivo escrito", () => {
    expect(nextPrizeStatus("GANADO", "ANULADO", null).ok).toBe(false);
    expect(nextPrizeStatus("GANADO", "ANULADO", "   ").ok).toBe(false);
    expect(nextPrizeStatus("GANADO", "ANULADO", "El premio no llegó")).toEqual({ ok: true });
  });

  it("lo retirado no vuelve atrás", () => {
    expect(nextPrizeStatus("RETIRADO", "NOTIFICADO", null).ok).toBe(false);
  });

  it("lo anulado no revive", () => {
    expect(nextPrizeStatus("ANULADO", "RETIRADO", null).ok).toBe(false);
  });
});

describe("cuándo se cierra el sorteo", () => {
  it("cuando todos los premios terminaron su camino", () => {
    expect(isRaffleClosed(["RETIRADO", "NO_RETIRADO", "ANULADO"])).toBe(true);
  });

  it("uno pendiente lo mantiene abierto", () => {
    expect(isRaffleClosed(["RETIRADO", "NOTIFICADO"])).toBe(false);
  });

  it("sin premios no está cerrado: no llegó a sortearse", () => {
    expect(isRaffleClosed([])).toBe(false);
  });
});
