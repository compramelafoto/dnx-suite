import { CONCILIAR_DESPUES_MS, type CbteTipo } from "./constants";
import { pedidoComoJson, type DatosComprobante } from "./pedido";
import type { ComprobanteConsultado, Consulta, MensajeArca, RespuestaCae, UltimoAutorizado } from "./wsfe";

/**
 * La numeración y la conciliación (§11.4c). Es la parte peligrosa del módulo, así que es PURA:
 * la base y ARCA entran como puertos y las pruebas la ejercitan con un ARCA simulado.
 *
 * Las reglas, sin excepción:
 * 1. El comprobante se guarda PENDIENTE con su número ANTES de llamar a ARCA.
 * 2. La respuesta, la que sea, se guarda cruda.
 * 3. Sin respuesta, queda PENDIENTE, y nadie toma el número siguiente de ese punto de venta y
 *    tipo hasta conciliar con `FECompUltimoAutorizado` y `FECompConsultar`.
 */

export type Serie = { ptoVta: number; cbteTipo: CbteTipo };

export type ComprobanteEnBase = {
  id: string;
  status: string;
  serie: Serie;
  numero: number | null;
  /** Cuándo salió el pedido a ARCA (sólo en PENDIENTE). */
  enviadoEn: Date | null;
  /** Los datos del comprobante sin el número, que lo pone la emisión. */
  datos: Omit<DatosComprobante, "numero">;
};

export type PuertoBase = {
  leer(id: string): Promise<ComprobanteEnBase | null>;
  /** Los PENDIENTES de esa serie (mismo workspace y ambiente: el puerto ya viene atado a ellos). */
  pendientesDeLaSerie(serie: Serie): Promise<ComprobanteEnBase[]>;
  /** El número más alto que FOTOFFICE tiene autorizado en esa serie (0 si ninguno). */
  mayorNumeroAutorizado(serie: Serie): Promise<number>;
  /**
   * BORRADOR → PENDIENTE con el número y el pedido crudo, en una sola escritura condicionada al
   * estado. `false` si otro ya lo tomó (doble clic) o si el número ya está usado (índice único).
   */
  reservarNumero(id: string, numero: number, pedidoJson: unknown, ahora: Date): Promise<boolean>;
  marcarAutorizada(id: string, r: { cae: string; caeVto: string; respuestaJson: unknown; nota: string }): Promise<void>;
  /** ARCA dijo que no: el número no se usó y se libera. */
  marcarRechazada(id: string, r: { respuestaJson: unknown; nota: string }): Promise<void>;
  /** PENDIENTE → BORRADOR sin número: la conciliación probó que ARCA nunca lo autorizó. */
  volverABorrador(id: string, nota: string): Promise<void>;
  /** Deja constancia (evento) sin cambiar el estado. */
  anotar(id: string, tipo: string, nota: string, respuestaJson?: unknown): Promise<void>;
};

export type PuertoArca = {
  ultimoAutorizado(serie: Serie): Promise<UltimoAutorizado | { ok: false; sinRespuesta: true; mensaje: string }>;
  consultar(serie: Serie, numero: number): Promise<Consulta | { ok: false; sinRespuesta: true; mensaje: string }>;
  solicitarCae(d: DatosComprobante): Promise<{ respuesta: RespuestaCae; xml: string | null }>;
};

export type ResultadoEmision =
  | { estado: "AUTORIZADA"; numero: number; cae: string; caeVto: string; observaciones: MensajeArca[] }
  | { estado: "RECHAZADA"; mensajes: MensajeArca[] }
  /** Salió y no se sabe qué pasó: queda PENDIENTE hasta conciliar. */
  | { estado: "PENDIENTE"; numero: number; detalle: string }
  /** No se mandó nada a ARCA. El comprobante sigue como estaba. */
  | { estado: "NO_ENVIADA"; error: string };

export type ResultadoConciliacion =
  | { estado: "AUTORIZADA"; cae: string }
  | { estado: "BORRADOR" }
  | { estado: "ESPERAR"; detalle: string }
  | { estado: "SIN_RESPUESTA"; detalle: string }
  | { estado: "DESCUADRE"; detalle: string };

function textoMensajes(m: MensajeArca[]): string {
  return m.map((x) => (x.code ? `${x.code}: ${x.msg}` : x.msg)).join(" · ");
}

/** ¿Lo que ARCA tiene con ese número es nuestro comprobante? */
export function coincide(nuestro: ComprobanteEnBase, arca: ComprobanteConsultado): boolean {
  return (
    arca.resultado === "A" &&
    arca.fecha === nuestro.datos.fecha &&
    arca.totalCentavos === nuestro.datos.totalCentavos &&
    arca.docTipo === nuestro.datos.docTipo &&
    String(Number(arca.docNro)) === String(Number(nuestro.datos.docNro))
  );
}

