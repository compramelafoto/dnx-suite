/**
 * Perfil → pasos. Acá vive la decisión de forma del instructivo: la preventa invierte la
 * secuencia (se paga antes de que las fotos existan), así que no alcanza con un guion
 * único parametrizado.
 *
 * En preventa hay DOS momentos de elección y por eso dos pasos con títulos distintos: se
 * elige el producto antes de pagar ("Elegí qué querés") y las fotos concretas después de
 * que se publican ("Elegí tus fotos"). En postventa hay uno solo.
 *
 * Los botones se nombran como los ve el cliente en la galería (`ClientAlbumView`): el
 * instructivo sirve si se puede seguir con el celular en la mano, no si describe la idea.
 * Todo el recorrido pasa por la página; nunca se manda al cliente a resolver algo por
 * fuera (capturas, mensajes), porque eso es justo lo que el sistema automatiza.
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

const escolar = (p: AlbumInstructivoProfile) => p.publico === "escolar";

function pasoEntrar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle = [`Abrí ${p.album.url} desde el celular o la computadora.`];
  if (p.entrada === "selfie_obligatoria") {
    detalle.push(
      escolar(p)
        ? "En esta galería nadie ve todas las fotos: cada familia ve sólo las de su hija o hijo."
        : "En esta galería nadie ve todas las fotos: vas a ver sólo las tuyas."
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
      escolar(p)
        ? "Tocá \"Buscar por selfie\" y cargá una foto de la cara de tu hija o hijo: te aparecen las fotos donde está."
        : "Tocá \"Buscar por selfie\" y sacate una foto de la cara: te aparecen las fotos donde estás."
    );
  }
  if (p.busqueda.includes("dorsal")) {
    detalle.push("Tocá \"Buscar por número o palabra clave\" y escribí tu número de dorsal.");
  }
  if (p.busqueda.includes("palabra")) {
    detalle.push(
      p.busqueda.includes("dorsal")
        ? "En ese mismo buscador también podés escribir una palabra que se lea en la foto (un cartel, un nombre)."
        : "Tocá \"Buscar por número o palabra clave\" y escribí una palabra que se lea en la foto (un cartel, un nombre)."
    );
  }
  if (p.busqueda.includes("navegar")) {
    // "O mirá..." sólo tiene sentido si antes hubo otra opción.
    detalle.push(
      detalle.length > 0
        ? "O recorré la galería completa."
        : "Recorré la galería completa y buscá tus fotos."
    );
  }

  const paso: InstructivoStep = { titulo: "Encontrá tus fotos", detalle };
  if (p.entrada === "selfie_obligatoria") {
    paso.nota =
      "La foto de la cara se usa sólo para buscar y no se publica. Hace falta un celular: desde la computadora no se puede cargar.";
  }
  return paso;
}

/** Qué recibe el cliente con cada opción. Se dice una sola vez y en el paso de elegir. */
function lineasQueIncluye(p: AlbumInstructivoProfile): string[] {
  const lineas: string[] = [];
  if (p.venta.digital) lineas.push("Digital: recibís el archivo para descargar.");
  if (p.venta.impreso) {
    lineas.push(
      p.venta.digitalIncluidoConImpreso
        ? "Impresa: recibís la foto en papel y, además, el archivo digital."
        : "Impresa: recibís la foto en papel."
    );
  }
  if (p.venta.video) lineas.push("También hay videos del evento.");
  return lineas;
}

const NOTA_MARCA_DE_AGUA =
  "En la galería las fotos se ven en baja calidad y con marca de agua, sólo para elegir. Lo que comprás se entrega en alta calidad y sin marca de agua.";

/** Qué se vende. En preventa es lo que se elige ANTES de pagar. */
function pasoElegirProducto(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.venta.packs) detalle.push("Elegí el pack o la opción que quieras.");
  detalle.push(...lineasQueIncluye(p));
  if (detalle.length === 0) detalle.push("Mirá las opciones disponibles y elegí la tuya.");
  return { titulo: "Elegí qué querés", detalle };
}

