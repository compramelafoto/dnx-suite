/**
 * Los diez pasos del recorrido de un participante, en seco.
 *
 * Regla de oro del módulo: acá no se reimplementa ninguna regla. Cada paso le
 * pregunta a la misma función que usa el sitio público, con el reloj parado en
 * el momento que eligió quien administra. Si una regla está mal, el ensayo
 * falla igual que fallaría la persona.
 *
 * No toca Prisma ni la red: la inscripción corre contra el repositorio en
 * memoria y la foto de prueba es un EXIF sintético. Se puede correr con la
 * maratón en curso sin ningún riesgo.
 */

import type { EditionClock } from "@/lib/timeline/clock";
import { evaluateAccreditationEligibility } from "@/lib/accreditation/eligibility";
import {
  evaluateCaptureDate,
  evaluateGps,
  getUploadWindowState,
  isPromptReleasedForUpload,
  resolveEffectiveWindows,
} from "@/lib/photo-upload/windows";
import { resolveCurrentPricePhase } from "@/lib/pricing/domain/resolve-price-phase";
import { resolvePromptGate } from "@/lib/timeline/prompt-gate";
import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  seedPublicEdition,
  seedPublicTicket,
} from "@/lib/public-registration/infrastructure/in-memory-public-registration-repository";
import { createPublicRegistrationService } from "@/lib/public-registration/application/public-registration-service";
import { eventosParaElPorton, momentoDeLiberacion } from "../domain/timeline-presets";
import type { ConsignaDeEdicion, FotoDeEdicion, ResultadoPaso } from "../domain/types";

function paso(
  numero: number,
  nombre: string,
  estado: ResultadoPaso["estado"],
  queVeria: string,
  detalle: string,
  comoArreglar: string | null = null,
): ResultadoPaso {
  return { numero, nombre, estado, queVeria, detalle, comoArreglar };
}

/** Consignas que el cronograma puede llegar a liberar. */
function consignasVigentes(foto: FotoDeEdicion): ConsignaDeEdicion[] {
  return foto.consignas.filter((c) => c.estado !== "DRAFT" && c.estado !== "CANCELLED");
}

/**
 * Arma un catálogo en memoria con los datos de la edición real, para que el
 * servicio de inscripción de verdad responda sobre esta edición.
 */
function tiendaDesdeLaFoto(foto: FotoDeEdicion) {
  const store = createInMemoryPublicStore();
  seedPublicEdition(store, {
    id: foto.id,
    slug: foto.slug,
    name: foto.nombre,
    shortDescription: null,
    status: foto.estado,
    isPublished: foto.publicada,
    registrationEnabled: foto.inscripcionHabilitada,
    registrationOpenAt: foto.inscripcionAbreEl,
    registrationCloseAt: foto.inscripcionCierraEl,
    startAt: foto.comienzaEl,
    endAt: foto.terminaEl,
    timezone: foto.zonaHoraria,
    visibleCodePrefix: foto.prefijoDeCodigo,
  });

  for (const entrada of foto.entradas) {
    seedPublicTicket(store, {
      id: entrada.id,
      editionId: foto.id,
      venueId: null,
      name: entrada.nombre,
      description: null,
      code: entrada.codigo,
      priceAmount: entrada.precio,
      currency: foto.moneda,
      // El cupo del ensayo refleja si la entrada está agotada de verdad.
      capacity: entrada.agotada ? 0 : entrada.cupo,
      holdMinutes: 20,
      isActive: true,
      salesStartAt: foto.inscripcionAbreEl,
      salesEndAt: foto.inscripcionCierraEl,
      products: [],
    });
  }

  for (const fase of foto.fasesDePrecio) {
    if (!fase.comienzaEl || !fase.terminaEl) continue;
    store.pricePhases.set(fase.id, {
      id: fase.id,
      editionId: foto.id,
      name: fase.nombre,
      description: null,
      amount: fase.monto,
      currency: foto.moneda,
      startsAt: fase.comienzaEl,
      endsAt: fase.terminaEl,
      capacity: null,
      priority: 100,
      isActive: true,
    });
  }

  return store;
}

