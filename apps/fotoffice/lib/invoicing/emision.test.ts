import { describe, expect, it } from "vitest";
import { CBTE_FACTURA_C, CONCILIAR_DESPUES_MS } from "./constants";
import { conciliar, emitir, type ComprobanteEnBase, type PuertoBase, type Serie } from "./emision";
import { crearTransporte } from "./soap";
import { crearClienteWsfe, puertoArca } from "./wsfe";
import { text } from "./xml";

/**
 * Un ARCA simulado detrás de `fetch`: guarda la numeración por serie, autoriza, rechaza, y sabe
 * "cortarse" de dos maneras —antes de procesar o después de autorizar—, que es el caso que la
 * conciliación tiene que resolver. Se usa el transporte y el cliente reales.
 */
type Modo = "NORMAL" | "RECHAZA" | "AUTORIZA_Y_SE_CORTA" | "SE_CORTA_SIN_PROCESAR" | "FALLA_SERVIDOR";

class ArcaSimulado {
  ultimo = new Map<string, number>();
  autorizados = new Map<string, { fecha: string; total: string; docTipo: string; docNro: string; cae: string }>();
  modo: Modo = "NORMAL";
  llamadasCae = 0;
  private cae = 76000000000000;

  private clave(pv: string | number, tipo: string | number) {
    return `${pv}-${tipo}`;
  }