/** Cómo se marca cada foto según lo que vende el álbum. */
function lineaComoSeleccionar(p: AlbumInstructivoProfile): string {
  if (p.venta.digital && p.venta.impreso) {
    return "Tocá \"Seleccionar\" en cada foto que quieras. En el paso siguiente elegís si cada una va digital o impresa.";
  }
  if (p.venta.impreso) {
    return "Tocá \"Seleccionar\" en cada foto que quieras. En el paso siguiente elegís el tamaño de la impresión.";
  }
  return "Tocá \"Seleccionar\" en cada foto que quieras y después el botón de abajo para seguir.";
}

/** Marcar las fotos concretas. En preventa pasa DESPUÉS de pagar y de la espera. */
function pasoElegirFotos(p: AlbumInstructivoProfile): InstructivoStep {
  if (p.momento === "preventa") {
    return {
      titulo: "Elegí tus fotos",
      detalle: [
        "Marcá las fotos que incluye lo que compraste y confirmá la selección. Ya están pagadas: no se vuelven a cobrar.",
        "Si querés más fotos de las que incluye tu compra, las comprás aparte en la galería.",
      ],
      nota: NOTA_MARCA_DE_AGUA,
    };
  }

  const detalle = [lineaComoSeleccionar(p)];
  if (p.venta.packs) {
    detalle.push(
      "Para un pack: en \"Packs disponibles\" tocá \"Elegir fotos para este pack\", marcá las fotos que pide y guardá la selección."
    );
  }
  detalle.push(...lineasQueIncluye(p));
  return { titulo: "Elegí tus fotos", detalle, nota: NOTA_MARCA_DE_AGUA };
}

function pasoPagar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle = [
    "El pago es con Mercado Pago: tarjeta, dinero en cuenta o efectivo.",
    "Vas a recibir el comprobante por correo.",
  ];
  if (p.momento === "preventa") {
    detalle.unshift("En la preventa pagás ahora y elegís tus fotos cuando se publiquen.");
  }
  return { titulo: "Pagá", detalle };
}

function pasoEsperar(p: AlbumInstructivoProfile): InstructivoStep {
  const recuperar = `${new URL(p.album.url).origin}/cliente/recuperar-pack`;
  return {
    titulo: "Esperá a que se publiquen las fotos",
    detalle: [
      "Las fotos todavía no están: se sacan el día del evento y se suben después.",
      "Guardá el correo de confirmación: trae el enlace para elegir tus fotos. No hace falta crear una cuenta.",
    ],
    nota: `Si perdiste el correo, entrá en ${recuperar} con el mismo email de la compra y te lo mandamos de nuevo.`,
  };
}

/** En preventa la elección arranca desde el enlace del correo, no desde la galería. */
function pasoAbrirCompra(): InstructivoStep {
  return {
    titulo: "Abrí tu compra",
    detalle: [
      "Cuando las fotos estén publicadas, abrí el enlace del correo de confirmación.",
      "Tocá \"Elegir fotos en el álbum\".",
    ],
  };
}

function pasoRecibir(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.entrega.descarga) {
    detalle.push("Las fotos digitales te llegan por correo, con un enlace para descargarlas.");
  }
  if (p.entrega.retiro) {
    detalle.push("Las fotos impresas se retiran en persona: te avisamos cuándo y dónde están listas.");
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
    paso.nota = `Podés comprar hasta el ${fecha(p.vencimiento)}. Después la galería deja de estar disponible.`;
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
      pasoEsperar(p),
      pasoAbrirCompra(),
      pasoEncontrar(p),
      pasoElegirFotos(p),
      pasoRecibir(p)
    );
    return pasos;
  }

  pasos.push(pasoEncontrar(p), pasoElegirFotos(p), pasoPagar(p), pasoRecibir(p));
  return pasos;
}
