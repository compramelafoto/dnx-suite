import { describe, expect, it } from "vitest";
import { CBTE_FACTURA_C, CBTE_NOTA_CREDITO_C } from "./constants";
import {
  cuitValido,
  detalleXml,
  fechaArca,
  importe,
  pedidoComoJson,
  sobreFecaeSolicitar,
  validarComprobante,
  type DatosComprobante,
} from "./pedido";
import { cargaQr, urlQr } from "./qr";
import { construirTra, isoArgentina, leerRespuestaLogin, sobreLoginCms } from "./wsaa";
import { leerConsulta, leerFeDummy, leerRespuestaCae, leerUltimoAutorizado } from "./wsfe";
import { block, text, unescapeXml } from "./xml";

// --- Respuestas de ejemplo, con la forma de las del manual del desarrollador -------------------

const LOGIN_OK = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <soapenv:Body>
  <loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov">
   <loginCmsReturn>&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot; standalone=&quot;yes&quot;?&gt;
&lt;loginTicketResponse version=&quot;1.0&quot;&gt;
    &lt;header&gt;
        &lt;source&gt;CN=wsaahomo, O=AFIP, C=AR, SERIALNUMBER=CUIT 33693450239&lt;/source&gt;
        &lt;destination&gt;SERIALNUMBER=CUIT 20123456786, CN=fotoffice&lt;/destination&gt;
        &lt;uniqueId&gt;3712345678&lt;/uniqueId&gt;
        &lt;generationTime&gt;2026-10-25T11:50:01.123-03:00&lt;/generationTime&gt;
        &lt;expirationTime&gt;2026-10-25T23:50:01.123-03:00&lt;/expirationTime&gt;
    &lt;/header&gt;
    &lt;credentials&gt;
        &lt;token&gt;PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8c3NvIHZlcnNpb249IjIuMCI+&lt;/token&gt;
        &lt;sign&gt;Xk3l0nH1W8f7Qd+Z2a/9w==&lt;/sign&gt;
    &lt;/credentials&gt;
&lt;/loginTicketResponse&gt;
</loginCmsReturn>
  </loginCmsResponse>
 </soapenv:Body>
</soapenv:Envelope>`;

const LOGIN_YA_AUTENTICADO = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault>
<faultcode xmlns:ns1="http://xml.apache.org/axis/">ns1:coe.alreadyAuthenticated</faultcode>
<faultstring>El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring>
<detail><ns2:exceptionName xmlns:ns2="http://xml.apache.org/axis/">gov.afip.desein.dvadac.sua.view.wsaa.LoginFault</ns2:exceptionName></detail>
</soapenv:Fault></soapenv:Body></soapenv:Envelope>`;

const LOGIN_CMS_INVALIDO = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault>
<faultcode>ns1:cms.cert.untrusted</faultcode><faultstring>Certificado no emitido por AC de confianza</faultstring>
</soapenv:Fault></soapenv:Body></soapenv:Envelope>`;

const DUMMY = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<FEDummyResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FEDummyResult><AppServer>OK</AppServer><DbServer>OK</DbServer><AuthServer>OK</AuthServer></FEDummyResult></FEDummyResponse>
</soap:Body></soap:Envelope>`;

const ULTIMO = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><CbteNro>41</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>
</soap:Body></soap:Envelope>`;

const ULTIMO_TOKEN_VENCIDO = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><CbteNro>0</CbteNro>
<Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No validaron las fechas del token GenTime, ExpTime, NowUTC: 1761400000 (10/25/2026 2:50:00 PM), 1761443200 (10/26/2026 2:50:00 AM), 10/26/2026 3:10:00 AM</Msg></Err></Errors>
</FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse></soap:Body></soap:Envelope>`;

