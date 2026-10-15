import { describe, expect, it } from "vitest";
import { badgeText, mergeNotices, relativeTime, unreadCount, type Notice } from "./feed";

const ahora = new Date("2026-10-06T15:00:00Z");
const hace = (horas: number) => new Date(ahora.getTime() - horas * 60 * 60 * 1000);
const n = (key: string, at: Date): Notice => ({ key, kind: "blog", title: key, href: "/", at });

describe("novedades", () => {
  it("ordena de la más nueva, saca repetidas, lo futuro y lo viejo", () => {
    const r = mergeNotices(
      [
        [n("a", hace(5)), n("b", hace(1))],
        [n("a", hace(2)), n("futuro", new Date(ahora.getTime() + 3_600_000)), n("vieja", hace(24 * 60))],
      ],
      ahora,
    );
    expect(r.map((x) => x.key)).toEqual(["b", "a"]);
    expect(r[1]!.at).toEqual(hace(2));
  });

  it("respeta el tope", () => {
    const muchas = Array.from({ length: 60 }, (_, i) => n(`k${i}`, hace(i)));
    expect(mergeNotices([muchas], ahora, 40)).toHaveLength(40);
  });

  it("cuenta las no vistas", () => {
    const lista = [n("a", hace(1)), n("b", hace(3)), n("c", hace(10))];
    expect(unreadCount(lista, null)).toBe(3);
    expect(unreadCount(lista, hace(4))).toBe(2);
    expect(unreadCount(lista, ahora)).toBe(0);
  });

  it("el globito", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(12)).toBe("9+");
  });

  it("tiempo relativo", () => {
    expect(relativeTime(new Date(ahora.getTime() - 30_000), ahora)).toBe("recién");
    expect(relativeTime(hace(0.5), ahora)).toBe("hace 30 min");
    expect(relativeTime(hace(3), ahora)).toBe("hace 3 h");
    expect(relativeTime(hace(30), ahora)).toBe("ayer");
    expect(relativeTime(hace(24 * 4), ahora)).toBe("hace 4 días");
  });
});