const MOTIVOS_DE_OFERTA: Record<string, string> = {
  edition_unavailable: "La edición no está disponible para inscribirse.",
  window_not_open: "La inscripción todavía no abrió.",
  window_closed: "La inscripción ya cerró.",
  no_tickets: "No hay ninguna entrada cargada.",
  sold_out: "No queda ninguna entrada a la venta.",
};

/** Pasos 1 y 2: la página pública y la inscripción. */
async function pasosDeInscripcion(
  foto: FotoDeEdicion,
  clock: EditionClock,
): Promise<{ pasos: ResultadoPaso[]; puedeSeguir: boolean }> {
  const store = tiendaDesdeLaFoto(foto);
  const servicio = createPublicRegistrationService({
    repo: createInMemoryPublicRegistrationRepository(store, { clock }),
    clock,
    // En seco no se escribe nada: el alta del Pack 4 queda desactivada.
    ensurePackTicket: async () => null,
  });

  const oferta = await servicio.getOffer(foto.slug);

  const paso1 = oferta.available
    ? paso(
        1,
        "Mira la página de la maratón",
        "PASO",
        `El botón dice «${oferta.label ?? "Inscribirme"}» y lleva a la inscripción.`,
        "La página pública ofrece inscribirse en este momento.",
      )
    : paso(
        1,
        "Mira la página de la maratón",
        "FALLO",
        MOTIVOS_DE_OFERTA[oferta.reason ?? ""] ?? "La página no ofrece inscribirse.",
        `La página pública no deja inscribirse en este momento (motivo: ${oferta.reason ?? "desconocido"}).`,
        "Revisá la ventana de inscripción, la fase de precio y el cupo de las entradas.",
      );

  if (!oferta.available) {
    return {
      pasos: [
        paso1,
        paso(
          2,
          "Se inscribe",
          "NO_CORRESPONDE",
          "No llegó a ver el formulario.",
          "No se pudo llegar hasta acá: la página no ofrecía inscribirse.",
        ),
      ],
      puedeSeguir: false,
    };
  }

  const contexto = await servicio.getContext(foto.slug);
  const entradasALaVenta = contexto?.tickets.filter((t) => t.salesStatus === "open") ?? [];

  /**
   * La fase de precio no se mira al abrir la página: se resuelve recién cuando
   * la persona confirma. Por eso una fase vencida no se nota hasta este punto —
   * y por eso hay que preguntársela a la misma función que usa el servicio.
   */
  const necesitaFase = foto.entradas.some((e) => e.precio > 0);
  const faseVigente = necesitaFase
    ? resolveCurrentPricePhase(
        foto.fasesDePrecio
          .filter((f) => f.comienzaEl !== null && f.terminaEl !== null)
          .map((f) => ({
            id: f.id,
            editionId: foto.id,
            name: f.nombre,
            description: null,
            amount: f.monto,
            currency: foto.moneda,
            startsAt: f.comienzaEl as Date,
            endsAt: f.terminaEl as Date,
            capacity: null,
            priority: 100,
            isActive: true,
          })),
        clock.now(),
      )
    : null;

  let paso2: ResultadoPaso;
  if (entradasALaVenta.length === 0) {
    paso2 = paso(
      2,
      "Se inscribe",
      "FALLO",
      "El formulario abre pero no hay ninguna entrada para elegir.",
      "No hay entradas a la venta en este momento, así que la inscripción no se puede completar.",
      "Revisá las fechas de venta y el cupo de las entradas en Precios.",
    );
  } else if (necesitaFase && !faseVigente) {
    paso2 = paso(
      2,
      "Se inscribe",
      "FALLO",
      "Completa sus datos, aprieta confirmar y la inscripción se corta.",
      "La página ofrece inscribirse, pero en este momento no hay ninguna fase de precio vigente: el sistema no sabe cuánto cobrar. Extender la inscripción son dos fechas, y acá quedó movida sólo una.",
      "Alargá la fase de precio hasta el cierre de la inscripción, en Precios.",
    );
  } else {
    paso2 = paso(
      2,
      "Se inscribe",
      "PASO",
      `Elige entre ${entradasALaVenta.length} ${entradasALaVenta.length === 1 ? "entrada" : "entradas"} y completa sus datos.`,
      faseVigente
        ? `El formulario carga con la fase «${faseVigente.phase.name}» vigente y el cupo disponible.`
        : "El formulario carga con el cupo disponible. La edición es gratuita, así que no hay fase de precio.",
    );
  }

  return { pasos: [paso1, paso2], puedeSeguir: paso2.estado === "PASO" };
}

