import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTrackingLinkEmail } from "./emails";
import { puedeReemitirEnlace } from "./reenvio-enlace";
import { REQUEST_LIVE_STATUSES, REQUEST_STATUSES, type RequestStatus } from "./states";
import { canTransitionRequest, transitionRequiresReason } from "./transitions";
import { transitionNeedsCoordinator } from "./access-policy";

/**
 * Los tres callejones sin salida del módulo, como test.
 *
 * Un callejón es una transición que la máquina de estados permite y que **ninguna pantalla
 * ofrece**: el pedido queda trabado y la única salida es escribir en la base. Los tres que había
 * eran `REQUIERE_INFO → EN_EVALUACION`, `REQUIERE_INFO → RECHAZADA` y `APROBADA → CERRADA`, más
 * la imposibilidad de reparar un enlace de seguimiento cuyo correo falló.
 *
 * **Por qué hace falta mirar el fuente de la pantalla y no sólo las reglas.** Las tres
 * transiciones ya existían en `transitions.ts` y sus tests ya pasaban: lo que faltaba estaba del
 * lado del panel. Un test que sólo mirara la máquina habría seguido en verde con el pedido
 * igual de trabado. Es el mismo criterio de `aislamiento.test.ts` y de
 * `botones-con-variante.test.ts`, que también verifican sobre el código lo que no se puede
 * verificar de otra forma.
 *
 * Lo que se lee del panel son los destinos que sus formularios postean —`value="APROBADA"` y
 * compañía—, que es exactamente el dato que viaja al servidor. No se verifica la redacción de
 * ningún botón: el texto se va a reescribir, y un test que se rompa al mejorar una frase acaba
 * borrado.
 */

const PANEL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app", "(shell)", "coberturas", "[id]", "evaluacion-panel.tsx"),
  "utf8",
);

/** Los destinos que algún formulario del panel puede postear. */
function destinosQueOfreceElPanel(): Set<string> {
  const encontrados = new Set<string>();
  for (const m of PANEL.matchAll(/name="to"\s+value="([A-Z_]+)"/g)) encontrados.add(m[1]!);
  return encontrados;
}

describe("un pedido que espera información no queda trabado", () => {
  it("la máquina deja salir de REQUIERE_INFO por los dos lados", () => {
    expect(canTransitionRequest("REQUIERE_INFO", "EN_EVALUACION")).toBe(true);
    expect(canTransitionRequest("REQUIERE_INFO", "RECHAZADA")).toBe(true);
  });

  it("el panel ofrece las dos", () => {
    const ofrecidos = destinosQueOfreceElPanel();
    expect(ofrecidos.has("EN_EVALUACION")).toBe(true);
    expect(ofrecidos.has("RECHAZADA")).toBe(true);
  });

  it("volver a evaluación alcanza con revisar; dar por terminado exige coordinar", () => {
    // De eso depende que el panel esconda un botón y no el otro, y que el servidor exija el
    // guard que corresponde según el destino.
    expect(transitionNeedsCoordinator("EN_EVALUACION")).toBe(false);
    expect(transitionNeedsCoordinator("RECHAZADA")).toBe(true);
  });

  it("dar por terminado el intento exige escribir qué se les dice", () => {
    // La organización recibe ese texto tal cual. Sin motivo, el correo diría "no pudimos
    // tomarla" y nada más.
    expect(transitionRequiresReason("RECHAZADA")).toBe(true);
    expect(canTransitionRequest("REQUIERE_INFO", "RECHAZADA")).toBe(true);
  });
});

describe("una solicitud aprobada se puede cerrar", () => {
  it("la máquina lo permite y el panel lo ofrece", () => {
    expect(canTransitionRequest("APROBADA", "CERRADA")).toBe(true);
    expect(destinosQueOfreceElPanel().has("CERRADA")).toBe(true);
  });

  it("cerrar exige coordinar y no exige motivo", () => {
    expect(transitionNeedsCoordinator("CERRADA")).toBe(true);
    expect(transitionRequiresReason("CERRADA")).toBe(false);
  });

  it("cerrar es terminal: no se reabre por ningún camino", () => {
    for (const destino of REQUEST_STATUSES) {
      expect(canTransitionRequest("CERRADA", destino), destino).toBe(false);
    }
  });

  it("cerrar la solicitud no toca el ciclo de la cobertura, que es de la etapa 1c", () => {
    // Si algún día alguien agrega `REALIZADA` o `ENTREGADA` a los destinos del panel de la
    // ficha, es que se mezclaron dos etapas: esos estados son de la cobertura, no del pedido.
    const ofrecidos = destinosQueOfreceElPanel();
    expect(ofrecidos.has("REALIZADA")).toBe(false);
    expect(ofrecidos.has("ENTREGADA")).toBe(false);
    for (const destino of ofrecidos) {
      expect(
        (REQUEST_STATUSES as readonly string[]).includes(destino),
        `${destino} no es un estado de solicitud`,
      ).toBe(true);
    }
  });
});