const CAE_OK = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body>
<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>
<FeCabResp><Cuit>20123456786</Cuit><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><FchProceso>20261025120533</FchProceso><CantReg>1</CantReg><Resultado>A</Resultado><Reproceso>N</Reproceso></FeCabResp>
<FeDetResp><FECAEDetResponse><Concepto>1</Concepto><DocTipo>99</DocTipo><DocNro>0</DocNro><CbteDesde>42</CbteDesde><CbteHasta>42</CbteHasta><CbteFch>20261025</CbteFch><Resultado>A</Resultado><CAE>76432109876543</CAE><CAEFchVto>20261104</CAEFchVto></FECAEDetResponse></FeDetResp>
<Events><Evt><Code>40</Code><Msg>Recuerde que a partir del 1/4/2025 es obligatorio informar la condicion frente al IVA del receptor.</Msg></Evt></Events>
</FECAESolicitarResult></FECAESolicitarResponse></soap:Body></soap:Envelope>`;

const CAE_RECHAZO = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>
<FeCabResp><Cuit>20123456786</Cuit><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><FchProceso>20261025120533</FchProceso><CantReg>1</CantReg><Resultado>R</Resultado><Reproceso>N</Reproceso></FeCabResp>
<FeDetResp><FECAEDetResponse><Concepto>1</Concepto><DocTipo>96</DocTipo><DocNro>123</DocNro><CbteDesde>42</CbteDesde><CbteHasta>42</CbteHasta><CbteFch>20261025</CbteFch><Resultado>R</Resultado>
<Observaciones><Obs><Code>10015</Code><Msg>Factura B/C: si ImpTotal es mayor o igual al limite DocTipo debe ser distinto de 99.</Msg></Obs><Obs><Code>10246</Code><Msg>El campo Condicion Frente al IVA del receptor es obligatorio.</Msg></Obs></Observaciones>
<CAE/><CAEFchVto/></FECAEDetResponse></FeDetResp>
</FECAESolicitarResult></FECAESolicitarResponse></soap:Body></soap:Envelope>`;

const CAE_ERRORS = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>
<Errors><Err><Code>10016</Code><Msg>El numero o fecha del comprobante no se corresponde con el proximo a autorizar. Consultar metodo FECompUltimoAutorizado.</Msg></Err></Errors>
</FECAESolicitarResult></FECAESolicitarResponse></soap:Body></soap:Envelope>`;

const SERVER_FAULT = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Server was unable to process request.</faultstring></soap:Fault></soap:Body></soap:Envelope>`;

const CONSULTA_OK = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompConsultarResult><ResultGet>
<Concepto>1</Concepto><DocTipo>99</DocTipo><DocNro>0</DocNro><CbteDesde>42</CbteDesde><CbteHasta>42</CbteHasta><CbteFch>20261025</CbteFch><ImpTotal>15000.5</ImpTotal><ImpTotConc>0</ImpTotConc><ImpNeto>15000.5</ImpNeto><ImpOpEx>0</ImpOpEx><ImpTrib>0</ImpTrib><ImpIVA>0</ImpIVA><MonId>PES</MonId><MonCotiz>1</MonCotiz>
<Resultado>A</Resultado><CodAutorizacion>76432109876543</CodAutorizacion><EmisionTipo>CAE</EmisionTipo><FchVto>20261104</FchVto><FchProceso>20261025120533</FchProceso><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo>
</ResultGet></FECompConsultarResult></FECompConsultarResponse></soap:Body></soap:Envelope>`;

const CONSULTA_NO_EXISTE = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompConsultarResult>
<Errors><Err><Code>602</Code><Msg>No existen datos en nuestros registros para los parametros ingresados.</Msg></Err></Errors>
</FECompConsultarResult></FECompConsultarResponse></soap:Body></soap:Envelope>`;

describe("xml", () => {
  it("lee etiquetas con y sin prefijo, y auto-cerradas", () => {
    expect(text("<a:X>1</a:X>", "X")).toBe("1");
    expect(text("<X attr='y'> 2 </X>", "X")).toBe("2");
    expect(text("<X/>", "X")).toBe("");
    expect(block("<Y>1</Y>", "X")).toBeNull();
  });
  it("desescapa sólo entidades XML", () => {
    expect(unescapeXml("&lt;a&gt; &amp;amp; &#65;&#x42; &nbsp;")).toBe("<a> &amp; AB &nbsp;");
  });
});