/** Concilia un comprobante PENDIENTE contra ARCA. */
export async function conciliar(base: PuertoBase, arca: PuertoArca, c: ComprobanteEnBase, ahora: Date): Promise<ResultadoConciliacion> {
  if (c.status !== "PENDIENTE" || c.numero === null) return { estado: "DESCUADRE", detalle: "El comprobante no está esperando respuesta." };
  if (c.enviadoEn && ahora.getTime() - c.enviadoEn.getTime() < CONCILIAR_DESPUES_MS) {
    return { estado: "ESPERAR", detalle: "ARCA puede estar todavía procesándolo. Probá de nuevo en un par de minutos." };
  }
  const ult = await arca.ultimoAutorizado(c.serie);
  if (!ult.ok) {
    const detalle = "sinRespuesta" in ult ? ult.mensaje : textoMensajes(ult.errores);
    return { estado: "SIN_RESPUESTA", detalle };
  }
  if (ult.numero < c.numero) {
    // ARCA nunca llegó a ese número: el pedido no se autorizó. Se libera y vuelve a borrador.
    await base.volverABorrador(c.id, `Conciliado: ARCA tiene autorizado hasta el ${ult.numero}; el ${c.numero} nunca se autorizó.`);
    return { estado: "BORRADOR" };
  }
  const q = await arca.consultar(c.serie, c.numero);
  if (!q.ok) {
    if ("sinRespuesta" in q) return { estado: "SIN_RESPUESTA", detalle: q.mensaje };
    const detalle = `ARCA tiene autorizado hasta el ${ult.numero} pero no encuentra el ${c.numero}: ${textoMensajes(q.errores)}`;
    await base.anotar(c.id, "DESCUADRE", detalle, q);
    return { estado: "DESCUADRE", detalle };
  }
  if (!coincide(c, q.comprobante) || !q.comprobante.cae || !q.comprobante.caeVto) {
    const detalle = `ARCA tiene el número ${c.numero} autorizado con otros datos. Hay que revisarlo a mano antes de emitir otro.`;
    await base.anotar(c.id, "DESCUADRE", detalle, q.comprobante);
    return { estado: "DESCUADRE", detalle };
  }
  await base.marcarAutorizada(c.id, {
    cae: q.comprobante.cae,
    caeVto: q.comprobante.caeVto,
    respuestaJson: { conciliado: true, FECompConsultar: q.comprobante },
    nota: "Conciliado: ARCA lo había autorizado aunque la respuesta no llegó.",
  });
  return { estado: "AUTORIZADA", cae: q.comprobante.cae };
}

/** Emite un comprobante en BORRADOR. */
export async function emitir(base: PuertoBase, arca: PuertoArca, id: string, ahora: Date = new Date()): Promise<ResultadoEmision> {
  const c = await base.leer(id);
  if (!c) return { estado: "NO_ENVIADA", error: "No encontramos ese comprobante." };
  if (c.status !== "BORRADOR") return { estado: "NO_ENVIADA", error: "Ese comprobante ya se emitió o se está emitiendo." };

  // Regla 3: antes de tomar un número, no puede quedar nada colgado en la serie.
  for (const p of await base.pendientesDeLaSerie(c.serie)) {
    const r = await conciliar(base, arca, p, ahora);
    if (r.estado !== "AUTORIZADA" && r.estado !== "BORRADOR") {
      return {
        estado: "NO_ENVIADA",
        error: `Hay un comprobante anterior (número ${p.numero}) esperando la respuesta de ARCA. Hasta conciliarlo no se puede emitir otro. ${r.detalle}`,
      };
    }
  }

  const ult = await arca.ultimoAutorizado(c.serie);
  if (!ult.ok) {
    const detalle = "sinRespuesta" in ult ? ult.mensaje : textoMensajes(ult.errores);
    return { estado: "NO_ENVIADA", error: `No se pudo consultar el último número en ARCA. ${detalle}` };
  }
  const propio = await base.mayorNumeroAutorizado(c.serie);
  if (propio > ult.numero) {
    return {
      estado: "NO_ENVIADA",
      error: `ARCA dice que el último comprobante es el ${ult.numero}, pero FOTOFFICE ya tiene el ${propio}. Revisá el punto de venta y el ambiente antes de seguir.`,
    };
  }

  const numero = ult.numero + 1;
  const datos: DatosComprobante = { ...c.datos, numero };
  // Regla 1: queda PENDIENTE con su número antes de salir.
  if (!(await base.reservarNumero(c.id, numero, pedidoComoJson(datos), ahora))) {
    return { estado: "NO_ENVIADA", error: "Se está emitiendo otro comprobante en este momento. Probá de nuevo en unos segundos." };
  }

  const { respuesta, xml } = await arca.solicitarCae(datos);
  // Regla 2: la respuesta cruda se guarda siempre.
  if (respuesta.tipo === "AUTORIZADO") {
    await base.marcarAutorizada(c.id, {
      cae: respuesta.cae,
      caeVto: respuesta.caeVto,
      respuestaJson: { xml, observaciones: respuesta.observaciones, reproceso: respuesta.reproceso },
      nota: respuesta.observaciones.length ? `Autorizada con observaciones: ${textoMensajes(respuesta.observaciones)}` : "Autorizada por ARCA.",
    });
    return { estado: "AUTORIZADA", numero, cae: respuesta.cae, caeVto: respuesta.caeVto, observaciones: respuesta.observaciones };
  }
  if (respuesta.tipo === "RECHAZADO") {
    const todos = [...respuesta.errores, ...respuesta.observaciones];
    await base.marcarRechazada(c.id, { respuestaJson: { xml, errores: respuesta.errores, observaciones: respuesta.observaciones }, nota: textoMensajes(todos) });
    return { estado: "RECHAZADA", mensajes: todos };
  }
  // Regla 3: sin certeza, queda PENDIENTE.
  await base.anotar(c.id, "SIN_RESPUESTA", respuesta.detalle, { xml });
  return { estado: "PENDIENTE", numero, detalle: respuesta.detalle };
}