describe("ningún estado vivo se queda sin salida", () => {
  /**
   * El test que habría encontrado los dos callejones de estado de una sola vez.
   *
   * Para cada estado en que el pedido todavía está vivo, el panel tiene que ofrecer **al menos
   * una** transición válida desde ahí. No pide que ofrezca todas —cancelar, por ejemplo, se
   * alcanza desde cualquier estado vivo y esta etapa no lo ofrece— pero sí que ninguno quede
   * sin ningún camino hacia adelante, que es justo lo que pasaba.
   */
  it("desde cada estado vivo hay al menos una salida ofrecida en la ficha", () => {
    const ofrecidos = [...destinosQueOfreceElPanel()];
    const trabados = REQUEST_LIVE_STATUSES.filter(
      (desde: RequestStatus) => !ofrecidos.some((hacia) => canTransitionRequest(desde, hacia)),
    );
    expect(trabados).toEqual([]);
  });
});

describe("si el correo del enlace falla, se puede reenviar", () => {
  const base = {
    context: { organizationName: "FOTOPOSITIVA", signature: null },
    publicCode: "SC-2026-0042",
    eventTitle: "Jornada solidaria para familias",
    contactName: "María",
    trackingUrl: "https://fotoffice.com/sc/UN-TOKEN-LARGO",
  };

  it("se puede mientras el pedido siga vivo, y no después", () => {
    for (const status of REQUEST_LIVE_STATUSES) {
      expect(
        puedeReemitirEnlace({ status, tieneDestinatario: true, tieneAppUrl: true }).ok,
        status,
      ).toBe(true);
    }
    expect(
      puedeReemitirEnlace({ status: "RECHAZADA", tieneDestinatario: true, tieneAppUrl: true }).ok,
    ).toBe(false);
  });

  it("no se rota si no hay a quién mandarle: dejaría a la organización sin ningún enlace", () => {
    // Es el mismo criterio de `debeRotarEnlace`, que ya usa el resto del módulo. Rotar sin poder
    // avisar es peor que no hacer nada: el enlace viejo muere y del nuevo nadie se entera.
    expect(
      puedeReemitirEnlace({ status: "APROBADA", tieneDestinatario: false, tieneAppUrl: true }).ok,
    ).toBe(false);
    expect(
      puedeReemitirEnlace({ status: "APROBADA", tieneDestinatario: true, tieneAppUrl: false }).ok,
    ).toBe(false);
  });

  it("el correo avisa que el enlace anterior dejó de funcionar", () => {
    // Sin esta aclaración, la organización prueba primero el que tenía guardado, ve "no
    // encontramos este pedido" y concluye que le borraron el pedido.
    const m = buildTrackingLinkEmail(base);
    expect(m.text).toMatch(/ya no funciona/);
    expect(m.html).toContain(base.trackingUrl);
    expect(m.text).toContain(base.trackingUrl);
  });

  it("el asunto no lleva el enlace: `SentEmailLog` guarda el asunto", () => {
    // El registro de correos guarda destinatario y asunto, nunca el cuerpo. Si el token entrara
    // en el asunto, la credencial quedaría escrita en la base — que es exactamente lo que el
    // diseño del enlace evita guardando sólo el hash.
    const m = buildTrackingLinkEmail(base);
    expect(m.subject).not.toContain("UN-TOKEN-LARGO");
    expect(m.subject).toContain("SC-2026-0042");
  });

  it("la acción no escribe el token crudo en el historial", () => {
    // El evento se graba dentro de la transacción que rota el token, y su nota es texto fijo.
    // Si alguna vez alguien interpola el enlace ahí, la credencial queda en `CoverageEvent`.
    const accion = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app", "(shell)", "coberturas", "actions.ts"),
      "utf8",
    );
    const reenvio = accion.slice(accion.indexOf("export async function resendTrackingLinkAction"));
    const hastaElEnvio = reenvio.slice(0, reenvio.indexOf("sendAndLogEmail"));
    expect(hastaElEnvio).toContain("ENLACE_REEMITIDO");
    expect(hastaElEnvio).not.toMatch(/note:.*rawToken/);
    expect(hastaElEnvio).not.toMatch(/note:.*\/sc\//);
  });

  it("el envío va afuera de la transacción", () => {
    // Que el correo falle no puede dejar el estado a medias: el token nuevo ya está guardado y
    // el historial ya lo dice. Si el envío entrara en la transacción, un proveedor caído haría
    // rollback de una rotación que ya no se puede repetir igual.
    const accion = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app", "(shell)", "coberturas", "actions.ts"),
      "utf8",
    );
    const reenvio = accion.slice(accion.indexOf("export async function resendTrackingLinkAction"));
    const cuerpo = reenvio.slice(0, reenvio.indexOf("\n}\n"));
    expect(cuerpo.indexOf("$transaction")).toBeLessThan(cuerpo.indexOf("sendAndLogEmail"));
  });
});
