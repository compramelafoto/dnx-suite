import { C, FUENTE, escapeHtml } from "@/lib/communications/html";
import { formatMinorArs } from "@/lib/membership/money";
import { STORE_PUBLIC_SEGMENT } from "./constants";

/**
 * Los textos de los correos de la tienda. Funciones PURAS (sin red, base ni variables de
 * entorno): quien envía (`emails.ts`) junta los datos y estas arman `{ subject, html, text }`.
 * Los leen compradores y gente de la institución: castellano llano, sin vocabulario interno.
 */

export type StoreEmailOrder = {
  institution: string;
  orderNumber: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  totalMinor: number;
  items: { description: string; qty: number; lineTotalMinor: number }[];
  pickup: { address: string | null; hours: string | null; instructions: string | null };
  /** Enlace a la página del pedido para el comprador (con su token). null = sin enlace. */
  orderUrl: string | null;
  /** Enlace al pedido en el panel, para la institución. null = sin enlace. */
  panelUrl: string | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * La dirección de la página del pedido para un correo. Con el dominio propio conectado, la de la
 * institución (`https://sfpr.com.ar/tienda/...`, que el proxy reescribe); si no, la de FOTOFFICE.
 * Sin token (falta la clave), sin slug público o sin dirección configurada: null.
 */
export function buildStoreOrderUrl(input: {
  customDomain: string | null;
  appOrigin: string;
  slug: string | null;
  publicId: string;
  token: string | null;
}): string | null {
  if (!input.token || !input.slug) return null;
  const base = input.customDomain
    ? `https://${input.customDomain}/${STORE_PUBLIC_SEGMENT}`
    : input.appOrigin
      ? `${input.appOrigin}/w/${input.slug}/${STORE_PUBLIC_SEGMENT}`
      : null;
  if (!base) return null;
  return `${base}/pedido/${input.publicId}?t=${encodeURIComponent(input.token)}`;
}

// ── Piezas ──────────────────────────────────────────────────────────────────

type Bloque = { text: string[]; html: string };

function parrafo(texto: string, rico = escapeHtml(texto)): Bloque {
  return {
    text: [texto],
    html: `<p class="cuerpo" style="margin:0 0 14px;font-size:15px;line-height:1.62;color:${C.cuerpo};">${rico}</p>`,
  };
}

function detalle(o: StoreEmailOrder): Bloque {
  const filas = o.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.borde};font-size:14px;color:${C.cuerpo};">${i.qty} × ${escapeHtml(i.description)}</td>` +
        `<td align="right" style="padding:6px 0;border-bottom:1px solid ${C.borde};font-size:14px;color:${C.cuerpo};white-space:nowrap;">${formatMinorArs(i.lineTotalMinor)}</td></tr>`,
    )
    .join("");
  return {
    text: [
      `Pedido #${o.orderNumber}`,
      ...o.items.map((i) => `- ${i.qty} × ${i.description}: ${formatMinorArs(i.lineTotalMinor)}`),
      `Total: ${formatMinorArs(o.totalMinor)}`,
    ],
    html: `<p style="margin:8px 0 6px;font-size:13px;font-weight:700;color:${C.tinta};">Pedido #${o.orderNumber}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${filas}
<tr><td style="padding:8px 0;font-size:15px;font-weight:700;color:${C.tinta};">Total</td><td align="right" style="padding:8px 0;font-size:15px;font-weight:700;color:${C.tinta};white-space:nowrap;">${formatMinorArs(o.totalMinor)}</td></tr>
</table>`,
  };
}

