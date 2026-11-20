import { describe, expect, it } from "vitest";
import { guiaDeAtencion, situacionDeAtencion } from "./guia";

describe("guía del bot de atención", () => {
  it("nombra las tres herramientas y las reglas que no se negocian", () => {
    const g = guiaDeAtencion();
    for (const t of ["buscar_productos", "datos_del_estudio", "preparar_presupuesto", "armar_pedido", "pasar_a_persona"]) expect(g).toContain(t);
    expect(g).toMatch(/Nunca inventes precios/);
    expect(g).toMatch(/markdown/);
  });

  it("XV desde un anuncio: el primer mensaje es el saludo y la fecha, sin portfolio ni precios", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("PRIMER MENSAJE DE XV");
    expect(g).toContain("No mandes el enlace del portfolio, los paquetes ni precios en el primer mensaje");
    expect(g).not.toContain("https://www.compramelafoto.com/dnx/xv");
    const ejemplo = g.split("\n").find((l) => l.startsWith("- Ejemplo: \"¡Hola Laura!"))!;
    expect(ejemplo).toBe('- Ejemplo: "¡Hola Laura! Gracias por escribirnos 😊 ¿Para qué fecha es la fiesta? 🎉"');
    expect(g).toMatch(/si la herramienta dice que no hay precio, no digas ninguno/);
  });

  it("XV y bodas: la fecha va primero y el bot nunca habla de botones", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("en este orden: la fecha del evento; el nombre y apellido;");
    expect(g).toContain("nunca hables de botones");
    expect(g).not.toMatch(/con el botón para reservar/);
  });

  it("XV desde un anuncio sigue con XV Y BODAS, de a una pregunta; los únicos precios de evento son el desde y el del paquete", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("Después seguís el camino de XV Y BODAS, de a una pregunta por mensaje.");
    expect(g).toContain('Nunca digas precios de eventos, salvo el "desde" de XV que te da presentacion_xv y el precio del paquete que eligió en XV y bodas (paquetes_del_evento)');
    expect(g).not.toContain('XV / 15 años u otra fiesta → "¿Para qué fecha es la fiesta? 🎉"');
  });

  describe("XV Y BODAS (spec 2026-11-20)", () => {
    const g = guiaDeAtencion();
    const bloque = g.slice(g.indexOf("XV Y BODAS ("), g.indexOf("COTIZACIONES DE EVENTOS (preparar_presupuesto)"));

    it("vale para XV y bodas; los demás eventos siguen igual", () => {
      expect(bloque).toContain("Vale para fiestas de XV / 15 años y para bodas o casamientos. Los demás eventos siguen como dice COTIZACIONES DE EVENTOS.");
      expect(g).toContain("En XV / 15 años y en bodas seguí XV Y BODAS: una sola pregunta por mensaje.");
    });

    it("junta los datos de a uno y en orden: fecha, nombre, salón y localidad, horario; después la idea y la cobertura", () => {
      expect(bloque).toContain("de a UNA pregunta por mensaje");
      const orden = ["la fecha del evento", "el nombre y apellido", "el salón y la localidad", "el horario (de qué hora a qué hora)", "si tiene una idea pensada y qué cobertura busca (fotos, video, sesión previa…)"];
      const posiciones = orden.map((o) => bloque.indexOf(o));
      expect(posiciones.every((p) => p >= 0)).toBe(true);
      expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
    });

    it("revisa la fecha apenas la tiene y, si el dueño está ocupado, pregunta si avanzamos o pasa a una persona", () => {
      expect(bloque).toContain("Apenas te da la fecha, usá fecha_disponible antes de seguir");
      expect(bloque).toMatch(/si acepta, seguí; si duda o dice que no, usá pasar_a_persona/);
      expect(bloque).toMatch(/si está completa, usá pasar_a_persona/);
    });

    it("manda el portfolio temprano con la pregunta del paquete, sin repetir el enlace ni escribirlo suelto", () => {
      expect(bloque).toContain("usá paquetes_del_evento y pasale enseguida el enlace");
      expect(bloque).toContain("Te paso nuestros trabajos y los paquetes para que vayas viendo: [enlace de la herramienta] ✨ ¿Alguno te gusta más: Básico, Intermedio o Premium?");
      expect(bloque).toContain("no lo repitas");
      expect(bloque).not.toContain("compramelafoto.com");
    });

    it("el precio del paquete sale de la herramienta, sin aprobación, y la cotización estándar va sola", () => {
      expect(bloque).toContain("decile el precio de ESE paquete tal cual te lo da paquetes_del_evento");
      expect(bloque).toContain("no hace falta pedir aprobación");
      expect(bloque).toContain("usá enviar_cotizacion_del_paquete");
      expect(bloque).not.toMatch(/\$\s?\d/);
    });

    it("con agregados o cambios arma la personalizada con preparar_presupuesto (va a aprobación)", () => {
      expect(bloque).toContain("no uses enviar_cotizacion_del_paquete: usá preparar_presupuesto con el paquete y los cambios en detalle");
      expect(bloque).toContain("la revisa el estudio antes de mandarla");
    });

    it("cierra con la frase del pase que le da la herramienta; es la única excepción a no decir que deriva", () => {
      expect(bloque).toContain("terminá tu mensaje con esa frase tal cual");
      expect(g).toContain('la única excepción es la frase "Te dejo con…" que te da una herramienta en XV Y BODAS');
    });
  });

  it("sabe pedir la foto como Documento cuando no alcanza la calidad", () => {
    expect(guiaDeAtencion()).toContain("como Documento");
    expect(guiaDeAtencion()).toMatch(/Si ya la mandó como documento/);
  });

  it("habla desde el estudio: traer y venir, nunca llevar", () => {
    const g = guiaDeAtencion();
    expect(g).toMatch(/desde adentro del estudio/);
    expect(g).toContain("Podés traerlos hoy");
    expect(g).toMatch(/nunca "llevar"/);
  });

  it("castellano rioplatense semiformal, sin frases de otros países", () => {
    const g = guiaDeAtencion();
    expect(g).toMatch(/rioplatense de Argentina, semiformal/);
    expect(g).toContain('decí "si no tenés apuro"');
  });

  it("para eventos y sesiones pregunta las horas y, si hay muchos invitados, recomienda un segundo fotógrafo", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("cuántas horas dura");
    expect(g).toContain("más de 200 invitados");
    expect(g).toContain("galería online");
  });

  it("no repite lo que el cliente ya dijo, salvo que algo no cierre; salón y localidad alcanzan", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("No repitas los datos que el cliente ya te dio");
    expect(g).toContain("el nombre del salón y la localidad alcanzan");
  });

  it("para cursos usa cursos_del_estudio y no arma cotización", () => {
    expect(guiaDeAtencion()).toContain("cursos_del_estudio");
  });

  it("no supone el plazo: lo pregunta salvo que el cliente lo haya dicho para este pedido", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("Nunca supongas el plazo");
    expect(g).toContain("¿Para cuándo las necesitás?");
  });

  it("arma pedidos de copias con armar_pedido_impresion y ofrece seña o total", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("armar_pedido_impresion");
    expect(g).toContain("la seña");
    expect(g).not.toContain("No armás pedidos ni cobrás todavía");
    expect(g).toContain("resumen por correo");
  });

  it("cobra por transferencia primero y pide el comprobante; el link de Mercado Pago sólo con tarjeta o cuotas", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("CÓMO SE PAGA (transferencia primero)");
    expect(g).toContain("Ofrecé siempre primero la transferencia");
    expect(g).toContain("mande el comprobante por acá");
    expect(g).toContain('medio "tarjeta"');
    expect(g).toContain("tarjeta o en cuotas");
    expect(g).toContain("una sola pregunta por mensaje");
    expect(g).not.toContain("los dos links de pago (seña o total, el que prefiera)");
    expect(g).not.toContain("el enlace del pedido (ahí paga con Mercado Pago)");
  });

  it("la situación dice el día y la hora en Argentina y el nombre si lo hay", () => {
    const s = situacionDeAtencion({ estudio: "DNX Estudio", cliente: "Lucía", ahora: new Date("2026-10-20T23:30:00.000Z") });
    expect(s).toContain("DNX Estudio");
    expect(s).toMatch(/martes, 20 de octubre/);
    expect(s).toContain("20:30");
    expect(s).toContain("Lucía");
    expect(situacionDeAtencion({ estudio: "X", cliente: null, ahora: new Date() })).toContain("No sabemos el nombre");
  });

  it("siempre se puede cobrar: el bot no pasa a una persona para cobrar VHS ni otros productos", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("Nunca pases el chat a una persona para cobrar");
    expect(g).not.toContain("todavía los arma una persona");
  });

  it("foto carnet: confirma cualquier trámite y país, también la visa de Estados Unidos", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("FOTO CARNET");
    expect(g).toContain("visas (también la de Estados Unidos)");
  });

  it("al pasar el chat no dice que deriva: usa frases como si lo resolviera el mismo bot", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("Dejame chequearlo y te confirmo en un ratito.");
    expect(g).toContain("Lo consulto acá en el estudio y enseguida te respondo.");
    expect(g).toContain("Buena pregunta, lo verifico y te escribo en breve.");
    expect(g).toContain("mañana a primera hora");
    expect(g).not.toContain("en breve le escribe alguien del estudio");
  });

  it("el escalón de cantidad se dice 'desde 10 copias' y el plazo de mañana como 'listas mañana a última hora'", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("desde 10 copias");
    expect(g).toContain("de 1 a 9 copias de una medida pagan el precio de la instantánea");
    expect(g).toContain("Si querés tenerlas listas mañana a última hora");
    expect(g).toContain("En el momento, mañana a última hora o la próxima semana");
  });

  it("saluda según la hora y ofrece las opciones; escribe corto, con una carita", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("Buen día, buenas tardes o buenas noches");
    expect(g).toContain("¿En qué te puedo ayudar?");
    expect(g).toContain("digitalizar un video");
    expect(g).toMatch(/al menos un emoji/);
  });

  it("confirma medida y cantidad antes de cobrar y da total y seña en una línea", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("confirmá la medida y la cantidad");
    expect(g).toContain("en una sola línea");
  });

  it("factura: pide los datos; sólo los reclamos pasan a una persona; con proveedores y spam no responde", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("condición frente al IVA");
    expect(g).toContain("no_responder");
    expect(g).not.toMatch(/pedidos de descuento o de factura/);
  });

  it("recomienda Tecnoflash para cámaras y explica que CD y DVD son medios obsoletos", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("Av. Francia 1591");
    expect(g).toContain("recomendado por DNX Estudio");
    expect(g).toMatch(/obsoletos/);
    expect(g).toContain("20x30");
  });

  it("antes de armar cualquier pedido espera el sí del cliente, aunque haya dado todo junto", () => {
    const g = guiaDeAtencion();
    expect(g.match(/esperá que diga que sí, aunque te haya dado todo/g)?.length).toBe(2);
  });

  it("sólo dice que hay una cotización en preparación si la situación lo indica, no por lo que dijo antes en el chat", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("Sólo hay una cotización en preparación si la situación de este turno lo dice");
    expect(situacionDeAtencion({ estudio: "E", cliente: null, ahora: new Date("2026-11-09T14:00:00Z") })).toContain("No hay ninguna cotización en preparación");
  });

  it("con fotos o videos sin explicación no supone que son para imprimir, no dice que no trabajamos con video y deriva los archivos de un trabajo en curso", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("ARCHIVOS SIN EXPLICACIÓN");
    expect(g).toContain("no supongas que son para imprimir");
    expect(g).toContain("Nunca digas que no trabajamos con videos");
    expect(g).toContain("archivos para un trabajo en curso");
    expect(g).toContain("edición de videos, recortar y unir videos, copiado de videos");
    expect(g).toContain("los analiza y los cotiza una persona del estudio");
    expect(g).toContain("trabajo de video: ");
  });
  it("un anuncio de XV es cobertura de la fiesta aunque hable de edición: primero la fecha", () => {
    const g = guiaDeAtencion();
    expect(g).toContain('TEMA: cobertura fotográfica de una fiesta de XV');
    expect(g).toContain("no le preguntes si quiere retocar fotos que ya tiene");
    expect(g).toContain("¿Para qué fecha es la fiesta? 🎉");
  });

  it("en Instagram pide el WhatsApp para cotizar y manda las copias e impresiones a WhatsApp por el enlace", () => {
    const base = { estudio: "DNX Estudio", cliente: "Sofi", ahora: new Date("2026-11-18T15:00:00Z") };
    const ig = situacionDeAtencion({ ...base, canal: "INSTAGRAM" });
    expect(ig).toContain("Instagram");
    expect(ig).toContain("WhatsApp");
    expect(ig).toContain("https://wa.me/543413419869?text=Hola%2C%20vengo%20de%20Instagram");
    expect(ig).toContain("preparar_presupuesto");
    expect(ig).toMatch(/no armes pedidos/);
    // WhatsApp: la situación no cambia.
    expect(situacionDeAtencion({ ...base, canal: "WHATSAPP" })).toBe(situacionDeAtencion(base));
    expect(situacionDeAtencion(base)).not.toContain("Instagram");
  });
});
