import { describe, expect, it } from "vitest";
import {
  botonMonitoreoHabilitado,
  esSilencio,
  estadoMonitoreo,
  gananciaDeVolumen,
  MedidorDeNivel,
  nivelDePico,
  picoDeMuestras,
  textoBotonMonitoreo,
} from "./monitoreo";

describe("nivel", () => {
  it("el pico es el máximo absoluto, tope 1", () => {
    expect(picoDeMuestras([0, 0.2, -0.5, 0.1])).toBe(0.5);
    expect(picoDeMuestras(new Float32Array([0, -1.4]))).toBe(1);
    expect(picoDeMuestras([])).toBe(0);
  });
  it("de 0 a 100", () => {
    expect(nivelDePico(0)).toBe(0);
    expect(nivelDePico(0.5)).toBe(50);
    expect(nivelDePico(1)).toBe(100);
    expect(nivelDePico(2)).toBe(100);
    expect(nivelDePico(-1)).toBe(0);
    expect(nivelDePico(Number.NaN)).toBe(0);
  });
  it("silencio total por debajo del umbral", () => {
    expect(esSilencio(0)).toBe(true);
    expect(esSilencio(0.00005)).toBe(true);
    expect(esSilencio(0.001)).toBe(false);
    expect(esSilencio(Number.NaN)).toBe(true);
  });
  it("volumen 0–100 % a ganancia 0–1", () => {
    expect(gananciaDeVolumen(80)).toBe(0.8);
    expect(gananciaDeVolumen(0)).toBe(0);
    expect(gananciaDeVolumen(150)).toBe(1);
    expect(gananciaDeVolumen(-5)).toBe(0);
    expect(gananciaDeVolumen(Number.NaN)).toBe(0.8);
  });
});

describe("MedidorDeNivel", () => {
  it("muestra el pico de los últimos ~300 ms", () => {
    const m = new MedidorDeNivel();
    expect(m.agregar(0.9, 0).nivel).toBe(90);
    expect(m.agregar(0.1, 100).nivel).toBe(90);
    expect(m.agregar(0.1, 300).nivel).toBe(90);
    expect(m.agregar(0.2, 301).nivel).toBe(20);
  });
  it("«Sin audio» sólo después de más de 3 s de silencio total", () => {
    const m = new MedidorDeNivel();
    expect(m.agregar(0, 0).sinAudio).toBe(false);
    expect(m.agregar(0, 2000).sinAudio).toBe(false);
    expect(m.agregar(0, 3000).sinAudio).toBe(false);
    expect(m.agregar(0, 3001).sinAudio).toBe(true);
    // Vuelve el audio: se apaga el aviso y la cuenta empieza de cero.
    expect(m.agregar(0.3, 3100)).toEqual({ nivel: 30, sinAudio: false });
    expect(m.agregar(0, 3200).sinAudio).toBe(false);
    expect(m.agregar(0, 6100).sinAudio).toBe(false);
    expect(m.agregar(0, 6201).sinAudio).toBe(true);
  });
  it("un nivel bajo pero real no cuenta como silencio", () => {
    const m = new MedidorDeNivel();
    for (let t = 0; t <= 5000; t += 100) expect(m.agregar(0.002, t).sinAudio).toBe(false);
  });
  it("reiniciar olvida todo", () => {
    const m = new MedidorDeNivel();
    m.agregar(0, 0);
    m.agregar(0.5, 4000);
    m.reiniciar();
    expect(m.agregar(0, 5000)).toEqual({ nivel: 0, sinAudio: false });
  });
});

describe("estadoMonitoreo", () => {
  it("sin stream no está disponible", () => {
    const e = estadoMonitoreo({ hayStream: false, pistasDeAudio: 0, activo: false });
    expect(e).toBe("NO_DISPONIBLE");
    expect(botonMonitoreoHabilitado(e)).toBe(false);
    expect(textoBotonMonitoreo(e)).toBe("Monitorear audio");
  });
  it("sin pista de audio: deshabilitado y lo dice", () => {
    const e = estadoMonitoreo({ hayStream: true, pistasDeAudio: 0, activo: false });
    expect(e).toBe("SIN_AUDIO");
    expect(botonMonitoreoHabilitado(e)).toBe(false);
    expect(textoBotonMonitoreo(e)).toBe("La capturadora no envía audio");
  });
  it("inactivo y activo", () => {
    const inactivo = estadoMonitoreo({ hayStream: true, pistasDeAudio: 1, activo: false });
    expect(inactivo).toBe("INACTIVO");
    expect(textoBotonMonitoreo(inactivo)).toBe("Monitorear audio");
    const activo = estadoMonitoreo({ hayStream: true, pistasDeAudio: 1, activo: true });
    expect(activo).toBe("ACTIVO");
    expect(textoBotonMonitoreo(activo)).toBe("Dejar de monitorear");
    expect(botonMonitoreoHabilitado(inactivo) && botonMonitoreoHabilitado(activo)).toBe(true);
  });
  it("si se va la pista de audio estando activo, gana SIN_AUDIO", () => {
    expect(estadoMonitoreo({ hayStream: true, pistasDeAudio: 0, activo: true })).toBe("SIN_AUDIO");
  });
});
