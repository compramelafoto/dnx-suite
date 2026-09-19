/**
 * Reglas del chequeo de una edición.
 *
 * Funciones puras sobre una `FotoDeEdicion`: no tocan Prisma, no leen la hora
 * de la máquina (usan el reloj que se les pasa) y no arman texto de interfaz
 * más allá del que viaja dentro del hallazgo.
 *
 * Cada control emite siempre un hallazgo, incluso cuando todo está bien: la
 * pantalla necesita poder mostrar los verdes además de los rojos.
 */

import { systemClock, type EditionClock } from "@/lib/timeline/clock";
import type {
  ConsignaDeEdicion,
  FotoDeEdicion,
  Hallazgo,
  Rubro,
  Severidad,
} from "./types";

function hallazgo(input: {
  id: string;
  rubro: Rubro;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  comoArreglar?: string | null;
  enlace?: string | null;
}): Hallazgo {
  return {
    id: input.id,
    rubro: input.rubro,
    severidad: input.severidad,
    titulo: input.titulo,
    detalle: input.detalle,
    comoArreglar: input.comoArreglar ?? null,
    enlace: input.enlace ?? null,
  };
}

/** Las consignas que forman parte del evento: borradores y canceladas no cuentan. */
function consignasQueCuentan(consignas: ConsignaDeEdicion[]): ConsignaDeEdicion[] {
  return consignas.filter((c) => c.estado !== "DRAFT" && c.estado !== "CANCELLED");
}

function hayEntradaPaga(foto: FotoDeEdicion): boolean {
  return foto.entradas.some((e) => e.precio > 0);
}

function revisarPublicacion(foto: FotoDeEdicion): Hallazgo[] {
  const salida: Hallazgo[] = [];

  salida.push(
    foto.publicada
      ? hallazgo({
          id: "edicion-no-publicada",
          rubro: "PUBLICACION",
          severidad: "BIEN",
          titulo: "La edición está publicada",
          detalle: "Se ve en el sitio y su enlace público funciona.",
        })
      : hallazgo({
          id: "edicion-no-publicada",
          rubro: "PUBLICACION",
          severidad: "ATENCION",
          titulo: "La edición no está publicada",
          detalle:
            "Nadie puede llegar a la página de la edición desde el sitio. Si todavía la estás preparando, está bien; si ya la estás difundiendo, no van a poder entrar.",
          comoArreglar: "Publicala desde el botón Publicar de la ficha de la edición.",
          enlace: "editar",
        }),
  );

  salida.push(
    foto.inscripcionHabilitada
      ? hallazgo({
          id: "inscripcion-deshabilitada",
          rubro: "PUBLICACION",
          severidad: "BIEN",
          titulo: "La inscripción está habilitada",
          detalle: "El interruptor general de inscripción está encendido.",
        })
      : hallazgo({
          id: "inscripcion-deshabilitada",
          rubro: "PUBLICACION",
          severidad: "ATENCION",
          titulo: "La inscripción está deshabilitada",
          detalle:
            "Aunque las fechas estén bien, el interruptor general está apagado y nadie puede inscribirse.",
          comoArreglar: "Encendé la inscripción en Editar edición.",
          enlace: "editar",
        }),
  );

  return salida;
}

