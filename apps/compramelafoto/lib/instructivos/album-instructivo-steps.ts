/**
 * Perfil → pasos. Acá vive la decisión de forma del instructivo: la preventa invierte la
 * secuencia (se paga antes de que las fotos existan), así que no alcanza con un guion
 * único parametrizado.
 *
 * En preventa hay DOS momentos de elección y por eso dos pasos con títulos distintos: se
 * elige el producto antes de pagar ("Elegí qué querés") y las fotos concretas después de
 * que se publican ("Elegí tus fotos"). En postventa hay uno solo.
 */

import type { AlbumInstructivoProfile } from "./album-instructivo-profile";

export type InstructivoStep = {
  titulo: string;
  detalle: string[];
  /** Advertencia o aclaración destacada (plazos, límites, requisitos). */
  nota?: string;
};

const FORMATO_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

function fecha(d: Date): string {
  return FORMATO_FECHA.format(d);
}

function pasoEntrar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle = [`Abrí ${p.album.url} desde el celular o la computadora.`];
  if (p.entrada === "selfie_obligatoria") {
    detalle.push(
      "En esta galería nadie ve todas las fotos: vas a ver sólo las tuyas, después de verificar tu identidad."
    );
  }
  if (p.entrada === "no_listada") {
    detalle.push("La galería no aparece en buscadores: se entra solamente con este enlace.");
  }
  return { titulo: "Entrá a la galería", detalle };
}

function pasoEncontrar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.busqueda.includes("cara")) {
    detalle.push(
      "Sacate una selfie desde el celular: el reconocimiento facial compara tu cara con las fotos y te muestra las que coinciden."
    );
  }
  if (p.busqueda.includes("dorsal")) {
    detalle.push("Escribí tu número de dorsal o pechera en el buscador.");
  }
  if (p.busqueda.includes("palabra")) {
    detalle.push(
      "También podés buscar por una palabra que aparezca en la foto (un cartel, un nombre)."
    );
  }
  if (p.busqueda.includes("navegar")) {
    // "O mirá..." sólo tiene sentido si antes hubo otra opción.
    detalle.push(
      detalle.length > 0
        ? "O mirá la galería completa y elegí a mano."
        : "Mirá la galería completa y elegí las tuyas."
    );
  }

  const paso: InstructivoStep = { titulo: "Encontrá tus fotos", detalle };
  if (p.entrada === "selfie_obligatoria") {
    paso.nota =
      "La selfie se usa sólo para encontrarte y no se publica. Hace falta un celular: desde la computadora no se puede subir.";
  }
  return paso;
}

/** Qué se vende. En preventa es lo que se elige ANTES de pagar. */
function pasoElegirProducto(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.venta.digital) detalle.push("Fotos digitales: las descargás vos.");
  if (p.venta.impreso) detalle.push("Fotos impresas: las imprime el laboratorio.");
  if (p.venta.digitalIncluidoConImpreso) {
    detalle.push("Cada foto impresa incluye también su versión digital.");
  }
  if (p.venta.packs) detalle.push("Hay packs: varias fotos a mejor precio que sueltas.");
  if (p.venta.video) detalle.push("También hay videos del evento.");
  if (detalle.length === 0) detalle.push("Mirá las opciones disponibles y elegí la tuya.");
  return { titulo: "Elegí qué querés", detalle };
}

/** Marcar las fotos concretas. En preventa pasa DESPUÉS de pagar y de la espera. */
function pasoElegirFotos(p: AlbumInstructivoProfile): InstructivoStep {
  if (p.momento === "preventa") {
    return {
      titulo: "Elegí tus fotos",
      detalle: [
        "Entrá de nuevo a la galería con el mismo enlace.",
        "Marcá las fotos que entran en lo que ya compraste.",
      ],
    };
  }

  const detalle: string[] = [];
  if (p.venta.digital) detalle.push("Fotos digitales: las descargás vos.");
  if (p.venta.impreso) detalle.push("Fotos impresas: las imprime el laboratorio.");
  if (p.venta.digitalIncluidoConImpreso) {
    detalle.push("Cada foto impresa incluye también su versión digital.");
  }
  if (p.venta.packs) detalle.push("Hay packs: varias fotos a mejor precio que sueltas.");
  if (p.venta.video) detalle.push("También hay videos del evento.");
  if (detalle.length === 0) detalle.push("Marcá las fotos que te quieras llevar.");
  return { titulo: "Elegí tus fotos", detalle };
}

