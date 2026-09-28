import { describe, expect, it } from "vitest";
import lead from "./fixtures/lead-row.json";
import activities from "./fixtures/activities.json";
import mails from "./fixtures/mails.json";
import { fechaAlboom, mapearOportunidad, movimientosDesde, textoPlano } from "./mapper";
import type { AlboomLeadRow } from "./types";

describe("fechaAlboom", () => {
  it("interpreta la hora como Argentina (UTC-3)", () => {
    expect(fechaAlboom("2026-09-14 21:37:24")?.toISOString()).toBe("2026-09-15T00:37:24.000Z");
  });
  it("devuelve null para vacío o basura", () => {
    expect(fechaAlboom(null)).toBeNull();
    expect(fechaAlboom("")).toBeNull();
    expect(fechaAlboom("0000-00-00 00:00:00")).toBeNull();
  });
});

describe("textoPlano", () => {
  it("saca etiquetas, imágenes y entidades", () => {
    expect(textoPlano("Hola&nbsp;<br>che<img src=\"x\"><div>chau</div>")).toBe("Hola che chau");
  });
});

describe("movimientosDesde", () => {
  it("ordena cronológicamente y clasifica", () => {
    const m = movimientosDesde({ activities: activities.rows, mails: mails.rows });
    expect(m.map((x) => x.tipo)).toEqual(["OTRO", "CORREO", "OTRO", "ETAPA"]);
    expect(m[1].texto).toContain("recibimos tu consulta");
    expect(m[1].texto).not.toContain("<");
  });
});

describe("mapearOportunidad", () => {
  it("mapea una fila real", () => {
    const op = mapearOportunidad(lead as AlboomLeadRow, []);
    expect(op).toMatchObject({
      fuente: "ALBOOM",
      idExterno: "2025562",
      nombreCliente: "Alejandro",
      apellidoCliente: "Prueba",
      telefono: "3410000000",
      embudo: "Embudo de Ventas DNX 2022",
      etapa: "Recepción de la oportunidnad",
      etapaOrden: 1,
      etapasTotal: 6,
      abierta: true,
      invitados: "70 / 50",
      ciudad: "ibarlucea",
      tipoEvento: "Fotografía o Video de Cumpleaños de 15",
      origen: "Recomendado Por un Amigo/a",
    });
    expect(op.fechaEvento?.toISOString()).toBe("2026-11-28T03:00:00.000Z");
  });
  it("usa customer_phone si no hay celular, y null si no hay ninguno", () => {
    const row = { ...(lead as AlboomLeadRow), customer_cellular: "", customer_phone: "" };
    expect(mapearOportunidad(row, []).telefono).toBeNull();
  });
  it("marca cerrada lo que no tiene status 421", () => {
    expect(mapearOportunidad({ ...(lead as AlboomLeadRow), status_id: "422" }, []).abierta).toBe(false);
  });
});
