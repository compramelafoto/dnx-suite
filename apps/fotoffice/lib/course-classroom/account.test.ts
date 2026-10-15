// lib/course-classroom/account.test.ts
import { describe, expect, it, vi } from "vitest";
import { hashOpaqueToken } from "@repo/auth";
import {
  asegurarCuentaDelAlumno,
  crearEnlaceParaContrasena,
  DIAS_ENLACE_CONTRASENA,
  type CuentaDeps,
} from "./account";

function deps(existente: Awaited<ReturnType<CuentaDeps["buscar"]>>): CuentaDeps {
  return {
    buscar: vi.fn().mockResolvedValue(existente),
    crear: vi.fn().mockResolvedValue({ id: 99 }),
  };
}

describe("la cuenta del comprador", () => {
  it("si no existe, la crea con el correo normalizado", async () => {
    const d = deps(null);
    const r = await asegurarCuentaDelAlumno("  Ana@Example.COM ", d);
    expect(d.buscar).toHaveBeenCalledWith("ana@example.com");
    expect(d.crear).toHaveBeenCalledWith("ana@example.com");
    expect(r).toEqual({ userId: 99, creada: true, puedeEntrar: false });
  });

  it("si existe con contraseña, la usa y puede entrar", async () => {
    const d = deps({ id: 7, password: "hash", googleId: null, isBlocked: false });
    expect(await asegurarCuentaDelAlumno("ana@example.com", d)).toEqual({ userId: 7, creada: false, puedeEntrar: true });
    expect(d.crear).not.toHaveBeenCalled();
  });

  it("con Google y sin contraseña también puede entrar", async () => {
    const d = deps({ id: 7, password: null, googleId: "g-1", isBlocked: false });
    expect((await asegurarCuentaDelAlumno("ana@example.com", d))?.puedeEntrar).toBe(true);
  });

  it("existente sin contraseña ni Google: hay que mandarle a crear la contraseña", async () => {
    const d = deps({ id: 7, password: null, googleId: null, isBlocked: false });
    expect((await asegurarCuentaDelAlumno("ana@example.com", d))?.puedeEntrar).toBe(false);
  });

  it("una cuenta bloqueada no recibe cursos", async () => {
    const d = deps({ id: 7, password: "hash", googleId: null, isBlocked: true });
    expect(await asegurarCuentaDelAlumno("ana@example.com", d)).toBeNull();
  });

  it("un correo inválido no crea nada", async () => {
    const d = deps(null);
    expect(await asegurarCuentaDelAlumno("no-es-correo", d)).toBeNull();
    expect(d.buscar).not.toHaveBeenCalled();
  });
});

describe("el enlace para crear la contraseña", () => {
  it("dura 7 días y en la base queda sólo el hash", async () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    const ahora = new Date(Date.UTC(2026, 9, 4, 12));
    const url = await crearEnlaceParaContrasena(7, "https://fotoffice.com/", ahora, { guardar });

    expect(url.startsWith("https://fotoffice.com/recuperar/")).toBe(true);
    const token = url.split("/recuperar/")[1];
    const fila = guardar.mock.calls[0][0];
    expect(fila.userId).toBe(7);
    expect(fila.tokenHash).toBe(hashOpaqueToken(token));
    expect(fila.tokenHash).not.toBe(token);
    expect(fila.expiresAt.getTime() - ahora.getTime()).toBe(DIAS_ENLACE_CONTRASENA * 24 * 60 * 60 * 1000);
  });
});
