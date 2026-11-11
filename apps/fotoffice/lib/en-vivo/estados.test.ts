import { describe, expect, it } from "vitest";
import { ESTADOS_ACTIVOS, estaActivo, senalSegunCloudflare, transicion, type EstadoVivo, type EventoVivo } from "./estados";

const TODOS: EstadoVivo[] = ["ESPERANDO_SENAL", "EN_VIVO", "SENAL_CORTADA", "TERMINADA", "CANCELADA"];
const EVENTOS: EventoVivo[] = ["SENAL_CONECTADA", "SENAL_CORTADA", "GRABACION_LISTA", "TERMINAR"];

describe("recorrido de un vivo", () => {
  it("el camino normal: esperando → en vivo → terminado", () => {
    let e: EstadoVivo = "ESPERANDO_SENAL";
    e = transicion(e, "SENAL_CONECTADA");
    expect(e).toBe("EN_VIVO");
    e = transicion(e, "TERMINAR");
    expect(e).toBe("TERMINADA");
  });

  it("un corte de OBS no termina el vivo: vuelve a EN_VIVO si la señal vuelve", () => {
    const cortado = transicion("EN_VIVO", "SENAL_CORTADA");
    expect(cortado).toBe("SENAL_CORTADA");
    expect(transicion(cortado, "SENAL_CONECTADA")).toBe("EN_VIVO");
  });

  it("si Cloudflare cierra la grabación con la señal cortada, el vivo terminó", () => {
    expect(transicion("SENAL_CORTADA", "GRABACION_LISTA")).toBe("TERMINADA");
  });

  it("una grabación lista con señal (de un tramo anterior) no corta el vivo", () => {
    expect(transicion("EN_VIVO", "GRABACION_LISTA")).toBe("EN_VIVO");
  });

  it("terminar sin haber recibido nunca señal es CANCELADA", () => {
    expect(transicion("ESPERANDO_SENAL", "TERMINAR")).toBe("CANCELADA");
  });

  it("un corte antes de empezar no cambia nada", () => {
    expect(transicion("ESPERANDO_SENAL", "SENAL_CORTADA")).toBe("ESPERANDO_SENAL");
  });

  it("lo terminado no revive con avisos que llegan tarde", () => {
    for (const fin of ["TERMINADA", "CANCELADA"] as EstadoVivo[]) {
      for (const ev of EVENTOS) expect(transicion(fin, ev)).toBe(fin);
    }
  });

  it("es idempotente: aplicar dos veces el mismo evento da lo mismo que una", () => {
    for (const e of TODOS) {
      for (const ev of EVENTOS) {
        const una = transicion(e, ev);
        expect(transicion(una, ev)).toBe(una);
      }
    }
  });

  it("activos son los tres estados abiertos", () => {
    expect(TODOS.filter(estaActivo)).toEqual([...ESTADOS_ACTIVOS]);
  });
});

describe("señal según Cloudflare", () => {
  it("connected y reconnected = hay señal", () => {
    expect(senalSegunCloudflare("connected")).toBe(true);
    expect(senalSegunCloudflare("reconnected")).toBe(true);
  });
  it("desconexiones = no hay señal", () => {
    for (const s of ["reconnecting", "client_disconnect", "ttl_exceeded", "failed_to_connect", "failed_to_reconnect"]) {
      expect(senalSegunCloudflare(s)).toBe(false);
    }
  });
  it("sin dato o un estado desconocido no decide nada", () => {
    expect(senalSegunCloudflare(null)).toBeNull();
    expect(senalSegunCloudflare(undefined)).toBeNull();
    expect(senalSegunCloudflare("new_configuration_accepted")).toBeNull();
  });
});
