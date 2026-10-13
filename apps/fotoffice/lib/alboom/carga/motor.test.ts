import { beforeEach, describe, expect, it } from "vitest";
import { CLAVES_CARGA, progresoInicial } from "./catalogo";
import { MOTIVOS } from "./campos";
import { CATEGORIA_15, COMBO, CONTACTO, COSTO, EMBUDO, ETAPA_1, ETIQUETA, ITEM_COMBO, ORIGEN, PRODUCTO, USUARIO } from "./ejemplos-alboom";
import { informeVacio, type Informe } from "./informe";
import { ejecutarMotor, type OpcionesMotor } from "./motor";
import { crearRepoMemoria, type RepoMemoria } from "./repositorio-memoria";
import type { ModoCarga } from "./tipos";

const WS = "ws-1";
const OTRO = "ws-2";
let M: RepoMemoria;

function sembrarFotoffice(ws: string) {
  M.datos.miembros.push({ workspaceId: ws, userId: 7, email: "ana@estudio.test" });
  M.datos.origenes.push({ workspaceId: ws, id: `${ws}-o1`, name: "Instagram", order: 0 });
  M.datos.categorias.push({ workspaceId: ws, id: `${ws}-c15`, name: "Fotografía o Video de Cumpleaños de 15", group: "EVENTO", order: 0 });
  M.datos.circuitos.push({ workspaceId: ws, id: `${ws}-v1`, name: "Embudo de Ventas DNX 2022", kind: "VENTA" });
  M.datos.etapas.push({ workspaceId: ws, id: `${ws}-s1`, circuitId: `${ws}-v1`, name: "Recepción de la oportunidad" });
}

function sembrarCrudos(ws: string) {
  M.crudo(ws, "usuarios", "1", USUARIO);
  M.crudo(ws, "origenes", ORIGEN.name, ORIGEN);
  M.crudo(ws, "origenes", "Instagram", { name: "instagram", posicion: 2 });
  M.crudo(ws, "categorias", "lead_type/12", CATEGORIA_15);
  M.crudo(ws, "categorias", "lead_type/13", { id: "13", name: "Família", subtype: "Trabajo sin fecha", active: "1" });
  M.crudo(ws, "categorias", "contact/2", { id: "2", name: "Cliente" });
  M.crudo(ws, "etiquetas", "contacts/1", ETIQUETA);
  M.crudo(ws, "etiquetas", "leads/1", { tag: "Web" });
  M.crudo(ws, "embudos", "1611", EMBUDO);
  M.crudo(ws, "etapas_embudo", "9001", ETAPA_1);
  M.crudo(ws, "contactos", "7001", CONTACTO);
  M.crudo(ws, "contactos", "7002", { ...CONTACTO, id: "7002", name: "Lu", email: "LUCIA.FERNANDEZ@correo.test" });
  M.crudo(ws, "contactos", "7003", { ...CONTACTO, id: "7003", name: "Contacto", lastname: "de prueba", email: "test@estudio.test" });
  M.crudo(ws, "contactos", "7004", { ...CONTACTO, id: "7004", name: "Martín", lastname: "Ruiz", email: "martin@correo.test", cellular: "3416000000", rg: "", tags: "" });
  M.crudo(ws, "productos", "55", PRODUCTO);
  M.crudo(ws, "productos", "60", COMBO);
  M.crudo(ws, "combos", "60/h1", ITEM_COMBO);
  M.crudo(ws, "costos_producto", "55/9", COSTO);
}

async function correr(modo: ModoCarga, opciones: Partial<OpcionesMotor> = {}) {
  const informe: Informe = informeVacio();
  const progreso = progresoInicial();
  const r = await ejecutarMotor({
    repo: M.repo,
    workspaceId: WS,
    modo,
    entidades: CLAVES_CARGA,
    informe,
    progreso,
    actor: { userId: 7, label: "Migración desde Alboom" },
    ahora: () => 0,
    limite: 1_000_000,
    guardar: async () => true,
    ...opciones,
  });
  return { r, informe, progreso };
}

