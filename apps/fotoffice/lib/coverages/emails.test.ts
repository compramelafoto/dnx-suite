import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildAssignmentConfirmedEmail,
  buildAssignmentInvitedEmail,
  buildCallPublishedEmail,
  buildInfoRequestedEmail,
  buildRequestApprovedEmail,
  buildRequestReceivedEmail,
  buildRequestRejectedEmail,
  buildTeamCompleteEmail,
  contactGreetingName,
  destinatariosDeColaboradores,
  destinatariosDeCoordinacion,
} from "./emails";

const contexto = { organizationName: "FOTOPOSITIVA", signature: null };
const base = {
  context: contexto,
  publicCode: "SC-2026-0042",
  eventTitle: "Jornada solidaria para familias",
  contactName: "María",
  trackingUrl: "https://fotoffice.com/sc/UN-TOKEN-LARGO",
};

/**
 * Los correos del circuito.
 *
 * Armado puro: devuelve asunto, HTML y texto, y no envía nada. Así se puede probar lo que
 * importa —que el enlace esté, que el motivo del rechazo se comunique, que no se filtre nada
 * interno— sin un proveedor de correo de por medio.
 */
describe("buildRequestReceivedEmail", () => {
  it("lleva el código en el asunto: es lo que la persona va a buscar después", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.subject).toContain("SC-2026-0042");
  });

  it("incluye el enlace de seguimiento", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.html).toContain(base.trackingUrl);
    expect(m.text).toContain(base.trackingUrl);
  });

  it("no promete que la cobertura se va a hacer", () => {
    // Una solicitud es un pedido, no un alta. Prometer acá deja a la coordinación pagando un
    // compromiso que nunca tomó.
    const m = buildRequestReceivedEmail(base);
    expect(m.text.toLowerCase()).not.toContain("confirmada");
    expect(m.text.toLowerCase()).toContain("vamos a revisar");
  });

  it("sin URL de seguimiento, no muestra un botón que no lleva a ningún lado", () => {
    // Pasa cuando no se pudo rotar el enlace por falta de `appUrl` (ver `debeRotarEnlace`).
    // Un botón sin destino, y la línea de "copiá y pegá esta dirección" sin dirección debajo,
    // son peor que no mostrar nada.
    const m = buildRequestReceivedEmail({ ...base, trackingUrl: "" });
    expect(m.html).not.toContain("Ver cómo va tu pedido");
    expect(m.html).not.toContain("copiá y pegá");
    expect(m.text).not.toContain("Ver cómo va tu pedido");
  });

  it("una URL con sólo espacios se trata igual que vacía", () => {
    const m = buildRequestReceivedEmail({ ...base, trackingUrl: "   " });
    expect(m.html).not.toContain("Ver cómo va tu pedido");
    expect(m.html).not.toContain("copiá y pegá");
    expect(m.text).not.toContain("Ver cómo va tu pedido");
  });

  it("con una URL real, el botón y la frase de copiar sí aparecen", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.html).toContain("Ver cómo va tu pedido");
    expect(m.html).toContain("copiá y pegá");
    expect(m.text).toContain("Ver cómo va tu pedido");
    expect(m.text).toContain(base.trackingUrl);
  });

  it("el saludo nunca repite la palabra «Hola»", () => {
    // `compose` siempre antepone "Hola" al nombre que le llega (ver más arriba, `saludo`). Si
    // `contactGreetingName` volviera a usar "Hola" como valor por omisión en vez de "Equipo"
    // (por ejemplo, para una solicitud sin nombre de contacto ni razón social), el correo
    // saldría literalmente "Hola Hola,". Se prueba con el resultado real de esa función, no con
    // un literal escrito a mano, para que este caso se rompa si alguien vuelve a tocarla.
    const nombre = contactGreetingName({ firstName: null, lastName: null, businessName: null });
    const m = buildRequestReceivedEmail({ ...base, contactName: nombre });
    expect(m.text).not.toContain("Hola Hola");
    expect(m.html).not.toContain("Hola Hola");
    expect(m.text).toContain("Hola Equipo,");
  });
});