function pasoPagar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle = [
    "El pago es con Mercado Pago: tarjeta, dinero en cuenta o efectivo.",
    "Vas a recibir el comprobante por correo.",
  ];
  if (p.momento === "preventa") {
    detalle.unshift("En la preventa pagás primero y elegís tus fotos después.");
  }
  return { titulo: "Pagá", detalle };
}

function pasoEsperar(): InstructivoStep {
  return {
    titulo: "Esperá a que se publiquen las fotos",
    detalle: [
      "Las fotos todavía no están: se sacan el día del evento y se suben después.",
      "Cuando estén disponibles te avisamos por correo y entrás con el mismo enlace.",
    ],
  };
}

function pasoRecibir(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.entrega.descarga) {
    detalle.push("Las fotos digitales se descargan desde el enlace que te llega por correo.");
  }
  if (p.entrega.retiro) {
    detalle.push("Las fotos impresas se retiran en persona; te avisamos cuándo están listas.");
  }
  if (p.entrega.envio) {
    detalle.push("Las fotos impresas se envían a la dirección que cargues al comprar.");
  }
  if (p.entrega.laboratorio) {
    detalle.push(`Las imprime ${p.entrega.laboratorio}.`);
  }
  if (detalle.length === 0) {
    detalle.push("Te avisamos por correo cuando tus fotos estén listas.");
  }

  const paso: InstructivoStep = { titulo: "Recibí tus fotos", detalle };
  if (p.vencimiento) {
    paso.nota = `La galería está disponible hasta el ${fecha(p.vencimiento)}. Después de esa fecha las fotos se borran.`;
  }
  return paso;
}

function pasoAvisoProcesando(): InstructivoStep {
  return {
    titulo: "Las fotos se están procesando",
    detalle: [
      "Todavía se están subiendo y analizando.",
      "Si entrás ahora puede que no aparezcan todas: volvé a probar en un rato.",
    ],
  };
}

/**
 * Un álbum todavía sin ninguna foto no está "procesando": está vacío. Decirle al cliente
 * que espere el análisis sería describirle algo que no está pasando.
 */
function pasoAvisoSinFotos(): InstructivoStep {
  return {
    titulo: "Todavía no hay fotos publicadas",
    detalle: [
      "Las fotos se suben después del evento.",
      "Guardá este enlace: cuando estén disponibles vas a poder verlas acá mismo.",
    ],
  };
}

export function buildInstructivoSteps(p: AlbumInstructivoProfile): InstructivoStep[] {
  const pasos: InstructivoStep[] = [];
  const sinFotos = p.momento === "simple";

  if (sinFotos) {
    pasos.push(pasoAvisoSinFotos());
  } else if (!p.listo) {
    pasos.push(pasoAvisoProcesando());
  }

  pasos.push(pasoEntrar(p));

  // Sin fotos no hay nada que buscar: explicar el reconocimiento facial acá sería
  // describir una pantalla que el cliente no va a encontrar.
  if (sinFotos) {
    pasos.push(pasoElegirProducto(p), pasoPagar(p), pasoRecibir(p));
    return pasos;
  }

  if (p.momento === "preventa") {
    pasos.push(
      pasoElegirProducto(p),
      pasoPagar(p),
      pasoEsperar(),
      pasoEncontrar(p),
      pasoElegirFotos(p),
      pasoRecibir(p)
    );
    return pasos;
  }

  pasos.push(pasoEncontrar(p), pasoElegirFotos(p), pasoPagar(p), pasoRecibir(p));
  return pasos;
}