/** Todo lo que no es crudo ni carga: lo que una simulación no puede tocar. */
function destino() {
  const { crudos: _c, cargas: _g, extraccionesActivas: _e, ...resto } = M.datos;
  return JSON.stringify(resto);
}

beforeEach(() => {
  M = crearRepoMemoria();
  sembrarFotoffice(WS);
  sembrarFotoffice(OTRO);
  sembrarCrudos(WS);
});

describe("simulación", () => {
  it("no escribe nada (ni registros ni mapa) y arma el informe completo", async () => {
    const antes = destino();
    const { r, informe } = await correr("SIMULACION");
    expect(r).toBe("COMPLETA");
    expect(M.datos.escrituras).toBe(0);
    expect(destino()).toBe(antes);
    const e = informe.entidades;
    expect(e.usuarios).toMatchObject({ leidos: 1, iguales: 1, vinculados: 1 });
    expect(e.origenes).toMatchObject({ crear: 1, iguales: 1 });
    // Sólo las de consulta ("lead_type/…"): las de contacto ni se leen.
    expect(e.categorias_consulta).toMatchObject({ leidos: 2, crear: 1, iguales: 1, omitidos: 0 });
    expect(e.etiquetas).toMatchObject({ crear: 1, omitidos: 1 });
    expect(e.circuitos).toMatchObject({ iguales: 1, vinculados: 1 });
    expect(e.etapas).toMatchObject({ iguales: 1, vinculados: 1 });
    expect(e.contactos).toMatchObject({ leidos: 4, crear: 2, omitidos: 2 });
    expect(e.contactos!.motivos.omitidos).toEqual({ [MOTIVOS.duplicadoAlboom]: 1, [MOTIVOS.datoDePrueba]: 1 });
    expect(e.contactos!.fusionados).toEqual([{ alboomId: "7002", con: "7001" }]);
    expect(e.productos).toMatchObject({ crear: 2 });
    // Combos y costos ven lo que la simulación "habría creado".
    expect(e.combos).toMatchObject({ crear: 1, omitidos: 0 });
    expect(e.costos).toMatchObject({ crear: 1, dudas: 0 });
  });

  it("el informe no lleva nombres, correos ni teléfonos: sólo cantidades, motivos e ids de Alboom", async () => {
    const { informe } = await correr("SIMULACION");
    const texto = JSON.stringify(informe).toLowerCase();
    for (const dato of ["lucía", "lucia", "fernández", "correo.test", "estudio.test", "341", "san josé", "martín", "30123456"]) expect(texto).not.toContain(dato);
  });
});