function retiro(o: StoreEmailOrder): Bloque | null {
  const lineas: [string, string][] = [];
  if (o.pickup.address) lineas.push(["Dirección", o.pickup.address]);
  if (o.pickup.hours) lineas.push(["Horarios", o.pickup.hours]);
  if (o.pickup.instructions) lineas.push(["Indicaciones", o.pickup.instructions]);
  if (lineas.length === 0) return null;
  return {
    text: ["Dónde retirarlo", ...lineas.map(([k, v]) => `${k}: ${v}`)],
    html: `<p style="margin:8px 0 6px;font-size:13px;font-weight:700;color:${C.tinta};">Dónde retirarlo</p>
${lineas
  .map(
    ([k, v]) =>
      `<p class="cuerpo" style="margin:0 0 6px;font-size:14px;line-height:1.5;color:${C.cuerpo};"><strong>${k}:</strong> ${escapeHtml(v).replace(/\n/g, "<br>")}</p>`,
  )
  .join("\n")}`,
  };
}

function comprador(o: StoreEmailOrder): Bloque {
  const datos = [o.buyerName, o.buyerEmail, o.buyerPhone].filter((x): x is string => Boolean(x));
  return {
    text: [`Quién compró: ${datos.join(" · ")}`],
    html: `<p class="cuerpo" style="margin:0 0 14px;font-size:14px;line-height:1.5;color:${C.cuerpo};"><strong>Quién compró:</strong> ${datos.map(escapeHtml).join(" · ")}</p>`,
  };
}

function armar(
  institution: string,
  subject: string,
  bloques: (Bloque | null)[],
  cta: { label: string; url: string | null },
): RenderedEmail {
  const presentes = bloques.filter((b): b is Bloque => b !== null);
  const boton = cta.url
    ? `<tr><td style="padding:8px 30px 24px;">
    <a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${C.acento};color:#ffffff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;text-decoration:none;">${escapeHtml(cta.label)}</a>
    <p class="apagado" style="margin:12px 0 0;font-size:12px;color:${C.tenue};">Si el botón no funciona, copiá esta dirección:<br>${escapeHtml(cta.url)}</p>
  </td></tr>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark}
  @media (prefers-color-scheme:dark){
    .lienzo{background:#0b1220!important}
    .tarjeta{background:#111c2e!important;border-color:#24344d!important}
    .cuerpo{color:#c3cede!important}
    .apagado{color:#8b9bb4!important}
  }
</style></head>
<body class="lienzo" style="margin:0;padding:0;background:${C.lienzo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lienzo" style="background:${C.lienzo};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tarjeta"
  style="width:100%;max-width:600px;background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;overflow:hidden;font-family:${FUENTE};">
  <tr><td style="padding:16px 30px;background:${C.acentoSuave};font-size:12px;font-weight:700;letter-spacing:1.6px;color:${C.acentoFuerte};">${escapeHtml(institution)}</td></tr>
  <tr><td style="padding:26px 30px 8px;">
    ${presentes.map((b) => b.html).join("\n    ")}
  </td></tr>
  ${boton}
</table>
</td></tr></table></body></html>`;

  const text = [
    ...presentes.flatMap((b) => [...b.text, ""]),
    ...(cta.url ? [`${cta.label}:`, cta.url] : []),
  ]
    .join("\n")
    .trimEnd();
  return { subject, html, text };
}

// ── Al comprador ────────────────────────────────────────────────────────────

export function renderOrderPaid(o: StoreEmailOrder): RenderedEmail {
  return armar(
    o.institution,
    `${o.institution}: recibimos el pago de tu pedido #${o.orderNumber}`,
    [
      parrafo(`Hola ${o.buyerName},`),
      parrafo(
        `Recibimos tu pago. Ahora preparamos tu pedido y te escribimos de nuevo cuando esté listo para retirar.`,
      ),
      detalle(o),
      retiro(o),
      parrafo(`Gracias por tu compra.`),
    ],
    { label: "Ver mi pedido", url: o.orderUrl },
  );
}

export function renderOrderReady(o: StoreEmailOrder): RenderedEmail {
  return armar(
    o.institution,
    `${o.institution}: tu pedido #${o.orderNumber} está listo para retirar`,
    [
      parrafo(`Hola ${o.buyerName},`),
      parrafo(`Tu pedido está listo: ya podés retirarlo.`),
      retiro(o),
      detalle(o),
      parrafo(`Te esperamos.`),
    ],
    { label: "Ver mi pedido", url: o.orderUrl },
  );
}