function revisarVenta(foto: FotoDeEdicion, ahora: Date): Hallazgo[] {
  const salida: Hallazgo[] = [];
  const t = ahora.getTime();

  // Entradas cargadas.
  salida.push(
    foto.entradas.length > 0
      ? hallazgo({
          id: "sin-entradas",
          rubro: "VENTA",
          severidad: "BIEN",
          titulo: `${foto.entradas.length} ${foto.entradas.length === 1 ? "entrada cargada" : "entradas cargadas"}`,
          detalle: "Hay al menos un tipo de entrada para inscribirse.",
        })
      : hallazgo({
          id: "sin-entradas",
          rubro: "VENTA",
          severidad: "BLOQUEANTE",
          titulo: "No hay ninguna entrada cargada",
          detalle:
            "Sin tipos de entrada no hay nada que comprar: la página de inscripción no le ofrece nada a la persona.",
          comoArreglar: "Cargá al menos una entrada en Precios.",
          enlace: "precios",
        }),
  );

  // Cupos.
  const todasAgotadas = foto.entradas.length > 0 && foto.entradas.every((e) => e.agotada);
  salida.push(
    todasAgotadas
      ? hallazgo({
          id: "entradas-agotadas",
          rubro: "VENTA",
          severidad: "ATENCION",
          titulo: "Todas las entradas están agotadas",
          detalle:
            "No queda cupo en ninguna entrada. Si esperabas seguir vendiendo, hay que ampliar el cupo.",
          comoArreglar: "Ampliá el cupo de alguna entrada en Precios.",
          enlace: "precios",
        })
      : hallazgo({
          id: "entradas-agotadas",
          rubro: "VENTA",
          severidad: "BIEN",
          titulo: "Hay cupo disponible",
          detalle: "Al menos una entrada tiene lugares libres.",
        }),
  );

  // Fase de precio: existe.
  const necesitaFase = hayEntradaPaga(foto);
  salida.push(
    !necesitaFase
      ? hallazgo({
          id: "sin-fase-de-precio",
          rubro: "VENTA",
          severidad: "BIEN",
          titulo: "La edición es gratuita",
          detalle: "No hace falta fase de precio porque ninguna entrada tiene costo.",
        })
      : foto.fasesDePrecio.length > 0
        ? hallazgo({
            id: "sin-fase-de-precio",
            rubro: "VENTA",
            severidad: "BIEN",
            titulo: `${foto.fasesDePrecio.length} ${foto.fasesDePrecio.length === 1 ? "fase de precio cargada" : "fases de precio cargadas"}`,
            detalle: "Hay al menos una fase que define qué se cobra.",
          })
        : hallazgo({
            id: "sin-fase-de-precio",
            rubro: "VENTA",
            severidad: "BLOQUEANTE",
            titulo: "No hay ninguna fase de precio",
            detalle:
              "Las entradas tienen costo pero no hay ninguna fase que diga cuánto se cobra en este momento. La inscripción se corta al llegar al pago.",
            comoArreglar: "Cargá una fase de precio que cubra toda la ventana de inscripción.",
            enlace: "precios",
          }),
  );

  // Las dos fechas: la fase tiene que cubrir la ventana.
  const finDeLaUltimaFase = foto.fasesDePrecio
    .map((f) => f.terminaEl?.getTime() ?? null)
    .filter((x): x is number => x !== null)
    .reduce<number | null>((max, x) => (max === null || x > max ? x : max), null);
  const cierreDeVentana = foto.inscripcionCierraEl?.getTime() ?? null;
  const faseSeQuedaCorta =
    necesitaFase &&
    finDeLaUltimaFase !== null &&
    cierreDeVentana !== null &&
    finDeLaUltimaFase < cierreDeVentana;

  salida.push(
    faseSeQuedaCorta
      ? hallazgo({
          id: "fase-de-precio-mas-corta-que-la-ventana",
          rubro: "VENTA",
          severidad: "BLOQUEANTE",
          titulo: "La fase de precio termina antes que la inscripción",
          detalle:
            "Extender la inscripción son dos fechas: la ventana de inscripción y la fase de precio. Acá la ventana sigue abierta después de que venció la última fase, así que la venta se va a cortar sola ese día aunque el sitio muestre la inscripción abierta.",
          comoArreglar:
            "Alargá la última fase de precio hasta el cierre de la inscripción, o acortá la ventana de inscripción.",
          enlace: "precios",
        })
      : hallazgo({
          id: "fase-de-precio-mas-corta-que-la-ventana",
          rubro: "VENTA",
          severidad: "BIEN",
          titulo: "Las fechas de precio y de inscripción coinciden",
          detalle: "La fase de precio cubre toda la ventana de inscripción.",
        }),
  );

  // Estado de la ventana ahora mismo.
  const abre = foto.inscripcionAbreEl?.getTime() ?? null;
  const cierra = cierreDeVentana;
  if (abre !== null && abre > t) {
    salida.push(
      hallazgo({
        id: "inscripcion-no-abrio",
        rubro: "VENTA",
        severidad: "ATENCION",
        titulo: "La inscripción todavía no abrió",
        detalle:
          "En este momento la página muestra que la inscripción abre más adelante. Es normal si todavía falta.",
        comoArreglar: "Si esperabas que ya estuviera abierta, adelantá la fecha de apertura.",
        enlace: "editar",
      }),
    );
  } else if (cierra !== null && cierra < t) {
    salida.push(
      hallazgo({
        id: "inscripcion-cerrada",
        rubro: "VENTA",
        severidad: "ATENCION",
        titulo: "La inscripción ya cerró",
        detalle:
          "En este momento nadie puede inscribirse. Es lo esperable si la maratón ya pasó.",
        comoArreglar:
          "Si querés reabrirla, movés el cierre de la inscripción y también el fin de la fase de precio.",
        enlace: "editar",
      }),
    );
  } else {
    salida.push(
      hallazgo({
        id: "inscripcion-abierta",
        rubro: "VENTA",
        severidad: "BIEN",
        titulo: "La inscripción está abierta",
        detalle: "En este momento una persona puede inscribirse.",
      }),
    );
  }

  // Mercado Pago.
  salida.push(
    !hayEntradaPaga(foto)
      ? hallazgo({
          id: "mercado-pago-sin-conectar",
          rubro: "VENTA",
          severidad: "BIEN",
          titulo: "No hace falta Mercado Pago",
          detalle: "Todas las entradas son gratuitas.",
        })
      : foto.mercadoPagoConectado
        ? hallazgo({
            id: "mercado-pago-sin-conectar",
            rubro: "VENTA",
            severidad: "BIEN",
            titulo: "Mercado Pago está conectado",
            detalle: "La cuenta que cobra está vinculada y activa.",
          })
        : hallazgo({
            id: "mercado-pago-sin-conectar",
            rubro: "VENTA",
            severidad: "BLOQUEANTE",
            titulo: "Mercado Pago no está conectado",
            detalle:
              "Hay entradas con costo pero no hay cuenta de cobro vinculada: la persona llega al pago y no puede pagar.",
            comoArreglar: "Conectá la cuenta de Mercado Pago desde Finanzas.",
            enlace: "finanzas",
          }),
  );

  return salida;
}