describe("contactGreetingName", () => {
  it("con nombre y apellido, saluda a la persona", () => {
    expect(
      contactGreetingName({ firstName: "María", lastName: "Pérez", businessName: "FOTOPOSITIVA" }),
    ).toBe("María Pérez");
  });

  it("sin nombre pero con razón social, cae a la razón social", () => {
    expect(
      contactGreetingName({ firstName: null, lastName: null, businessName: "FOTOPOSITIVA" }),
    ).toBe("FOTOPOSITIVA");
  });

  it("sin nombre ni razón social, cae a «Equipo» y nunca a «Hola»", () => {
    const nombre = contactGreetingName({ firstName: null, lastName: null, businessName: null });
    expect(nombre).toBe("Equipo");
    expect(nombre).not.toBe("Hola");
  });
});

describe("buildInfoRequestedEmail", () => {
  it("dice qué falta, con las palabras de quien lo pidió", () => {
    const m = buildInfoRequestedEmail({
      ...base,
      infoRequested: "¿Cuántas personas esperan y hay luz artificial en el salón?",
    });
    expect(m.text).toContain("¿Cuántas personas esperan");
    expect(m.html).toContain(base.trackingUrl);
  });
});

describe("buildRequestApprovedEmail", () => {
  it("avisa que se aprobó y que todavía falta armar el equipo", () => {
    const m = buildRequestApprovedEmail(base);
    expect(m.subject).toContain("SC-2026-0042");
    expect(m.text.toLowerCase()).toContain("equipo");
  });
});

describe("buildRequestRejectedEmail", () => {
  it("comunica el motivo tal como se escribió", () => {
    const m = buildRequestRejectedEmail({
      ...base,
      reason: "La fecha ya pasó cuando recibimos el pedido.",
    });
    expect(m.text).toContain("La fecha ya pasó cuando recibimos el pedido.");
  });

  it("no manda el enlace de seguimiento en un rechazo", () => {
    // El circuito terminó. Un enlace que lleva a una pantalla sin nada que hacer solo invita a
    // volver a mirar un "no".
    const m = buildRequestRejectedEmail({ ...base, reason: "No corresponde." });
    expect(m.html).not.toContain(base.trackingUrl);
  });
});

/* ------------------------------------------------------------------------------------------
 * Los cuatro correos de armar el equipo (etapa 1b).
 * ---------------------------------------------------------------------------------------- */

const baseEquipo = {
  context: contexto,
  coverageTitle: "Jornada solidaria para familias",
  fechaLabel: "26.09.2026, 09:30",
  city: "Rosario",
};

describe("destinatariosDeColaboradores", () => {
  it("devuelve una dirección por persona, nunca una sola cadena con todas", () => {
    // El aviso sale a cada uno por separado. Una cadena con comas terminaría metiendo a todo el
    // mundo en el mismo correo, que es justo lo que no queremos.
    const r = destinatariosDeColaboradores([{ email: "ana@x.com" }, { email: "juan@y.com" }]);
    expect(r).toEqual(["ana@x.com", "juan@y.com"]);
    for (const email of r) expect(email).not.toMatch(/[,;]/);
  });

  it("descarta a quien no tiene correo cargado", () => {
    expect(destinatariosDeColaboradores([{ email: null }, { email: "  " }, { email: "ana@x.com" }])).toEqual(
      ["ana@x.com"],
    );
  });

  it("una fila con dos direcciones escritas a mano se descarta entera", () => {
    // `Member.email` es texto libre: si alguien escribió "ana@x.com, juan@y.com" en el campo,
    // mandarle a esa cadena le mostraría a cada uno la dirección del otro.
    expect(
      destinatariosDeColaboradores([{ email: "ana@x.com, juan@y.com" }, { email: "ana@x.com" }]),
    ).toEqual(["ana@x.com"]);
  });

  it("no le manda dos veces a la misma persona aunque cambie la mayúscula", () => {
    expect(
      destinatariosDeColaboradores([{ email: "Ana@X.com" }, { email: "ana@x.com" }]),
    ).toEqual(["Ana@X.com"]);
  });

  it("sin colaboradores, no hay a quién avisarle", () => {
    expect(destinatariosDeColaboradores([])).toEqual([]);
  });
});

