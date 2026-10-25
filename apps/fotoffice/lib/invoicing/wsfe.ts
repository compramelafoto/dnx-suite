import { authXml, NS_WSFE, sobreFecaeSolicitar, sobreWsfe, type Auth, type DatosComprobante } from "./pedido";
import { leerFault, type Transporte } from "./soap";
import { block, blocks, el, text } from "./xml";

/**
 * WSFEv1: las operaciones que usa FOTOFFICE y la lectura de sus respuestas. Módulo PURO salvo
 * por el transporte, que se inyecta.
 */

export type MensajeArca = { code: string; msg: string };

function mensajes(xml: string | null, contenedor: string, item: string): MensajeArca[] {
  if (!xml) return [];
  const c = block(xml, contenedor);
  if (c === null) return [];
  return blocks(c, item).map((b) => ({ code: text(b, "Code") ?? "", msg: text(b, "Msg") ?? "" }));
}

// --- FEDummy ---------------------------------------------------------------------------------

export type EstadoServidores = { app: string; db: string; auth: string };

export function leerFeDummy(xml: string): EstadoServidores | null {
  const r = block(xml, "FEDummyResult");
  if (r === null) return null;
  return { app: text(r, "AppServer") ?? "", db: text(r, "DbServer") ?? "", auth: text(r, "AuthServer") ?? "" };
}

// --- FECompUltimoAutorizado -----------------------------------------------------------------

export type UltimoAutorizado = { ok: true; numero: number } | { ok: false; errores: MensajeArca[] };

export function leerUltimoAutorizado(xml: string): UltimoAutorizado {
  const r = block(xml, "FECompUltimoAutorizadoResult");
  if (r === null) return { ok: false, errores: [{ code: "", msg: "ARCA devolvió una respuesta que no se entiende." }] };
  const errores = mensajes(r, "Errors", "Err");
  const nro = text(r, "CbteNro");
  if (errores.length > 0 || nro === null || !/^\d+$/.test(nro)) {
    return { ok: false, errores: errores.length ? errores : [{ code: "", msg: "Falta el último número autorizado." }] };
  }
  return { ok: true, numero: Number(nro) };
}

// --- FECompConsultar ------------------------------------------------------------------------

export type ComprobanteConsultado = {
  numero: number;
  fecha: string;
  docTipo: number;
  docNro: string;
  totalCentavos: number;
  resultado: string;
  cae: string | null;
  caeVto: string | null;
};

export type Consulta =
  | { ok: true; comprobante: ComprobanteConsultado }
  /** ARCA dice que ese número no existe (código 602). */
  | { ok: false; noExiste: true; errores: MensajeArca[] }
  | { ok: false; noExiste: false; errores: MensajeArca[] };

function centavos(s: string | null): number {
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  const [ent, dec = ""] = s.split(".");
  return Number(ent) * 100 + Number((dec + "00").slice(0, 2));
}

export function leerConsulta(xml: string): Consulta {
  const r = block(xml, "FECompConsultarResult");
  if (r === null) return { ok: false, noExiste: false, errores: [{ code: "", msg: "ARCA devolvió una respuesta que no se entiende." }] };
  const errores = mensajes(r, "Errors", "Err");
  const g = block(r, "ResultGet");
  if (g === null) return { ok: false, noExiste: errores.some((e) => e.code === "602"), errores };
  const numero = Number(text(g, "CbteDesde"));
  return {
    ok: true,
    comprobante: {
      numero,
      fecha: text(g, "CbteFch") ?? "",
      docTipo: Number(text(g, "DocTipo")),
      docNro: text(g, "DocNro") ?? "",
      totalCentavos: centavos(text(g, "ImpTotal")),
      resultado: text(g, "Resultado") ?? "",
      cae: text(g, "CodAutorizacion") || null,
      caeVto: text(g, "FchVto") || null,
    },
  };
}

// --- FECAESolicitar -------------------------------------------------------------------------

export type RespuestaCae =
  | { tipo: "AUTORIZADO"; cae: string; caeVto: string; observaciones: MensajeArca[]; reproceso: boolean }
  /** ARCA contestó y dijo que no: el número no se usó. */
  | { tipo: "RECHAZADO"; observaciones: MensajeArca[]; errores: MensajeArca[] }
  /** Respondió algo que no permite saber si autorizó. Se trata igual que sin respuesta. */
  | { tipo: "INCIERTO"; detalle: string };