function revisarCronograma(foto: FotoDeEdicion): Hallazgo[] {
  const salida: Hallazgo[] = [];

  salida.push(
    foto.tieneCronogramaActivo
      ? hallazgo({
          id: "sin-cronograma",
          rubro: "CRONOGRAMA",
          severidad: "BIEN",
          titulo: "Hay un cronograma activo",
          detalle: "La edición tiene cronograma publicado y en uso.",
        })
      : hallazgo({
          id: "sin-cronograma",
          rubro: "CRONOGRAMA",
          severidad: "BLOQUEANTE",
          titulo: "No hay cronograma activo",
          detalle:
            "Sin cronograma activo no hay nada que libere las consignas ni que le muestre al participante en qué momento está.",
          comoArreglar: "Armá y activá el cronograma de la edición.",
          enlace: "cronograma",
        }),
  );

  const invertido =
    foto.comienzaEl !== null &&
    foto.terminaEl !== null &&
    foto.comienzaEl.getTime() > foto.terminaEl.getTime();
  salida.push(
    invertido
      ? hallazgo({
          id: "cronograma-invertido",
          rubro: "CRONOGRAMA",
          severidad: "BLOQUEANTE",
          titulo: "La maratón termina antes de empezar",
          detalle:
            "La fecha de fin es anterior a la de inicio. Todo lo que dependa de la duración del evento va a calcular mal.",
          comoArreglar: "Corregí las fechas de inicio y fin en Editar edición.",
          enlace: "editar",
        })
      : hallazgo({
          id: "cronograma-invertido",
          rubro: "CRONOGRAMA",
          severidad: "BIEN",
          titulo: "Las fechas de la maratón son coherentes",
          detalle: "El inicio es anterior al fin.",
        }),
  );

  return salida;
}

