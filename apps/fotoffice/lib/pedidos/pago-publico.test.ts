import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avisoDeVuelta, mensajeDeMotivo } from "./pago-vuelta";
import { idDeCuotaValido, paymentIdValido } from "./mp-puro";
import { armarVistaPedido } from "./vista-publica";
import { resolverVariables, VARIABLES, type ContextoVariables } from "@/lib/plantillas/variables";
import { MENSAJES_PAGO_CUOTA } from "./mp";

const RAIZ = process.cwd();
const leer = (r: string) => readFileSync(join(RAIZ, r), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ACCION = "app/w/[workspaceSlug]/pedido/[token]/actions.ts";
const PAGINA = "app/w/[workspaceSlug]/pedido/[token]/page.tsx";

describe("pagar una cuota desde el enlace del cliente: fuente", () => {
  it("el token de Mercado Pago nunca llega al navegador", () => {
    for (const f of ["components/pedidos/pedido-publico.tsx", "lib/pedidos/vista-publica.ts", "lib/pedidos/pago-vuelta.ts"]) {
      expect(sinComentarios(leer(f)), f).not.toMatch(/accessToken|access_token|collector|refreshToken|@repo\/payments|@repo\/db/);
    }
    // La página y la acción no pasan el cobrador a ningún componente: sólo el sí o el no.
    expect(sinComentarios(leer(PAGINA))).not.toMatch(/collector|accessToken/);
    expect(sinComentarios(leer("lib/pedidos/publico.ts"))).toMatch(/\.then\(\(r\) => r\.ok, \(\) => false\)/);
  });

  it("la acción vuelve a validar freno, slug, token del pedido y cuota, y solo muestra códigos", () => {
    const src = sinComentarios(leer(ACCION));
    expect(src.startsWith('"use server"') || leer(ACCION).startsWith('"use server"')).toBe(true);
    expect(src).toContain("pasaElFrenoDePagos()");
    expect(src).toContain("workspaceDelSlug(slug)");
    expect(src).toContain("resolverTokenPedido(workspaceId, token)");
    expect(src).toContain("idDeCuotaValido(cuotaId)");
    expect(src).toContain("iniciarPagoCuota({ workspaceId, pedidoId: pedido.pedidoId, cuotaId })");
    // Nunca se pasa el texto de un error de afuera a la dirección.
    expect(src).not.toMatch(/motivo=\$\{r\.error\}|encodeURIComponent\(r\.error\)/);
    expect(leer("lib/pedidos/freno-publico.ts")).toMatch(/checkRateLimit\(\{ key: `pedido-pagar:\$\{ip\}`/);
  });

  it("la vuelta se verifica en el servidor y el pedido cancelado no muestra el botón", () => {
    expect(leer(PAGINA)).toContain("verificarVueltaDePago(workspaceId, token,");
    expect(leer("lib/pedidos/publico.ts")).toContain('p.status !== "CANCELADO" && (await resolveWorkspaceCollector');
    expect(leer("lib/pedidos/vista-publica.ts")).toContain('args.estado !== "CANCELADO"');
  });
});

describe("vista pública: botón por cuota", () => {
  const cuota = (id: string, saldo: number) => ({
    id, position: 1, dueDate: "2026-12-01", amountArs: 100, imputado: 100 - saldo, saldo, estado: saldo > 0 ? ("PENDIENTE" as const) : ("PAGADA" as const),
  });
  const armar = (estado: "CONFIRMADO" | "CANCELADO", cobros: boolean | undefined) =>
    armarVistaPedido({
      organizacion: { nombre: "X", logoUrl: null, whatsappUrl: null, email: null },
      numero: "P-1", estado, eventDate: null, eventLabel: null, items: [], totals: null, formaDePago: null,
      plan: { cuotas: [cuota("a", 50), cuota("b", 0)], total: 200, cobrado: 150, saldo: 50, aCobrar: 50, vencido: 0, cuotasVencidas: 0, proximoVencimiento: null, descuadrado: false } as never,
      recibos: [], cobrosHabilitados: cobros,
    });

  it("sólo las cuotas con saldo, con cobros habilitados y pedido no cancelado", () => {
    expect(armar("CONFIRMADO", true).plan.cuotas.map((c) => c.pagable)).toEqual([true, false]);
    expect(armar("CONFIRMADO", false).plan.cuotas.some((c) => c.pagable)).toBe(false);
    expect(armar("CONFIRMADO", undefined).plan.cuotas.some((c) => c.pagable)).toBe(false);
    expect(armar("CANCELADO", true).plan.cuotas.some((c) => c.pagable)).toBe(false);
  });

  it("la vista no lleva datos del cobrador", () => {
    expect(JSON.stringify(armar("CONFIRMADO", true))).not.toMatch(/token|collector/i);
  });
});

describe("validaciones de la vuelta", () => {
  it("payment_id: solo dígitos", () => {
    expect(paymentIdValido("1234567890")).toBe(true);
    for (const x of ["", "12a", "../1", "1 2", "1".repeat(21), null, 12, ["1"]]) expect(paymentIdValido(x)).toBe(false);
  });
  it("id de cuota: forma de id", () => {
    expect(idDeCuotaValido("clx9_a-Z")).toBe(true);
    for (const x of ["", "a b", "a/b", "x".repeat(65), undefined, ["a"]]) expect(idDeCuotaValido(x)).toBe(false);
  });
  it("los avisos son textos fijos", () => {
    expect(avisoDeVuelta("ok", null, "acreditado")).toMatchObject({ tono: "ok", conRecibo: true, texto: "¡Gracias! Registramos tu pago." });
    expect(avisoDeVuelta("ok", null, "ya_acreditado")?.conRecibo).toBe(true);
    // Un `pago=ok` que Mercado Pago no confirma no agradece.
    for (const v of ["no_aprobado", "sin_pago", "no_disponible", "sin_cobros", null] as const) {
      expect(avisoDeVuelta("ok", null, v)?.texto).toBe("Tu pago está en proceso. Te avisamos cuando se acredite.");
    }
    expect(avisoDeVuelta("pendiente", null, null)?.texto).toContain("Tu pago está en proceso");
    expect(avisoDeVuelta("error", null, null)?.texto).toBe("No se pudo completar el pago. Podés intentarlo de nuevo.");
    expect(avisoDeVuelta("error", "<script>", null)?.texto).toBe("No se pudo completar el pago. Podés intentarlo de nuevo.");
    expect(avisoDeVuelta("cualquiera", null, "acreditado")).toBeNull();
    expect(mensajeDeMotivo("__proto__")).toBeNull();
  });
  it("todo mensaje de iniciarPagoCuota tiene su código en la acción", () => {
    for (const k of Object.keys(MENSAJES_PAGO_CUOTA)) expect(mensajeDeMotivo(k), k).not.toBeNull();
  });
});

describe("variable [cuota_link_pago]", () => {
  const base: ContextoVariables = {
    persona: { nombreCompleto: null, email: null, telefono: null },
    organizacion: { nombre: null, email: null, telefono: null, whatsapp: null, web: null, instagram: null, ciudad: null },
    usuario: { nombre: null, email: null }, hoy: new Date(), campos: {},
  };
  const link = "https://x.test/w/s/pedido/t?pagar=c1";
  it("está en el catálogo, sólo para PEDIDO", () => {
    const v = VARIABLES.find((x) => x.clave === "cuota_link_pago");
    expect(v?.tipos).toEqual(["PEDIDO"]);
  });
  it("sale de pedido (próxima cuota), la cuota del recordatorio gana, y vacío sin cuota", () => {
    expect(resolverVariables({ ...base, pedido: { numero: "1", enlace: null, saldo: null, cuotaLinkPago: link } })("cuota_link_pago")).toBe(link);
    expect(resolverVariables({ ...base, pedido: { numero: "1", enlace: null, saldo: null, cuotaLinkPago: link }, cuota: { vence: null, importe: null, linkPago: "https://x.test/r?pagar=c2" } })("cuota_link_pago")).toBe("https://x.test/r?pagar=c2");
    expect(resolverVariables({ ...base, pedido: { numero: "1", enlace: null, saldo: null, cuotaLinkPago: null } })("cuota_link_pago")).toBeNull();
    expect(resolverVariables(base)("cuota_link_pago")).toBeNull();
  });
});