describe("WSAA", () => {
  it("arma el TRA con hora argentina y diez minutos de margen", () => {
    const tra = construirTra("wsfe", new Date("2026-10-25T15:00:00Z"));
    expect(tra).toContain("<generationTime>2026-10-25T11:50:00-03:00</generationTime>");
    expect(tra).toContain("<expirationTime>2026-10-25T12:10:00-03:00</expirationTime>");
    expect(tra).toContain("<service>wsfe</service>");
    expect(isoArgentina(new Date("2026-01-01T02:00:00Z"))).toBe("2025-12-31T23:00:00-03:00");
  });
  it("el sobre lleva el CMS en base64", () => {
    expect(sobreLoginCms("QUJD")).toContain("<wsaa:in0>QUJD</wsaa:in0>");
  });
  it("lee un ticket aprobado", () => {
    const r = leerRespuestaLogin(LOGIN_OK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ticket.sign).toBe("Xk3l0nH1W8f7Qd+Z2a/9w==");
    expect(r.ticket.token.startsWith("PD94")).toBe(true);
    expect(r.ticket.expirationTime.toISOString()).toBe("2026-10-26T02:50:01.123Z");
  });
  it("distingue el ticket todavía vigente de otros errores", () => {
    expect(leerRespuestaLogin(LOGIN_YA_AUTENTICADO)).toMatchObject({ ok: false, motivo: "YA_AUTENTICADO" });
    const r = leerRespuestaLogin(LOGIN_CMS_INVALIDO);
    expect(r).toMatchObject({ ok: false, motivo: "ERROR" });
    if (!r.ok) expect(r.mensaje).toContain("Certificado no emitido");
  });
  it("una respuesta sin ticket es un error, no un ticket vacío", () => {
    expect(leerRespuestaLogin("<html>502</html>")).toMatchObject({ ok: false, motivo: "ERROR" });
  });
});

describe("WSFEv1: respuestas", () => {
  it("FEDummy", () => {
    expect(leerFeDummy(DUMMY)).toEqual({ app: "OK", db: "OK", auth: "OK" });
    expect(leerFeDummy(SERVER_FAULT)).toBeNull();
  });
  it("último autorizado, y el error de token", () => {
    expect(leerUltimoAutorizado(ULTIMO)).toEqual({ ok: true, numero: 41 });
    const r = leerUltimoAutorizado(ULTIMO_TOKEN_VENCIDO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores[0]!.code).toBe("600");
  });
  it("CAE aprobado", () => {
    expect(leerRespuestaCae(CAE_OK)).toEqual({ tipo: "AUTORIZADO", cae: "76432109876543", caeVto: "20261104", observaciones: [], reproceso: false });
  });
  it("rechazo con observaciones", () => {
    const r = leerRespuestaCae(CAE_RECHAZO);
    expect(r.tipo).toBe("RECHAZADO");
    if (r.tipo === "RECHAZADO") expect(r.observaciones.map((o) => o.code)).toEqual(["10015", "10246"]);
  });
  it("rechazo con Errors y sin detalle", () => {
    const r = leerRespuestaCae(CAE_ERRORS);
    expect(r.tipo).toBe("RECHAZADO");
    if (r.tipo === "RECHAZADO") expect(r.errores[0]!.code).toBe("10016");
  });
  it("un error del servidor no es un rechazo: no se sabe qué pasó", () => {
    expect(leerRespuestaCae(SERVER_FAULT)).toEqual({ tipo: "INCIERTO", detalle: "Server was unable to process request." });
    expect(leerRespuestaCae("")).toMatchObject({ tipo: "INCIERTO" });
  });
  it("consulta encontrada y no encontrada", () => {
    const r = leerConsulta(CONSULTA_OK);
    expect(r).toMatchObject({ ok: true, comprobante: { numero: 42, totalCentavos: 1500050, cae: "76432109876543", resultado: "A" } });
    expect(leerConsulta(CONSULTA_NO_EXISTE)).toMatchObject({ ok: false, noExiste: true });
  });
});

const BASE: DatosComprobante = {
  cuitEmisor: "20123456786",
  ptoVta: 3,
  cbteTipo: CBTE_FACTURA_C,
  numero: 42,
  concepto: 1,
  docTipo: 99,
  docNro: "0",
  condicionIvaReceptorId: 5,
  fecha: "20261025",
  totalCentavos: 1500050,
  servicio: null,
  asociado: null,
};