function revisarConsignas(foto: FotoDeEdicion): Hallazgo[] {
  const salida: Hallazgo[] = [];
  const vigentes = consignasQueCuentan(foto.consignas);
  const enBorrador = foto.consignas.filter((c) => c.estado === "DRAFT");

  salida.push(
    vigentes.length > 0
      ? hallazgo({
          id: "sin-consignas",
          rubro: "CONSIGNAS",
          severidad: "BIEN",
          titulo: `${vigentes.length} ${vigentes.length === 1 ? "consigna lista" : "consignas listas"}`,
          detalle: "Hay consignas que el cronograma puede liberar.",
        })
      : hallazgo({
          id: "sin-consignas",
          rubro: "CONSIGNAS",
          severidad: "BLOQUEANTE",
          titulo: "No hay ninguna consigna que se pueda liberar",
          detalle:
            "Cuando llegue la hora, los participantes van a ver la cuenta regresiva en cero y ninguna consigna.",
          comoArreglar: "Cargá las consignas y dejalas fuera de borrador.",
          enlace: "consignas",
        }),
  );

  salida.push(
    enBorrador.length > 0
      ? hallazgo({
          id: "consignas-en-borrador",
          rubro: "CONSIGNAS",
          severidad: "BLOQUEANTE",
          titulo: `${enBorrador.length} ${enBorrador.length === 1 ? "consigna quedó en borrador" : "consignas quedaron en borrador"}`,
          detalle:
            "El cronograma no las libera: una consigna en borrador no se publica nunca, por más que la hora llegue. Los participantes verían la cuenta regresiva terminar y no aparecería nada.",
          comoArreglar: "Sacá las consignas de borrador y dejalas listas.",
          enlace: "consignas",
        })
      : hallazgo({
          id: "consignas-en-borrador",
          rubro: "CONSIGNAS",
          severidad: "BIEN",
          titulo: "Ninguna consigna quedó en borrador",
          detalle: "Todas las consignas cargadas se van a poder liberar.",
        }),
  );

  const capturaTardia = vigentes.filter(
    (c) =>
      c.capturaCierraEl !== null &&
      c.subidaCierraEl !== null &&
      c.capturaCierraEl.getTime() > c.subidaCierraEl.getTime(),
  );
  salida.push(
    capturaTardia.length > 0
      ? hallazgo({
          id: "captura-cierra-despues-que-la-subida",
          rubro: "CONSIGNAS",
          severidad: "BLOQUEANTE",
          titulo: "La captura cierra después que la subida",
          detalle:
            "Hay consignas que permiten sacar fotos después de que se cerró la carga: esas fotos no se pueden subir y el participante se queda afuera sin entender por qué.",
          comoArreglar:
            "Dejá el cierre de captura antes o igual que el cierre de subida en cada consigna.",
          enlace: "consignas",
        })
      : hallazgo({
          id: "captura-cierra-despues-que-la-subida",
          rubro: "CONSIGNAS",
          severidad: "BIEN",
          titulo: "Las ventanas de captura y subida son coherentes",
          detalle: "Siempre se puede subir lo que se capturó.",
        }),
  );

  const sinVentana = vigentes.filter((c) => c.capturaAbreEl === null);
  salida.push(
    sinVentana.length > 0
      ? hallazgo({
          id: "sin-ventanas-de-captura",
          rubro: "CONSIGNAS",
          severidad: "ATENCION",
          titulo: `${sinVentana.length} ${sinVentana.length === 1 ? "consigna sin horario de captura" : "consignas sin horario de captura"}`,
          detalle:
            "Sin horario propio, la consigna toma el del cronograma. Funciona, pero conviene dejarlo explícito para que la admisión técnica pueda revisar la hora de las fotos.",
          comoArreglar: "Cargá el horario de captura de cada consigna.",
          enlace: "consignas",
        })
      : hallazgo({
          id: "sin-ventanas-de-captura",
          rubro: "CONSIGNAS",
          severidad: "BIEN",
          titulo: "Todas las consignas tienen horario de captura",
          detalle: "La admisión técnica va a poder revisar la hora de cada foto.",
        }),
  );

  return salida;
}