export function leerRespuestaCae(xml: string): RespuestaCae {
  const r = block(xml, "FECAESolicitarResult");
  if (r === null) {
    const fault = leerFault(xml);
    return { tipo: "INCIERTO", detalle: fault ? fault.message : "ARCA devolvió una respuesta que no se entiende." };
  }
  const errores = mensajes(r, "Errors", "Err");
  const det = block(r, "FECAEDetResponse");
  const observaciones = mensajes(det, "Observaciones", "Obs");
  const cab = block(r, "FeCabResp");
  const resultadoDet = det ? text(det, "Resultado") : null;
  const resultado = resultadoDet ?? (cab ? text(cab, "Resultado") : null);
  const cae = det ? text(det, "CAE") : null;
  const caeVto = det ? text(det, "CAEFchVto") : null;
  if (resultado === "A" && cae && /^\d{14}$/.test(cae) && caeVto && /^\d{8}$/.test(caeVto)) {
    return { tipo: "AUTORIZADO", cae, caeVto, observaciones, reproceso: (cab ? text(cab, "Reproceso") : null) === "S" };
  }
  if (resultado === "R" || (!det && errores.length > 0)) {
    return { tipo: "RECHAZADO", observaciones, errores };
  }
  return { tipo: "INCIERTO", detalle: "ARCA no confirmó ni rechazó el comprobante." };
}

// --- Cliente --------------------------------------------------------------------------------

export type ClienteWsfe = {
  dummy(): Promise<{ ok: true; estado: EstadoServidores } | { ok: false; mensaje: string }>;
  ultimoAutorizado(auth: Auth, ptoVta: number, cbteTipo: number): Promise<UltimoAutorizado | { ok: false; sinRespuesta: true; mensaje: string }>;
  consultar(auth: Auth, ptoVta: number, cbteTipo: number, numero: number): Promise<Consulta | { ok: false; sinRespuesta: true; mensaje: string }>;
  /** `xml` es la respuesta cruda (o null si no hubo), para guardarla tal cual. */
  solicitarCae(auth: Auth, d: DatosComprobante): Promise<{ respuesta: RespuestaCae; xml: string | null }>;
};

export function crearClienteWsfe(url: string, transporte: Transporte): ClienteWsfe {
  const accion = (op: string) => `${NS_WSFE}${op}`;
  return {
    async dummy() {
      const r = await transporte(url, accion("FEDummy"), sobreWsfe("FEDummy", ""));
      if (!r.ok) return { ok: false, mensaje: r.detalle };
      const estado = leerFeDummy(r.body);
      return estado ? { ok: true, estado } : { ok: false, mensaje: leerFault(r.body)?.message ?? "Respuesta inesperada de ARCA." };
    },
    async ultimoAutorizado(auth, ptoVta, cbteTipo) {
      const cuerpo = authXml(auth) + el("ar:PtoVta", ptoVta) + el("ar:CbteTipo", cbteTipo);
      const r = await transporte(url, accion("FECompUltimoAutorizado"), sobreWsfe("FECompUltimoAutorizado", cuerpo));
      if (!r.ok) return { ok: false, sinRespuesta: true, mensaje: r.detalle };
      return leerUltimoAutorizado(r.body);
    },
    async consultar(auth, ptoVta, cbteTipo, numero) {
      const cuerpo =
        authXml(auth) +
        "<ar:FeCompConsReq>" +
        el("ar:CbteTipo", cbteTipo) +
        el("ar:CbteNro", numero) +
        el("ar:PtoVta", ptoVta) +
        "</ar:FeCompConsReq>";
      const r = await transporte(url, accion("FECompConsultar"), sobreWsfe("FECompConsultar", cuerpo));
      if (!r.ok) return { ok: false, sinRespuesta: true, mensaje: r.detalle };
      return leerConsulta(r.body);
    },
    async solicitarCae(auth, d) {
      const r = await transporte(url, accion("FECAESolicitar"), sobreFecaeSolicitar(auth, d));
      if (!r.ok) return { respuesta: { tipo: "INCIERTO", detalle: r.detalle }, xml: null };
      return { respuesta: leerRespuestaCae(r.body), xml: r.body };
    },
  };
}

/** El puerto de ARCA que usa la emisión, con el ticket ya puesto. */
export function puertoArca(cliente: ClienteWsfe, auth: Auth) {
  return {
    ultimoAutorizado: (s: { ptoVta: number; cbteTipo: number }) => cliente.ultimoAutorizado(auth, s.ptoVta, s.cbteTipo),
    consultar: (s: { ptoVta: number; cbteTipo: number }, numero: number) => cliente.consultar(auth, s.ptoVta, s.cbteTipo, numero),
    solicitarCae: (d: DatosComprobante) => cliente.solicitarCae(auth, d),
  };
}