describe("carga", () => {
  it("crea, vincula y guarda el mapa; el informe coincide con la simulación", async () => {
    const sim = await correr("SIMULACION");
    const { informe } = await correr("CARGA");
    for (const k of CLAVES_CARGA) {
      const { crear, actualizar, iguales, omitidos } = informe.entidades[k]!;
      expect({ k, crear, actualizar, iguales, omitidos }).toEqual({ k, ...pick(sim.informe.entidades[k]!) });
    }
    const clientes = M.datos.clientes.filter((c) => c.workspaceId === WS);
    expect(clientes).toHaveLength(2);
    expect(clientes[0]!.campos).toMatchObject({ email: "lucia.fernandez@correo.test", phone: "5493415551234", category: "CLIENTE" });
    expect(clientes[0]!.creadoPor).toEqual({ userId: 7, label: "Migración desde Alboom" });
    // El duplicado de Alboom apunta al mismo cliente.
    const mapa = (id: string) => M.datos.mapa.find((m) => m.entity === "contactos" && m.alboomId === id)?.targetId;
    expect(mapa("7002")).toBe(mapa("7001"));
    expect(mapa("7003")).toBeUndefined();
    // Etiquetas creadas y asignadas sin duplicar el catálogo.
    expect(M.datos.etiquetas.filter((e) => e.workspaceId === WS).map((e) => e.nameKey).sort()).toEqual(["boda 2026", "vip"]);
    expect(M.datos.asignaciones).toHaveLength(2);
    // Etapa con su fila de posición; combo y costo con los ids reales.
    expect(M.datos.mapa.find((m) => m.entity === "posicion_embudo")).toMatchObject({ alboomId: "1611/1", targetId: `${WS}-s1` });
    const prod = (id: string) => M.datos.mapa.find((m) => m.entity === "productos" && m.alboomId === id)!.targetId;
    expect(M.datos.items[0]).toMatchObject({ comboProductId: prod("60"), componentProductId: prod("55"), quantity: 2 });
    expect(M.datos.costos[0]).toMatchObject({ productId: prod("55"), supplierClientId: mapa("7001"), amountArs: "20000.00" });
    expect(M.datos.mapa.find((m) => m.entity === "usuarios")).toMatchObject({ targetType: "USER", targetId: "7" });
  });

  it("es idempotente: cargar otra vez no crea nada y no escribe nada", async () => {
    await correr("CARGA");
    const antes = destino();
    const escrituras = M.datos.escrituras;
    const { informe } = await correr("CARGA");
    expect(destino()).toBe(antes);
    expect(M.datos.escrituras).toBe(escrituras);
    for (const e of Object.values(informe.entidades)) expect(e.crear).toBe(0);
    expect(informe.entidades.contactos).toMatchObject({ iguales: 3, crear: 0, actualizar: 0 });
  });

  it("no pisa lo editado en FOTOFFICE después de la carga, y actualiza lo que nadie tocó", async () => {
    await correr("CARGA");
    const lucia = M.datos.clientes.find((c) => c.campos.email === "lucia.fernandez@correo.test")!;
    lucia.campos.city = "Roldán"; // editado a mano en FOTOFFICE
    M.crudo(WS, "contactos", "7001", { ...CONTACTO, city: "Rosario", memo: "Cambió en Alboom", cellular: "3417000000" });
    const { informe } = await correr("CARGA");
    expect(lucia.campos.city).toBe("Roldán");
    expect(lucia.campos.about).toBe("Cambió en Alboom");
    expect(lucia.campos.mobile).toBe("5493417000000");
    expect(informe.entidades.contactos).toMatchObject({ actualizar: 1, conflictos: 1 });
    expect(Object.keys(informe.entidades.contactos!.motivos.conflictos)).toEqual(["Se conservó lo de FOTOFFICE en: ciudad"]);
    expect(M.datos.clientes.filter((c) => c.workspaceId === WS)).toHaveLength(2);
  });

  it("empareja con clientes que ya existían (por correo) en vez de duplicarlos", async () => {
    M.datos.clientes.push({ workspaceId: WS, id: "viejo", clientNumber: 1, campos: { kind: "PERSONA", firstName: "Martín", email: "martin@correo.test", phone: null }, creadoPor: { userId: 1, label: "x" } });
    const { informe } = await correr("CARGA");
    expect(informe.entidades.contactos).toMatchObject({ crear: 1, actualizar: 1, vinculados: 1 });
    expect(M.datos.clientes.find((c) => c.id === "viejo")!.campos).toMatchObject({ firstName: "Martín", lastName: "Ruiz", phone: "5493416000000" });
  });

  it("un error en un registro no frena la parte: queda en el informe, sin el mensaje de la base", async () => {
    M.fallarCuando((clave, d) => clave === "contactos" && d.datos?.firstName === "Lucía");
    const { r, informe } = await correr("CARGA");
    expect(r).toBe("COMPLETA");
    // Falló el primero: el duplicado (mismo correo) ya no es duplicado de nadie y se crea en su lugar.
    expect(informe.entidades.contactos).toMatchObject({ errores: 1, crear: 2 });
    expect(informe.entidades.contactos!.motivos.errores).toEqual({ "Error de la base (P2002)": 1 });
    expect(JSON.stringify(informe)).not.toContain("ana@x.test");
    expect(informe.entidades.productos).toMatchObject({ crear: 2 });
    // Al reintentar sin la falla, el que faltaba se ata al mismo cliente (mismo correo): nada se duplica.
    M.fallarCuando(null);
    await correr("CARGA");
    expect(M.datos.clientes.filter((c) => c.workspaceId === WS)).toHaveLength(2);
  });

  it("aislamiento: no lee crudos ni toca registros de otro workspace", async () => {
    sembrarCrudos(OTRO);
    const otroAntes = JSON.stringify([M.datos.clientes, M.datos.origenes, M.datos.productos].map((t) => t.filter((x) => x.workspaceId === OTRO)));
    const { informe } = await correr("CARGA");
    expect(informe.entidades.contactos!.leidos).toBe(4);
    expect(JSON.stringify([M.datos.clientes, M.datos.origenes, M.datos.productos].map((t) => t.filter((x) => x.workspaceId === OTRO)))).toBe(otroAntes);
    expect(M.datos.mapa.every((m) => m.workspaceId === WS)).toBe(true);
    // El circuito de OTRO tiene el mismo nombre pero nunca se elige.
    expect(M.datos.mapa.filter((m) => m.entity === "embudos").map((m) => m.targetId)).toEqual([`${WS}-v1`]);
  });
});