/** Pasos 3 a 6: pago, correo, credencial y acreditación. */
function pasosDeConfirmacion(foto: FotoDeEdicion): ResultadoPaso[] {
  const gratuita = foto.entradas.every((e) => e.precio === 0);

  const paso3 = gratuita
    ? paso(
        3,
        "Confirma la inscripción",
        "PASO",
        "Como la entrada es gratuita, queda confirmada sin pasar por el pago.",
        "La inscripción se confirma directo.",
      )
    : foto.mercadoPagoConectado
      ? paso(
          3,
          "Paga la inscripción",
          "PASO",
          "Va a Mercado Pago, paga y vuelve con la inscripción confirmada.",
          "La cuenta de cobro está conectada, así que el pago puede completarse.",
        )
      : paso(
          3,
          "Paga la inscripción",
          "FALLO",
          "Llega al pago y no puede pagar.",
          "No hay cuenta de Mercado Pago conectada para cobrar esta edición.",
          "Conectá la cuenta de Mercado Pago desde Finanzas.",
        );

  const paso4 = paso(
    4,
    "Recibe el correo de confirmación",
    paso3.estado === "PASO" ? "PASO" : "NO_CORRESPONDE",
    paso3.estado === "PASO"
      ? `Le llega «Inscripción confirmada — ${foto.nombre}» con su código y el resumen.`
      : "No llegó a confirmarse, así que no se manda ningún correo.",
    paso3.estado === "PASO"
      ? "El correo se arma con los datos de la inscripción. En el ensayo se genera pero no se envía."
      : "No se pudo llegar hasta acá.",
  );

  const paso5 = paso(
    5,
    "Recibe su credencial con QR",
    paso3.estado === "PASO" ? "PASO" : "NO_CORRESPONDE",
    paso3.estado === "PASO"
      ? `Ve su credencial con el código ${foto.prefijoDeCodigo ?? "SIN-PREFIJO"}-0001 y el QR para el ingreso.`
      : "No llegó a confirmarse, así que no se emite credencial.",
    paso3.estado === "PASO"
      ? "La credencial se emite al confirmarse la inscripción."
      : "No se pudo llegar hasta acá.",
    paso3.estado === "PASO" && !foto.prefijoDeCodigo
      ? "Cargá el prefijo de códigos visibles de la edición para que los números salgan prolijos."
      : null,
  );

  // La elegibilidad la decide la misma función que usa el escáner del evento.
  const elegibilidad = evaluateAccreditationEligibility({
    registrationStatus: "CONFIRMED",
    paymentStatus: gratuita ? "NOT_REQUIRED" : "APPROVED",
    hasActiveCredential: true,
    alreadyCheckedIn: false,
    accreditationEnabled: foto.acreditacionHabilitada,
    withinAccreditationWindow: null,
    grantException: false,
  });

  const paso6 =
    paso3.estado !== "PASO"
      ? paso(
          6,
          "Se acredita en la puerta",
          "NO_CORRESPONDE",
          "No llegó a tener credencial.",
          "No se pudo llegar hasta acá.",
        )
      : elegibilidad.ok
        ? paso(
            6,
            "Se acredita en la puerta",
            "PASO",
            "El escáner da verde y queda registrado su ingreso.",
            `El control de acreditación responde ${elegibilidad.reason}.`,
          )
        : paso(
            6,
            "Se acredita en la puerta",
            "FALLO",
            "El escáner no lo deja pasar.",
            `El control de acreditación responde ${elegibilidad.reason}.`,
            elegibilidad.reason === "ACCREDITATION_DISABLED"
              ? "Encendé la acreditación de la edición."
              : "Revisá la configuración de acreditación.",
          );

  return [paso3, paso4, paso5, paso6];
}

