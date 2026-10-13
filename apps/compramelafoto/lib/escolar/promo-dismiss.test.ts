import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ESCOLAR_PROMO_DISMISS_DAYS,
  escolarPromoDismissValue,
  escolarPromoStorageKey,
  isEscolarPromoDismissed,
  readEscolarPromoDismissed,
  writeEscolarPromoDismissed,
} from "@/lib/escolar/promo-dismiss";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 13, 15, 0, 0);

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    data,
  };
}

describe("llamador escolar — cierre por 30 días", () => {
  it("son 30 días", () => {
    assert.equal(ESCOLAR_PROMO_DISMISS_DAYS, 30);
  });
  it("sin nada guardado se muestra", () => {
    assert.equal(isEscolarPromoDismissed(null, now), false);
    assert.equal(isEscolarPromoDismissed("", now), false);
  });
  it("cerrado hoy o hace 29 días sigue oculto", () => {
    assert.equal(isEscolarPromoDismissed(escolarPromoDismissValue(now), now), true);
    assert.equal(isEscolarPromoDismissed(String(now - 29 * DAY), now), true);
  });
  it("a los 30 días vuelve a aparecer", () => {
    assert.equal(isEscolarPromoDismissed(String(now - 30 * DAY), now), false);
    assert.equal(isEscolarPromoDismissed(String(now - 45 * DAY), now), false);
  });
  it("valores rotos o del futuro no ocultan el aviso", () => {
    assert.equal(isEscolarPromoDismissed("basura", now), false);
    assert.equal(isEscolarPromoDismissed("-5", now), false);
    assert.equal(isEscolarPromoDismissed(String(now + DAY), now), false);
  });
  it("acepta Date además de milisegundos", () => {
    assert.equal(isEscolarPromoDismissed(escolarPromoDismissValue(new Date(now)), new Date(now + DAY)), true);
  });
  it("la clave es por ubicación y segura", () => {
    assert.equal(escolarPromoStorageKey("dashboard"), "clf:escolar-promo:cerrado:dashboard");
    assert.notEqual(escolarPromoStorageKey("albumes"), escolarPromoStorageKey("pedidos"));
    assert.equal(escolarPromoStorageKey("Mis Álbumes"), "clf:escolar-promo:cerrado:mis--lbumes");
    assert.equal(escolarPromoStorageKey(""), "clf:escolar-promo:cerrado:general");
  });
  it("guardar y leer con almacenamiento", () => {
    const st = memoryStorage();
    assert.equal(readEscolarPromoDismissed(st, "pedidos", now), false);
    assert.equal(writeEscolarPromoDismissed(st, "pedidos", now), true);
    assert.equal(readEscolarPromoDismissed(st, "pedidos", now + DAY), true);
    assert.equal(readEscolarPromoDismissed(st, "albumes", now + DAY), false);
  });
  it("sin almacenamiento o si tira error, se muestra y no rompe", () => {
    const roto = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    assert.equal(readEscolarPromoDismissed(null, "x", now), false);
    assert.equal(readEscolarPromoDismissed(roto, "x", now), false);
    assert.equal(writeEscolarPromoDismissed(roto, "x", now), false);
    assert.equal(writeEscolarPromoDismissed(undefined, "x", now), false);
  });
});