describe("tandas: presupuesto, reanudación y cancelación", () => {
  it("se corta por tiempo, guarda el cursor y retoma sin repetir ni saltear", async () => {
    let reloj = 0;
    const informe = informeVacio();
    const progreso = progresoInicial();
    const guardados: number[] = [];
    const base = {
      repo: M.repo,
      workspaceId: WS,
      modo: "CARGA" as const,
      entidades: CLAVES_CARGA,
      informe,
      progreso,
      actor: { userId: 7, label: "x" },
      ahora: () => reloj,
      lote: 1,
      margenMs: 0,
      guardar: async () => {
        reloj += 10;
        guardados.push(reloj);
        return true;
      },
    };
    expect(await ejecutarMotor({ ...base, limite: 50 })).toBe("PAUSADA");
    expect(progreso.indice).toBeGreaterThan(0);
    let vueltas = 0;
    let r = "PAUSADA";
    while (r === "PAUSADA" && vueltas++ < 100) r = await ejecutarMotor({ ...base, limite: reloj + 50 });
    expect(r).toBe("COMPLETA");
    expect(vueltas).toBeGreaterThan(3);
    const total = Object.values(informe.entidades).reduce((s, e) => s + e.leidos, 0);
    expect(total).toBe(M.datos.crudos.filter((c) => c.entity !== "categorias" || c.alboomId.startsWith("lead_type/")).length);
    expect(M.datos.clientes.filter((c) => c.workspaceId === WS)).toHaveLength(2);
  });

  it("la simulación recuerda los duplicados y lo simulado entre tandas", async () => {
    let reloj = 0;
    const informe = informeVacio();
    const progreso = progresoInicial();
    const base = {
      repo: M.repo, workspaceId: WS, modo: "SIMULACION" as const, entidades: CLAVES_CARGA, informe, progreso,
      actor: { userId: 7, label: "x" }, ahora: () => reloj, lote: 1, margenMs: 0,
      guardar: async () => { reloj += 10; return true; },
    };
    let r = "PAUSADA";
    for (let i = 0; i < 200 && r === "PAUSADA"; i++) r = await ejecutarMotor({ ...base, limite: reloj + 15 });
    expect(r).toBe("COMPLETA");
    expect(informe.entidades.contactos!.fusionados).toEqual([{ alboomId: "7002", con: "7001" }]);
    expect(informe.entidades.combos).toMatchObject({ crear: 1 });
    expect(M.datos.escrituras).toBe(0);
  });

  it("si la cancelan, frena en el próximo guardado", async () => {
    const { r } = await correr("CARGA", { guardar: async () => false });
    expect(r).toBe("CANCELADA");
  });
});

function pick(e: { crear: number; actualizar: number; iguales: number; omitidos: number }) {
  return { crear: e.crear, actualizar: e.actualizar, iguales: e.iguales, omitidos: e.omitidos };
}
