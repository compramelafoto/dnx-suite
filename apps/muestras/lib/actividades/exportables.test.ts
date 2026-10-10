import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));

import { CAMPOS_EXPORTABLES, aExportable } from "./exportables";

const fila = {
  id: "a1", slug: "miradas del barrio", type: "MUESTRA", title: "Miradas", description: "Texto", organizersText: "Foto Club",
  coverImageUrl: "https://pub.r2.dev/x.webp", startsAt: new Date("2026-10-15T03:00:00Z"), endsAt: new Date("2026-12-04T02:59:59.999Z"),
  scheduleText: "Lun a vie 10 a 18", priceText: null, isVirtualOnly: false, venueName: "Centro Cultural", address: "Calle 1",
  city: "Rosario", province: "Santa Fe", latitude: -32.95, longitude: -60.65, updatedAt: new Date("2026-10-10T12:00:00Z"),
};

describe("aExportable", () => {
  it("sólo campos públicos, fechas en ISO y la url de la página", () => {
    const r = aExportable(fila, "https://muestrasfotograficas.com/");
    expect(Object.keys(r).sort()).toEqual([...Object.keys(CAMPOS_EXPORTABLES), "url"].sort());
    expect(r.startsAt).toBe("2026-10-15T03:00:00.000Z");
    expect(r.url).toBe("https://muestrasfotograficas.com/m/miradas%20del%20barrio");
  });

  it("la consulta no pide nada privado", () => {
    for (const privado of ["proposedByUserId", "workspaceId", "reviewedByUserId", "rejectionReason", "rsvps", "members"]) {
      expect(CAMPOS_EXPORTABLES).not.toHaveProperty(privado);
    }
  });
});