describe("FECAESolicitar: el pedido", () => {
  it("importes y fechas", () => {
    expect(importe(1500050)).toBe("15000.50");
    expect(importe(5)).toBe("0.05");
    expect(fechaArca(new Date("2026-10-26T02:00:00Z"))).toBe("20261025");
  });
  it("CUIT con dígito verificador", () => {
    expect(cuitValido("20123456786")).toBe(true);
    expect(cuitValido("20123456787")).toBe(false);
    expect(cuitValido("30000000007")).toBe(true);
  });
  it("factura C a consumidor final: todo al neto, sin IVA y con CondicionIVAReceptorId", () => {
    const x = detalleXml(BASE);
    expect(x).toContain("<ar:ImpTotal>15000.50</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>15000.50</ar:ImpNeto>");
    expect(x).toContain("<ar:ImpIVA>0.00</ar:ImpIVA>");
    expect(x).not.toContain("<ar:Iva>");
    expect(x).not.toContain("FchServDesde");
    expect(x).toContain("<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>");
    // El orden del WSDL: los importes antes que la moneda y la condición del receptor.
    expect(x.indexOf("ImpIVA")).toBeLessThan(x.indexOf("MonId"));
  });
  it("con servicios van las fechas del período y el vencimiento, antes de la moneda", () => {
    const x = detalleXml({ ...BASE, concepto: 2, servicio: { desde: "20261001", hasta: "20261031", vtoPago: "20261105" } });
    expect(x).toContain("<ar:FchServDesde>20261001</ar:FchServDesde><ar:FchServHasta>20261031</ar:FchServHasta><ar:FchVtoPago>20261105</ar:FchVtoPago><ar:MonId>");
  });
  it("la nota de crédito referencia la factura", () => {
    const x = detalleXml({ ...BASE, cbteTipo: CBTE_NOTA_CREDITO_C, asociado: { tipo: CBTE_FACTURA_C, ptoVta: 3, numero: 41, cuit: "20123456786", fecha: "20261024" } });
    expect(x).toContain("<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>11</ar:Tipo><ar:PtoVta>3</ar:PtoVta><ar:Nro>41</ar:Nro><ar:Cuit>20123456786</ar:Cuit><ar:CbteFch>20261024</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>");
  });
  it("el sobre completo lleva Auth y cabecera", () => {
    const s = sobreFecaeSolicitar({ token: "T<", sign: "S", cuit: "20123456786" }, BASE);
    expect(s).toContain("<ar:Token>T&lt;</ar:Token>");
    expect(s).toContain("<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>3</ar:PtoVta><ar:CbteTipo>11</ar:CbteTipo></ar:FeCabReq>");
    expect(JSON.stringify(pedidoComoJson(BASE))).not.toContain("Token");
  });
  it("valida antes de mandar", () => {
    expect(validarComprobante(BASE, "20261025")).toEqual([]);
    expect(validarComprobante({ ...BASE, fecha: "20261001" }, "20261025")[0]).toContain("5 días");
    expect(validarComprobante({ ...BASE, concepto: 2 }, "20261025")[0]).toContain("servicios");
    expect(validarComprobante({ ...BASE, totalCentavos: 10_000_000 * 100 }, "20261025")[0]).toContain("identificar");
    expect(validarComprobante({ ...BASE, docTipo: 96, docNro: "123" }, "20261025")[0]).toContain("DNI");
    expect(validarComprobante({ ...BASE, docTipo: 96, docNro: "30123456", condicionIvaReceptorId: 6 }, "20261025")[0]).toContain("CUIT");
    expect(validarComprobante({ ...BASE, cbteTipo: CBTE_NOTA_CREDITO_C }, "20261025")[0]).toContain("qué factura");
  });
});

describe("QR de la RG 4892", () => {
  const datos = { fecha: "20261025", cuit: "20123456786", ptoVta: 3, tipoCmp: 11, nroCmp: 42, totalCentavos: 1500050, tipoDocRec: 96, nroDocRec: "30123456", cae: "76432109876543" };
  it("carga útil con los nombres y tipos de la especificación", () => {
    expect(cargaQr(datos)).toEqual({
      ver: 1,
      fecha: "2026-10-25",
      cuit: 20123456786,
      ptoVta: 3,
      tipoCmp: 11,
      nroCmp: 42,
      importe: 15000.5,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: 96,
      nroDocRec: 30123456,
      tipoCodAut: "E",
      codAut: 76432109876543,
    });
  });
  it("sin receptor identificado no lleva documento", () => {
    expect(cargaQr({ ...datos, tipoDocRec: 99, nroDocRec: "0" })).not.toHaveProperty("nroDocRec");
  });
  it("la URL es la de ARCA más el JSON en base64", () => {
    const url = urlQr(datos);
    expect(url.startsWith("https://www.afip.gob.ar/fe/qr/?p=")).toBe(true);
    const json = JSON.parse(Buffer.from(url.split("?p=")[1]!, "base64").toString("utf8"));
    expect(json.codAut).toBe(76432109876543);
  });
});