/** Pasos 7 y 8: la pantalla en vivo y la apertura de las consignas. */
function pasosDeConsignas(foto: FotoDeEdicion, clock: EditionClock): ResultadoPaso[] {
  const vigentes = consignasVigentes(foto);
  const portón = resolvePromptGate({
    prompts: foto.consignas.map((c) => ({
      status: c.estado,
      releasedAt: c.liberadaEl,
      captureStartsAt: c.capturaAbreEl,
    })),
    events: eventosParaElPorton(foto),
    editionStartAt: foto.comienzaEl,
    clock,
  });

  const paso7 = portón.isOpen
    ? paso(
        7,
        "Entra a la pantalla de la maratón",
        "PASO",
        "Ve que las consignas ya están abiertas.",
        "La pantalla del participante muestra el contenido en vivo.",
      )
    : portón.opensAt
      ? paso(
          7,
          "Entra a la pantalla de la maratón",
          "PASO",
          "Ve una cuenta regresiva hasta que se abran las consignas.",
          `Todavía no es la hora: abren a las ${portón.opensAt.toISOString()}.`,
        )
      : paso(
          7,
          "Entra a la pantalla de la maratón",
          "FALLO",
          "Ve una pantalla sin cuenta regresiva ni contenido.",
          "No hay ninguna fecha de apertura resuelta: el cronograma no dice cuándo abren las consignas.",
          "Cargá el evento de liberación en el cronograma o la fecha de inicio de la edición.",
        );

  let paso8: ResultadoPaso;
  if (!portón.isOpen) {
    paso8 = paso(
      8,
      "Se abren las consignas",
      "NO_CORRESPONDE",
      "Todavía no es la hora.",
      "En el momento simulado las consignas aún no abrieron.",
    );
  } else if (vigentes.length === 0) {
    paso8 = paso(
      8,
      "Se abren las consignas",
      "FALLO",
      "La cuenta regresiva llega a cero y no aparece ninguna consigna.",
      foto.consignas.length > 0
        ? "Todas las consignas están en borrador o canceladas: el cronograma no las libera."
        : "No hay ninguna consigna cargada en la edición.",
      "Cargá las consignas y sacalas de borrador.",
    );
  } else {
    paso8 = paso(
      8,
      "Se abren las consignas",
      "PASO",
      `Ve las ${vigentes.length} ${vigentes.length === 1 ? "consigna" : "consignas"}, todas juntas.`,
      `El portón abrió por ${portón.source}.`,
    );
  }

  return [paso7, paso8];
}

