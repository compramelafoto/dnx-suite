import type { KeyObject } from "node:crypto";
import { firmarCms } from "./cms";
import { leerFault, type Transporte } from "./soap";
import { block, el, text, unescapeXml } from "./xml";

/**
 * WSAA: el servicio de autenticación. Se le manda el pedido de acceso (TRA) firmado en CMS y
 * devuelve un ticket (token + sign) que vale doce horas. Módulo PURO salvo por el transporte,
 * que se inyecta.
 */

/** Fecha y hora con el huso de Argentina (UTC−3, sin horario de verano): "2026-10-25T11:50:00-03:00". */
export function isoArgentina(d: Date): string {
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return ar.toISOString().replace(/\.\d{3}Z$/, "-03:00");
}

/** El TRA. Diez minutos de margen para cada lado, por si el reloj del servidor no está exacto. */
export function construirTra(servicio: string, ahora: Date): string {
  const desde = new Date(ahora.getTime() - 10 * 60 * 1000);
  const hasta = new Date(ahora.getTime() + 10 * 60 * 1000);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<loginTicketRequest version="1.0"><header>' +
    el("uniqueId", Math.floor(ahora.getTime() / 1000) % 4294967296) +
    el("generationTime", isoArgentina(desde)) +
    el("expirationTime", isoArgentina(hasta)) +
    "</header>" +
    el("service", servicio) +
    "</loginTicketRequest>"
  );
}

export function sobreLoginCms(cmsBase64: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
    "<soapenv:Header/><soapenv:Body><wsaa:loginCms>" +
    el("wsaa:in0", cmsBase64) +
    "</wsaa:loginCms></soapenv:Body></soapenv:Envelope>"
  );
}

export type Ticket = { token: string; sign: string; generationTime: Date; expirationTime: Date };

export type RespuestaLogin =
  | { ok: true; ticket: Ticket }
  /** ARCA ya entregó un ticket vigente para este certificado y servicio, y no da otro. */
  | { ok: false; motivo: "YA_AUTENTICADO"; mensaje: string }
  | { ok: false; motivo: "ERROR"; mensaje: string };

/** Lee la respuesta de `loginCms`: el ticket viene como XML escapado adentro del SOAP. */
export function leerRespuestaLogin(xml: string): RespuestaLogin {
  const fault = leerFault(xml);
  if (fault) {
    if (/alreadyAuthenticated/i.test(fault.code)) return { ok: false, motivo: "YA_AUTENTICADO", mensaje: fault.message };
    return { ok: false, motivo: "ERROR", mensaje: `${fault.message}${fault.code ? ` (${fault.code})` : ""}` };
  }
  const ret = block(xml, "loginCmsReturn");
  if (ret === null) return { ok: false, motivo: "ERROR", mensaje: "ARCA devolvió una respuesta que no se entiende." };
  const ticketXml = unescapeXml(ret);
  const token = text(ticketXml, "token");
  const sign = text(ticketXml, "sign");
  const gen = text(ticketXml, "generationTime");
  const exp = text(ticketXml, "expirationTime");
  const generationTime = gen ? new Date(gen) : null;
  const expirationTime = exp ? new Date(exp) : null;
  if (!token || !sign || !generationTime || !expirationTime || isNaN(expirationTime.getTime()) || isNaN(generationTime.getTime())) {
    return { ok: false, motivo: "ERROR", mensaje: "El ticket de ARCA vino incompleto." };
  }
  return { ok: true, ticket: { token, sign, generationTime, expirationTime } };
}

/** Pide un ticket nuevo. */
export async function pedirTicket(args: {
  transporte: Transporte;
  url: string;
  servicio: string;
  certPem: string;
  privateKey: KeyObject;
  ahora: Date;
}): Promise<RespuestaLogin> {
  const tra = construirTra(args.servicio, args.ahora);
  const cms = firmarCms(Buffer.from(tra, "utf8"), args.certPem, args.privateKey, args.ahora);
  const r = await args.transporte(args.url, "", sobreLoginCms(cms.toString("base64")));
  if (!r.ok) return { ok: false, motivo: "ERROR", mensaje: r.detalle };
  return leerRespuestaLogin(r.body);
}