describe("destinatariosDeCoordinacion", () => {
  it("usa los correos configurados del módulo", () => {
    expect(
      destinatariosDeCoordinacion({
        notifyEmails: ["coordina@x.com", "secretaria@x.com"],
        contactEmail: "info@x.com",
      }),
    ).toEqual(["coordina@x.com", "secretaria@x.com"]);
  });

  it("sin ninguno configurado, cae al correo de contacto de la institución", () => {
    expect(destinatariosDeCoordinacion({ notifyEmails: [], contactEmail: "info@x.com" })).toEqual([
      "info@x.com",
    ]);
  });

  it("sin nada configurado, devuelve vacío en vez de inventar un destinatario", () => {
    // Quien llama registra ese caso: un aviso que nadie mira es peor que uno que falló, porque
    // nadie lo va a reclamar.
    expect(destinatariosDeCoordinacion({ notifyEmails: [], contactEmail: null })).toEqual([]);
  });

  it("una línea con basura no se manda", () => {
    expect(
      destinatariosDeCoordinacion({ notifyEmails: ["sin arroba"], contactEmail: "info@x.com" }),
    ).toEqual(["info@x.com"]);
  });
});

describe("buildCallPublishedEmail", () => {
  const base = {
    ...baseEquipo,
    greetingName: "Ana",
    callTitle: "Fotógrafos para la jornada",
    publicSummary: "Van a ser unas cuatro horas, a la mañana.",
    callUrl: "https://fotoffice.com/portal/coberturas/call-1",
  };

  it("dice de qué actividad se trata y cuándo es", () => {
    const m = buildCallPublishedEmail(base);
    expect(m.text).toContain("Jornada solidaria para familias");
    expect(m.text).toContain("26.09.2026, 09:30");
    expect(m.text).toContain("Rosario");
  });

  it("lleva el enlace para anotarse", () => {
    const m = buildCallPublishedEmail(base);
    expect(m.html).toContain(base.callUrl);
    expect(m.text).toContain(base.callUrl);
  });

  it("invita, no reclama: no anotarse no tiene que sentirse como faltar a algo", () => {
    const m = buildCallPublishedEmail(base);
    expect(m.text.toLowerCase()).toContain("si esta vez no llegás, no pasa nada");
  });

  it("no promete cuántos lugares quedan", () => {
    // Ese número cambia entre que sale el correo y que la persona lo abre.
    const m = buildCallPublishedEmail(base);
    expect(m.text.toLowerCase()).not.toContain("lugares libres");
  });

  it("lo firma la organización, y el asunto dice cuál es", () => {
    const m = buildCallPublishedEmail(base);
    expect(m.subject).toContain("FOTOPOSITIVA");
    expect(m.text).toContain("colaborador activo de FOTOPOSITIVA");
  });

  it("sin resumen ni ciudad, sale igual y sin renglones a medias", () => {
    const m = buildCallPublishedEmail({ ...base, publicSummary: null, city: null });
    expect(m.text).toContain("Cuándo: 26.09.2026, 09:30");
    expect(m.text).not.toContain("Dónde:");
  });
});

describe("buildAssignmentInvitedEmail", () => {
  const base = {
    ...baseEquipo,
    greetingName: "Ana",
    roleName: "Fotógrafa principal",
    assignmentUrl: "https://fotoffice.com/portal/coberturas/asignacion/asg-1",
    respondByLabel: null as string | null,
  };

  it("el enlace lleva directo a la pantalla donde se contesta", () => {
    // Esta persona abre el correo en el teléfono: tiene que poder responder en dos toques.
    const m = buildAssignmentInvitedEmail(base);
    expect(m.html).toContain("/portal/coberturas/asignacion/asg-1");
    expect(m.text).toContain("/portal/coberturas/asignacion/asg-1");
  });

  it("dice a qué rol la invitamos y cuándo es", () => {
    const m = buildAssignmentInvitedEmail(base);
    expect(m.text).toContain("Fotógrafa principal");
    expect(m.text).toContain("26.09.2026, 09:30");
  });

  it("habla de invitar a participar, no de asignar a alguien", () => {
    const m = buildAssignmentInvitedEmail(base);
    expect(m.subject.toLowerCase()).toContain("te invitamos a participar");
  });

  it("pide que avise también cuando no puede", () => {
    const m = buildAssignmentInvitedEmail(base);
    expect(m.text.toLowerCase()).toContain("si no podés, avisanos igual");
  });

  it("los datos del día se ven en la pantalla, no en el correo", () => {
    const m = buildAssignmentInvitedEmail(base);
    expect(m.text.toLowerCase()).toContain("detalles del día");
  });

  it("con plazo de respuesta, lo dice al pie", () => {
    const m = buildAssignmentInvitedEmail({ ...base, respondByLabel: "20.09.2026" });
    expect(m.text).toContain("antes del 20.09.2026");
  });
});