function revisarAcreditacion(foto: FotoDeEdicion): Hallazgo[] {
  return [
    foto.acreditacionHabilitada
      ? hallazgo({
          id: "acreditacion-apagada",
          rubro: "ACREDITACION",
          severidad: "BIEN",
          titulo: "La acreditación está habilitada",
          detalle: "El escáner de credenciales va a poder registrar entradas.",
        })
      : hallazgo({
          id: "acreditacion-apagada",
          rubro: "ACREDITACION",
          severidad: "ATENCION",
          titulo: "La acreditación está apagada",
          detalle:
            "El día del evento el escáner va a rechazar todas las credenciales con un cartel de módulo deshabilitado.",
          comoArreglar: "Encendé la acreditación antes del evento.",
          enlace: "acreditacion",
        }),
  ];
}

function revisarSubida(foto: FotoDeEdicion): Hallazgo[] {
  return [
    foto.hayConfiguracionDeSubida
      ? hallazgo({
          id: "sin-configuracion-de-subida",
          rubro: "SUBIDA",
          severidad: "BIEN",
          titulo: "La subida de fotos está configurada",
          detalle: "Hay límites y destino de archivos definidos.",
        })
      : hallazgo({
          id: "sin-configuracion-de-subida",
          rubro: "SUBIDA",
          severidad: "BLOQUEANTE",
          titulo: "Falta la configuración de subida",
          detalle:
            "Sin ella los participantes no pueden cargar ninguna foto: el botón de subir devuelve error.",
          comoArreglar: "Configurá la subida de fotos de la edición.",
          enlace: "consignas",
        }),
  ];
}

function revisarAdmision(foto: FotoDeEdicion): Hallazgo[] {
  return [
    foto.hayConfiguracionDeAdmision
      ? hallazgo({
          id: "sin-configuracion-de-admision",
          rubro: "ADMISION",
          severidad: "BIEN",
          titulo: "La admisión técnica está configurada",
          detalle: "Las fotos se van a poder revisar automáticamente.",
        })
      : hallazgo({
          id: "sin-configuracion-de-admision",
          rubro: "ADMISION",
          severidad: "ATENCION",
          titulo: "Falta la configuración de admisión técnica",
          detalle:
            "Las fotos se van a poder subir, pero nadie las va a revisar automáticamente y todo queda para revisión manual.",
          comoArreglar: "Configurá la admisión técnica de la edición.",
          enlace: "admision",
        }),
  ];
}

/** Revisa una edición entera y devuelve un hallazgo por control. */
export function revisarEdicion(
  foto: FotoDeEdicion,
  clock: EditionClock = systemClock(),
): Hallazgo[] {
  const ahora = clock.now();
  return [
    ...revisarPublicacion(foto),
    ...revisarVenta(foto, ahora),
    ...revisarCronograma(foto),
    ...revisarConsignas(foto),
    ...revisarAcreditacion(foto),
    ...revisarSubida(foto),
    ...revisarAdmision(foto),
  ];
}