/** Pasos 9 y 10: subir una foto y que la admisión técnica la revise. */
function pasosDeSubida(foto: FotoDeEdicion, clock: EditionClock): ResultadoPaso[] {
  const vigentes = consignasVigentes(foto);
  const consigna = vigentes[0];

  if (!consigna) {
    return [
      paso(9, "Sube una foto", "NO_CORRESPONDE", "No hay consigna a la que subir.", "No se pudo llegar hasta acá."),
      paso(10, "La admisión técnica la revisa", "NO_CORRESPONDE", "No hay foto que revisar.", "No se pudo llegar hasta acá."),
    ];
  }

  if (!foto.subidaHabilitada) {
    return [
      paso(
        9,
        "Sube una foto",
        "FALLO",
        "Aprieta subir y el sistema le dice que no puede.",
        "La subida de fotos está apagada en la configuración de la edición.",
        "Encendé la subida de fotos de la edición.",
      ),
      paso(10, "La admisión técnica la revisa", "NO_CORRESPONDE", "No hay foto que revisar.", "No se pudo llegar hasta acá."),
    ];
  }

  const ventanas = resolveEffectiveWindows({
    status: consigna.estado,
    releasedAt: consigna.liberadaEl,
    captureStartsAt: consigna.capturaAbreEl,
    captureEndsAt: consigna.capturaCierraEl,
    uploadStartsAt: consigna.subidaAbreEl,
    uploadEndsAt: consigna.subidaCierraEl,
  });
  const estadoDeVentana = getUploadWindowState(ventanas, clock);
  const liberadaParaSubir = isPromptReleasedForUpload(consigna.estado) || consigna.liberadaEl !== null;

  if (estadoDeVentana === "NOT_CONFIGURED") {
    return [
      paso(
        9,
        "Sube una foto",
        "FALLO",
        "El sistema no sabe si puede recibir la foto.",
        "La consigna no tiene horario de subida y la edición tampoco.",
        "Cargá el horario de subida de la consigna o de la edición.",
      ),
      paso(10, "La admisión técnica la revisa", "NO_CORRESPONDE", "No hay foto que revisar.", "No se pudo llegar hasta acá."),
    ];
  }

  if (estadoDeVentana !== "OPEN") {
    const texto =
      estadoDeVentana === "NOT_OPEN"
        ? "Todavía no se puede subir: la ventana no abrió."
        : "Ya no se puede subir: la ventana cerró.";
    return [
      paso(9, "Sube una foto", "NO_CORRESPONDE", texto, `En el momento simulado la ventana de subida está en ${estadoDeVentana}.`),
      paso(10, "La admisión técnica la revisa", "NO_CORRESPONDE", "No hay foto que revisar.", "No se pudo llegar hasta acá."),
    ];
  }

  if (!liberadaParaSubir && consigna.estado !== "READY") {
    return [
      paso(
        9,
        "Sube una foto",
        "FALLO",
        "La consigna está abierta en pantalla pero el sistema rechaza la carga.",
        `La consigna está en estado ${consigna.estado}, que no admite subidas.`,
        "Revisá el estado de la consigna.",
      ),
      paso(10, "La admisión técnica la revisa", "NO_CORRESPONDE", "No hay foto que revisar.", "No se pudo llegar hasta acá."),
    ];
  }

  const paso9 = paso(
    9,
    "Sube una foto",
    "PASO",
    "Elige una foto, la sube y ve la confirmación.",
    "La ventana de subida está abierta y la consigna admite la carga.",
  );

  /**
   * Foto de prueba: se la fecha en el medio de la ventana de captura, que es
   * lo que haría alguien que participa de verdad.
   */
  const inicioCaptura = ventanas.captureStartsAt;
  const finCaptura = ventanas.captureEndsAt;
  const fechaDeCaptura =
    inicioCaptura && finCaptura
      ? new Date(Math.round((inicioCaptura.getTime() + finCaptura.getTime()) / 2))
      : inicioCaptura;

  const evaluacion = evaluateCaptureDate({
    captureDate: fechaDeCaptura,
    windows: ventanas,
    toleranceMinutes: 5,
    timezone: foto.zonaHoraria,
  });
  const gps = evaluateGps({ mode: "OPTIONAL", latitude: null, longitude: null });

  if (!foto.admisionHabilitada) {
    return [
      paso9,
      paso(
        10,
        "La admisión técnica la revisa",
        "NO_CORRESPONDE",
        "La foto queda cargada, esperando que alguien la mire a mano.",
        "La admisión técnica está apagada, así que nada se revisa automáticamente.",
        "Encendé la admisión técnica si querés que las fotos se revisen solas.",
      ),
    ];
  }

  const paso10 =
    evaluacion.result === "PASS"
      ? paso(
          10,
          "La admisión técnica la revisa",
          "PASO",
          "La foto queda aprobada.",
          `La hora de captura cae dentro de la ventana (${evaluacion.reason}) y el GPS da ${gps.status}.`,
        )
      : evaluacion.result === "FAIL"
        ? paso(
            10,
            "La admisión técnica la revisa",
            "FALLO",
            "La foto queda rechazada.",
            `La revisión automática la rechaza: ${evaluacion.reason}.`,
            "Revisá las ventanas de captura de la consigna: una foto sacada en el horario correcto no debería rechazarse.",
          )
        : paso(
            10,
            "La admisión técnica la revisa",
            "FALLO",
            "La foto queda para revisión manual.",
            `La revisión automática no puede decidir sola: ${evaluacion.reason}.`,
            "Cargá el horario de captura de la consigna para que la revisión pueda resolver sola.",
          );

  return [paso9, paso10];
}

/**
 * Cómo se mueve el reloj durante el ensayo.
 *
 * - `RECORRIDO`: cada paso se evalúa en el momento en que de verdad ocurriría.
 *   La persona se inscribe en septiembre y saca fotos en octubre: en un único
 *   instante es imposible que los diez pasos den verde, porque cuando la
 *   inscripción está abierta todavía no hay consignas, y cuando hay consignas la
 *   inscripción ya cerró. Responde «¿funciona todo el recorrido?».
 * - `INSTANTE`: todos los pasos se evalúan en el mismo momento elegido.
 *   Responde «¿qué le pasa a alguien que entra a esta hora?».
 */