// ── A la institución ────────────────────────────────────────────────────────

export function renderNewOrderNotice(o: StoreEmailOrder): RenderedEmail {
  return armar(
    o.institution,
    `Pedido online #${o.orderNumber} pagado: para preparar`,
    [
      parrafo(`Entró un pedido de la tienda online, ya pagado con Mercado Pago. Hay que prepararlo.`),
      comprador(o),
      detalle(o),
      parrafo(`Cuando esté listo, marcalo así en el panel y le avisamos a quien compró para que lo retire.`),
    ],
    { label: "Ver el pedido", url: o.panelUrl },
  );
}

export function renderPaidNoStockAlert(o: StoreEmailOrder): RenderedEmail {
  return armar(
    o.institution,
    `Pedido online #${o.orderNumber}: se pagó pero hay que resolverlo`,
    [
      parrafo(
        `El pedido #${o.orderNumber} se pagó con Mercado Pago, pero no se pudo dar por vendido: falta stock, o el pago no coincide con el total del pedido.`,
      ),
      parrafo(
        `Hay que resolverlo: reponer el stock y confirmarlo desde el panel, o cancelarlo y devolver el dinero desde Mercado Pago.`,
      ),
      comprador(o),
      detalle(o),
    ],
    { label: "Resolver el pedido", url: o.panelUrl },
  );
}

export function renderDuplicatePaymentAlert(o: StoreEmailOrder, providerPaymentId: string): RenderedEmail {
  return armar(
    o.institution,
    `Pedido online #${o.orderNumber}: se pagó dos veces`,
    [
      parrafo(
        `El pedido #${o.orderNumber} se pagó dos veces en Mercado Pago. El primer pago ya quedó registrado; el segundo hay que devolverlo.`,
      ),
      parrafo(
        `Número de operación a devolver en Mercado Pago: ${providerPaymentId}`,
        `Número de operación a devolver en Mercado Pago: <strong>${escapeHtml(providerPaymentId)}</strong>`,
      ),
      comprador(o),
      detalle(o),
    ],
    { label: "Ver el pedido", url: o.panelUrl },
  );
}

export function renderCreditFailureAlert(o: StoreEmailOrder): RenderedEmail {
  return armar(
    o.institution,
    `Pedido online #${o.orderNumber}: hay un pago para revisar`,
    [
      parrafo(
        `Mercado Pago aprobó el pago del pedido #${o.orderNumber}, pero no lo pudimos registrar todavía. Lo seguimos intentando solos.`,
      ),
      parrafo(`Revisalo en el panel. Si en unas horas sigue igual, escribinos y lo miramos juntos.`),
      comprador(o),
      detalle(o),
    ],
    { label: "Ver el pedido", url: o.panelUrl },
  );
}

/**
 * El botón de arrepentimiento (Res. SCI 424/2020). La ley pide responder con el código del
 * trámite: va en el asunto y en el cuerpo para que la institución lo cite al contestar.
 */
export function renderRegretNotice(
  o: StoreEmailOrder,
  input: { code: string; reason: string | null },
): RenderedEmail {
  return armar(
    o.institution,
    `Pedido online #${o.orderNumber}: pidieron arrepentirse de la compra (trámite ${input.code})`,
    [
      parrafo(
        `Quien compró el pedido #${o.orderNumber} usó el botón de arrepentimiento de la tienda. El código del trámite es ${input.code}.`,
      ),
      input.reason ? parrafo(`Motivo que escribió: ${input.reason}`) : null,
      parrafo(
        `Comunicate con la persona para coordinar la devolución del producto y del dinero. El pedido no cambió de estado: cuando lo resuelvas, actualizalo desde el panel.`,
      ),
      comprador(o),
      detalle(o),
    ],
    { label: "Ver el pedido", url: o.panelUrl },
  );
}