describe("buildAssignmentConfirmedEmail", () => {
  const base = {
    coverageTitle: "Jornada solidaria para familias",
    personName: "Ana Pérez",
    roleName: "Fotógrafa principal",
    fechaLabel: "26.09.2026, 09:30",
    equipoCompleto: false,
    panelUrl: "https://fotoffice.com/coberturas/c/cov-1",
  };

  it("le dice a la coordinación quién confirmó y para qué rol", () => {
    const m = buildAssignmentConfirmedEmail(base);
    expect(m.text).toContain("Ana Pérez");
    expect(m.text).toContain("Fotógrafa principal");
  });

  it("el nombre de quien confirmó no va en el asunto", () => {
    // `SentEmailLog` guarda el asunto y el destinatario de cada envío. Ese registro sirve para
    // saber si un aviso salió, no para dejar anotado quién participa de cada actividad.
    const m = buildAssignmentConfirmedEmail(base);
    expect(m.subject).not.toContain("Ana Pérez");
  });

  it("avisa si con esa confirmación se completó el equipo", () => {
    const m = buildAssignmentConfirmedEmail({ ...base, equipoCompleto: true });
    expect(m.text).toContain("el equipo quedó completo");
  });

  it("si todavía falta gente, lo dice", () => {
    const m = buildAssignmentConfirmedEmail(base);
    expect(m.text).toContain("faltan lugares por cubrir");
  });

  it("es un aviso interno: sin firma institucional", () => {
    const m = buildAssignmentConfirmedEmail(base);
    expect(m.html).not.toContain("fo-signature");
  });
});

describe("buildTeamCompleteEmail", () => {
  const base = {
    context: contexto,
    publicCode: "SC-2026-0042",
    eventTitle: "Jornada solidaria para familias",
    contactName: "María",
    fechaLabel: "26.09.2026, 09:30",
    city: "Rosario" as string | null,
    trackingUrl: "https://fotoffice.com/sc/UN-TOKEN-NUEVO",
  };

  it("lleva el código en el asunto: es lo que la organización va a buscar después", () => {
    const m = buildTeamCompleteEmail(base);
    expect(m.subject).toContain("SC-2026-0042");
  });

  it("dice que el equipo ya está, con las palabras de siempre", () => {
    const m = buildTeamCompleteEmail(base);
    expect(m.text.toLowerCase()).toContain("ya tenemos el equipo");
  });

  it("lleva el enlace de seguimiento rotado", () => {
    const m = buildTeamCompleteEmail(base);
    expect(m.html).toContain(base.trackingUrl);
    expect(m.text).toContain(base.trackingUrl);
  });

  it("sin enlace (no se pudo rotar), el correo sale igual y sin un botón muerto", () => {
    const m = buildTeamCompleteEmail({ ...base, trackingUrl: "" });
    expect(m.text.toLowerCase()).toContain("ya tenemos el equipo");
    expect(m.html).not.toContain("Ver cómo va tu pedido");
    expect(m.html).not.toContain("copiá y pegá");
  });

  it("sin ciudad, la frase no queda colgada", () => {
    const m = buildTeamCompleteEmail({ ...base, city: null });
    expect(m.text).toContain("Nos vemos el 26.09.2026, 09:30.");
  });
});

/**
 * La regla que no se ve en ningún caso de prueba porque es una AUSENCIA: el briefing privado
 * —teléfono de emergencia, contacto del día— no viaja por correo. Se ve en la pantalla de la
 * asignación, con sesión iniciada.
 *
 * Se verifica sobre el código fuente, como ya hace `aislamiento.test.ts` con el repositorio: un
 * caso de prueba normal no puede demostrar que algo no está, porque el día que alguien agregue
 * el campo al armado, el test que "no lo encuentra" seguiría pasando si nadie se lo pasa.
 */
describe("el briefing privado no viaja por correo", () => {
  it("ningún armado de email menciona privateBriefing", () => {
    const fuente = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "emails.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(fuente).not.toMatch(/privateBriefing/);
  });
});