  fetch: typeof fetch = async (_url, init) => {
    const accion = String((init?.headers as Record<string, string>).SOAPAction);
    const body = String(init?.body);
    const signal = init?.signal as AbortSignal;
    const colgar = () =>
      new Promise<Response>((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" }))));
    const pv = text(body, "PtoVta")!;
    const tipo = text(body, "CbteTipo")!;
    const k = this.clave(pv, tipo);

    if (accion.includes("FECompUltimoAutorizado")) {
      return xml(`<FECompUltimoAutorizadoResult><PtoVta>${pv}</PtoVta><CbteTipo>${tipo}</CbteTipo><CbteNro>${this.ultimo.get(k) ?? 0}</CbteNro></FECompUltimoAutorizadoResult>`);
    }
    if (accion.includes("FECompConsultar")) {
      const nro = text(body, "CbteNro")!;
      const a = this.autorizados.get(`${k}-${nro}`);
      if (!a) return xml(`<FECompConsultarResult><Errors><Err><Code>602</Code><Msg>No existen datos</Msg></Err></Errors></FECompConsultarResult>`);
      return xml(
        `<FECompConsultarResult><ResultGet><DocTipo>${a.docTipo}</DocTipo><DocNro>${a.docNro}</DocNro><CbteDesde>${nro}</CbteDesde><CbteHasta>${nro}</CbteHasta><CbteFch>${a.fecha}</CbteFch><ImpTotal>${a.total}</ImpTotal><Resultado>A</Resultado><CodAutorizacion>${a.cae}</CodAutorizacion><FchVto>20261104</FchVto></ResultGet></FECompConsultarResult>`,
      );
    }
    if (accion.includes("FECAESolicitar")) {
      this.llamadasCae++;
      if (this.modo === "SE_CORTA_SIN_PROCESAR") return colgar();
      if (this.modo === "FALLA_SERVIDOR") return new Response(`<soap:Envelope xmlns:soap="x"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Server was unable to process request.</faultstring></soap:Fault></soap:Body></soap:Envelope>`, { status: 500 });
      const nro = Number(text(body, "CbteDesde"));
      const esperado = (this.ultimo.get(k) ?? 0) + 1;
      if (this.modo === "RECHAZA" || nro !== esperado) {
        return xml(`<FECAESolicitarResult><FeCabResp><Resultado>R</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10016</Code><Msg>No es el proximo a autorizar</Msg></Obs></Observaciones></FECAEDetResponse></FeDetResp></FECAESolicitarResult>`);
      }
      const cae = String(++this.cae);
      this.ultimo.set(k, nro);
      this.autorizados.set(`${k}-${nro}`, { fecha: text(body, "CbteFch")!, total: text(body, "ImpTotal")!, docTipo: text(body, "DocTipo")!, docNro: text(body, "DocNro")!, cae });
      if (this.modo === "AUTORIZA_Y_SE_CORTA") return colgar();
      return xml(`<FECAESolicitarResult><FeCabResp><Resultado>A</Resultado><Reproceso>N</Reproceso></FeCabResp><FeDetResp><FECAEDetResponse><CbteDesde>${nro}</CbteDesde><Resultado>A</Resultado><CAE>${cae}</CAE><CAEFchVto>20261104</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult>`);
    }
    return new Response("?", { status: 404 });
  };
}

function xml(result: string): Response {
  return new Response(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><R xmlns="http://ar.gov.afip.dif.FEV1/">${result}</R></soap:Body></soap:Envelope>`, { status: 200 });
}

/** La base en memoria, con el índice único de la serie como el de Postgres. */
class BaseEnMemoria implements PuertoBase {
  filas = new Map<string, ComprobanteEnBase & { cae?: string; eventos: string[] }>();

  agregar(id: string, totalCentavos = 1500050) {
    this.filas.set(id, {
      id,
      status: "BORRADOR",
      serie: { ptoVta: 3, cbteTipo: CBTE_FACTURA_C },
      numero: null,
      enviadoEn: null,
      datos: { cuitEmisor: "20123456786", ptoVta: 3, cbteTipo: CBTE_FACTURA_C, concepto: 1, docTipo: 99, docNro: "0", condicionIvaReceptorId: 5, fecha: "20261025", totalCentavos, servicio: null, asociado: null },
      eventos: [],
    });
  }
  async leer(id: string) {
    const f = this.filas.get(id);
    return f ? { ...f } : null;
  }
  async pendientesDeLaSerie(s: Serie) {
    return [...this.filas.values()].filter((f) => f.status === "PENDIENTE" && f.serie.ptoVta === s.ptoVta && f.serie.cbteTipo === s.cbteTipo).map((f) => ({ ...f }));
  }
  async mayorNumeroAutorizado(s: Serie) {
    return Math.max(0, ...[...this.filas.values()].filter((f) => f.status === "AUTORIZADA" && f.serie.ptoVta === s.ptoVta).map((f) => f.numero ?? 0));
  }
  async reservarNumero(id: string, numero: number, _pedido: unknown, ahora: Date) {
    const f = this.filas.get(id)!;
    if (f.status !== "BORRADOR") return false;
    if ([...this.filas.values()].some((o) => o.numero === numero && o.serie.ptoVta === f.serie.ptoVta && o.serie.cbteTipo === f.serie.cbteTipo)) return false;
    Object.assign(f, { status: "PENDIENTE", numero, enviadoEn: ahora });
    return true;
  }
  async marcarAutorizada(id: string, r: { cae: string; nota: string }) {
    Object.assign(this.filas.get(id)!, { status: "AUTORIZADA", cae: r.cae, enviadoEn: null });
    this.filas.get(id)!.eventos.push("AUTORIZADA");
  }
  async marcarRechazada(id: string) {
    Object.assign(this.filas.get(id)!, { status: "RECHAZADA", numero: null, enviadoEn: null });
  }
  async volverABorrador(id: string) {
    Object.assign(this.filas.get(id)!, { status: "BORRADOR", numero: null, enviadoEn: null });
    this.filas.get(id)!.eventos.push("BORRADOR");
  }
  async anotar(id: string, tipo: string) {
    this.filas.get(id)!.eventos.push(tipo);
  }
}

function armar() {
  const arca = new ArcaSimulado();
  const base = new BaseEnMemoria();
  const cliente = crearClienteWsfe("https://wswhomo.afip.gov.ar/wsfev1/service.asmx", crearTransporte({ timeoutMs: 40, fetchImpl: arca.fetch }));
  const puerto = puertoArca(cliente, { token: "t", sign: "s", cuit: "20123456786" });
  return { arca, base, puerto };
}

const AHORA = new Date("2026-10-25T15:00:00Z");
const DESPUES = new Date(AHORA.getTime() + CONCILIAR_DESPUES_MS + 1000);

describe("emisión con numeración protegida", () => {
  it("toma el siguiente al último autorizado de ARCA y guarda el CAE", async () => {
    const { arca, base, puerto } = armar();
    arca.ultimo.set("3-11", 41);
    base.agregar("f1");
    const r = await emitir(base, puerto, "f1", AHORA);
    expect(r).toMatchObject({ estado: "AUTORIZADA", numero: 42 });
    expect(base.filas.get("f1")).toMatchObject({ status: "AUTORIZADA", numero: 42 });
  });

  it("dos facturas seguidas salen correlativas", async () => {
    const { base, puerto } = armar();
    base.agregar("a");
    base.agregar("b");
    await emitir(base, puerto, "a", AHORA);
    await emitir(base, puerto, "b", AHORA);
    expect([base.filas.get("a")!.numero, base.filas.get("b")!.numero]).toEqual([1, 2]);
  });

  it("un rechazo libera el número", async () => {
    const { arca, base, puerto } = armar();
    arca.modo = "RECHAZA";
    base.agregar("f1");
    const r = await emitir(base, puerto, "f1", AHORA);
    expect(r.estado).toBe("RECHAZADA");
    expect(base.filas.get("f1")).toMatchObject({ status: "RECHAZADA", numero: null });
    arca.modo = "NORMAL";
    base.agregar("f2");
    expect(await emitir(base, puerto, "f2", AHORA)).toMatchObject({ estado: "AUTORIZADA", numero: 1 });
  });

  it("no emite dos veces el mismo borrador (doble clic)", async () => {
    const { base, puerto } = armar();
    base.agregar("f1");
    await emitir(base, puerto, "f1", AHORA);
    expect(await emitir(base, puerto, "f1", AHORA)).toMatchObject({ estado: "NO_ENVIADA" });
  });

  it("si FOTOFFICE tiene un número más alto que ARCA, frena (ambiente o punto de venta cruzado)", async () => {
    const { base, puerto } = armar();
    base.agregar("vieja");
    Object.assign(base.filas.get("vieja")!, { status: "AUTORIZADA", numero: 10 });
    base.agregar("f1");
    const r = await emitir(base, puerto, "f1", AHORA);
    expect(r.estado).toBe("NO_ENVIADA");
    expect(base.filas.get("f1")!.status).toBe("BORRADOR");
  });

  describe("corte por tiempo de espera", () => {
    it("ARCA autorizó pero la respuesta no llegó: queda PENDIENTE y bloquea la serie", async () => {
      const { arca, base, puerto } = armar();
      arca.modo = "AUTORIZA_Y_SE_CORTA";
      base.agregar("f1");
      const r = await emitir(base, puerto, "f1", AHORA);
      expect(r).toMatchObject({ estado: "PENDIENTE", numero: 1 });
      expect(base.filas.get("f1")).toMatchObject({ status: "PENDIENTE", numero: 1 });

      // Nadie toma el número siguiente mientras tanto (y ARCA ni se entera).
      arca.modo = "NORMAL";
      base.agregar("f2");
      const llamadas = arca.llamadasCae;
      const bloqueada = await emitir(base, puerto, "f2", AHORA);
      expect(bloqueada.estado).toBe("NO_ENVIADA");
      expect(arca.llamadasCae).toBe(llamadas);
      expect(base.filas.get("f2")!.status).toBe("BORRADOR");
    });

    it("la conciliación encuentra el CAE en ARCA y después la serie sigue en orden", async () => {
      const { arca, base, puerto } = armar();
      arca.modo = "AUTORIZA_Y_SE_CORTA";
      base.agregar("f1");
      await emitir(base, puerto, "f1", AHORA);
      arca.modo = "NORMAL";
      const c = await conciliar(base, puerto, (await base.leer("f1"))!, DESPUES);
      expect(c.estado).toBe("AUTORIZADA");
      expect(base.filas.get("f1")).toMatchObject({ status: "AUTORIZADA", numero: 1 });
      base.agregar("f2");
      expect(await emitir(base, puerto, "f2", DESPUES)).toMatchObject({ estado: "AUTORIZADA", numero: 2 });
    });

    it("se cortó antes de que ARCA lo procesara: la conciliación lo devuelve a borrador y se vuelve a emitir con el mismo número", async () => {
      const { arca, base, puerto } = armar();
      arca.modo = "SE_CORTA_SIN_PROCESAR";
      base.agregar("f1");
      expect((await emitir(base, puerto, "f1", AHORA)).estado).toBe("PENDIENTE");
      arca.modo = "NORMAL";
      expect((await conciliar(base, puerto, (await base.leer("f1"))!, DESPUES)).estado).toBe("BORRADOR");
      expect(base.filas.get("f1")).toMatchObject({ status: "BORRADOR", numero: null });
      expect(await emitir(base, puerto, "f1", DESPUES)).toMatchObject({ estado: "AUTORIZADA", numero: 1 });
    });

    it("emitir otro concilia solo el pendiente que ya puede conciliarse", async () => {
      const { arca, base, puerto } = armar();
      arca.modo = "AUTORIZA_Y_SE_CORTA";
      base.agregar("f1");
      await emitir(base, puerto, "f1", AHORA);
      arca.modo = "NORMAL";
      base.agregar("f2");
      expect(await emitir(base, puerto, "f2", DESPUES)).toMatchObject({ estado: "AUTORIZADA", numero: 2 });
      expect(base.filas.get("f1")).toMatchObject({ status: "AUTORIZADA", numero: 1 });
    });

    it("no concilia antes de tiempo: ARCA puede estar procesándolo", async () => {
      const { arca, base, puerto } = armar();
      arca.modo = "SE_CORTA_SIN_PROCESAR";
      base.agregar("f1");
      await emitir(base, puerto, "f1", AHORA);
      expect((await conciliar(base, puerto, (await base.leer("f1"))!, new Date(AHORA.getTime() + 1000))).estado).toBe("ESPERAR");
      expect(base.filas.get("f1")!.status).toBe("PENDIENTE");
    });

    it("un error 500 del servidor tampoco se toma como rechazo", async () => {
      const { arca, base, puerto } = armar();
      arca.modo = "FALLA_SERVIDOR";
      base.agregar("f1");
      expect((await emitir(base, puerto, "f1", AHORA)).estado).toBe("PENDIENTE");
    });

    it("si ARCA tiene ese número con otros datos, queda frenado para revisión a mano", async () => {
      const { arca, base, puerto } = armar();
      arca.modo = "SE_CORTA_SIN_PROCESAR";
      base.agregar("f1");
      await emitir(base, puerto, "f1", AHORA);
      // Mientras tanto alguien emitió el 1 desde otro sistema, con otro importe.
      arca.ultimo.set("3-11", 1);
      arca.autorizados.set("3-11-1", { fecha: "20261025", total: "99.00", docTipo: "99", docNro: "0", cae: "76111111111111" });
      arca.modo = "NORMAL";
      expect((await conciliar(base, puerto, (await base.leer("f1"))!, DESPUES)).estado).toBe("DESCUADRE");
      expect(base.filas.get("f1")).toMatchObject({ status: "PENDIENTE", numero: 1 });
      expect(base.filas.get("f1")!.eventos).toContain("DESCUADRE");
    });
  });
});