export type ModoDeEnsayo = "RECORRIDO" | "INSTANTE";

function relojFijo(momento: Date): EditionClock {
  return { now: () => new Date(momento.getTime()) };
}

/**
 * Momento natural de cada tramo del recorrido, según el cronograma.
 * `null` cuando el dato no está cargado: ahí se usa el reloj elegido.
 */
function momentosDelRecorrido(foto: FotoDeEdicion, clock: EditionClock) {
  const ahora = clock.now();
  const libera = momentoDeLiberacion(foto, clock);

  const abre = foto.inscripcionAbreEl;
  const cierra = foto.inscripcionCierraEl;
  // Un minuto antes del cierre: el caso más exigente de la venta.
  const duranteLaVenta =
    cierra && abre && cierra.getTime() > abre.getTime()
      ? new Date(cierra.getTime() - 60_000)
      : (abre ?? ahora);

  const vigentes = consignasVigentes(foto);
  const capturaAbre =
    libera ??
    vigentes
      .map((c) => c.capturaAbreEl)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ??
    foto.comienzaEl;
  const capturaCierra = vigentes
    .map((c) => c.capturaCierraEl)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const enPlenaCaptura =
    capturaAbre && capturaCierra
      ? new Date(Math.round((capturaAbre.getTime() + capturaCierra.getTime()) / 2))
      : (capturaAbre ?? ahora);

  return {
    /** Inscripción, pago, correo y credencial. */
    venta: duranteLaVenta,
    /** Acreditación: el día del evento, antes de que arranque. */
    puerta: foto.comienzaEl ? new Date(foto.comienzaEl.getTime() - 30 * 60_000) : enPlenaCaptura,
    /** Consignas: un minuto después de la apertura. */
    consignas: libera ? new Date(libera.getTime() + 60_000) : enPlenaCaptura,
    /** Subida: en plena captura. */
    captura: enPlenaCaptura,
  };
}

/** Corre el recorrido completo sobre una foto ya cargada. */
export async function correrPasosEnSeco(input: {
  foto: FotoDeEdicion;
  clock: EditionClock;
  modo?: ModoDeEnsayo;
}): Promise<ResultadoPaso[]> {
  const { foto, clock } = input;
  const modo = input.modo ?? "RECORRIDO";

  const momentos = momentosDelRecorrido(foto, clock);
  const relojVenta = modo === "RECORRIDO" ? relojFijo(momentos.venta) : clock;
  const relojConsignas = modo === "RECORRIDO" ? relojFijo(momentos.consignas) : clock;
  const relojCaptura = modo === "RECORRIDO" ? relojFijo(momentos.captura) : clock;

  const inscripcion = await pasosDeInscripcion(foto, relojVenta);

  /**
   * El corte en cascada sólo tiene sentido en el modo recorrido, donde se
   * sigue a una misma persona: si no se pudo inscribir, no llega a nada más.
   *
   * En el modo instante la pregunta es otra —«¿qué está pasando a esta
   * hora?»— y quien ya se inscribió hace semanas se acredita y sube fotos
   * igual, aunque en ese momento la inscripción esté cerrada.
   */
  if (modo === "RECORRIDO" && !inscripcion.puedeSeguir) {
    const cortados = [3, 4, 5, 6, 7, 8, 9, 10].map((numero) =>
      paso(
        numero,
        NOMBRES_DE_PASO[numero] ?? `Paso ${numero}`,
        "NO_CORRESPONDE",
        "No llegó hasta acá.",
        "El recorrido se cortó en la inscripción.",
      ),
    );
    return [...inscripcion.pasos, ...cortados];
  }

  return [
    ...inscripcion.pasos,
    ...pasosDeConfirmacion(foto),
    ...pasosDeConsignas(foto, relojConsignas),
    ...pasosDeSubida(foto, relojCaptura),
  ];
}

const NOMBRES_DE_PASO: Record<number, string> = {
  1: "Mira la página de la maratón",
  2: "Se inscribe",
  3: "Paga la inscripción",
  4: "Recibe el correo de confirmación",
  5: "Recibe su credencial con QR",
  6: "Se acredita en la puerta",
  7: "Entra a la pantalla de la maratón",
  8: "Se abren las consignas",
  9: "Sube una foto",
  10: "La admisión técnica la revisa",
};
