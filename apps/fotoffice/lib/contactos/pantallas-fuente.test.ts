import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de las pantallas de contactos de la etapa 1 (Tarea 7). */
const RAIZ = join(__dirname, "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");

const ACCIONES = ["app/actions/contactos.ts", "app/actions/clientes-import.ts"];
const CLIENTE = ["components/contactos/perfil-contacto.tsx", "components/contactos/importar-clientes.tsx"];

describe("archivos «use server»", () => {
  it.each(ACCIONES)("%s sólo exporta funciones async", (ruta) => {
    const fuente = leer(ruta);
    expect(fuente.startsWith('"use server";')).toBe(true);
    expect([...fuente.matchAll(/^export\s+(?!async function)(\S+)/gm)]).toEqual([]);
  });
});

describe("componentes de cliente", () => {
  it.each(CLIENTE)("%s no importa la base ni módulos de servidor con valores", (ruta) => {
    const fuente = leer(ruta);
    expect(fuente.startsWith('"use client";')).toBe(true);
    expect(fuente).not.toMatch(/from "@repo\/db"/);
    // De `lib/contactos` y `lib/clients/importar` sólo tipos.
    for (const m of fuente.matchAll(/^import (?!type )[^;]*from "@\/lib\/(contactos|clients)\/[^"]+";/gm)) {
      throw new Error(`importa con valores: ${m[0]}`);
    }
  });
});

describe("ficha del cliente", () => {
  const fuente = leer("app", "(shell)", "clientes", "[clientId]", "page.tsx");
  it("la tarjeta Consultas pide Ver en Consultas y el botón Gestionar", () => {
    expect(fuente).toMatch(/const veConsultas = puede\(acceso, "ver", SERVICE_LEADS_MODULE_KEY\)/);
    expect(fuente).toMatch(/const creaConsultas = puede\(acceso, "operar", SERVICE_LEADS_MODULE_KEY\)/);
    expect(fuente).toMatch(/veConsultas \? consultasDelContacto\(workspace\.id, cliente\.id\)/);
    expect(fuente).toMatch(/puedeCrear=\{creaConsultas\}/);
  });
  it("los datos ampliados se editan sólo con Gestionar en Clientes", () => {
    expect(fuente).toMatch(/<PerfilContactoTarjeta clientId=\{cliente\.id\} perfil=\{perfil\} puedeEditar=\{canEdit\} \/>/);
  });
});

describe("importar clientes", () => {
  it("la pantalla pide Gestionar en Clientes", () => {
    expect(leer("app", "(shell)", "clientes", "importar", "page.tsx")).toMatch(/await requireClientsEditor\(\)/);
  });
});
