/**
 * Perfil del álbum para el instructivo: seis ejes que deciden QUÉ pasos existen
 * y en qué orden, no sólo qué palabras se rellenan.
 *
 * Función pura a propósito: las combinaciones reales (entrada × búsqueda × momento ×
 * venta × entrega) son demasiadas para probarlas contra la base. `ahora` se inyecta
 * porque la preventa depende del reloj y un test que dependa del reloj real no es
 * reproducible.
 */

export type InstructivoEntrada = "abierta" | "selfie_obligatoria" | "no_listada";
export type InstructivoBusqueda = "cara" | "dorsal" | "palabra" | "navegar";
export type InstructivoMomento = "preventa" | "postventa" | "simple";
/** A quién le habla el instructivo: en un colegio la cara que se busca es la del alumno. */
export type InstructivoPublico = "escolar" | "general";

export type AlbumInstructivoProfileInput = {
  album: {
    id: number;
    title: string;
    publicSlug: string;
    isPublic: boolean;
    isHidden: boolean;
    hiddenPhotosEnabled: boolean;
    preCompraCloseAt: Date | null;
    enableDigitalPhotos: boolean;
    enablePrintedPhotos: boolean;
    includeDigitalWithPrint: boolean;
    deliveryType: string | null;
    pickupBy: string | null;
    /** Álbum escolar: modo SCHOOL, atado a una escuela o con tipo de evento SCHOOL. */
    escolar: boolean;
    /** `Album.type`. Decide si tiene sentido hablar de dorsales. */
    tipoEvento: string | null;
    /**
     * Hasta cuándo se ve la galería, calculado como lo calcula la limpieza
     * (`computeAlbumHideAt`). No es `Album.expiresAt`: ese campo quedó en el pasado en la
     * mayoría de los álbumes visibles y anunciaba como borradas galerías vivas.
     */
    disponibleHasta: Date | null;
  };
  fotografo: {
    nombre: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    handler: string | null;
  };
  senales: {
    fotosCargadas: number;
    tokensNumericos: number;
    tokensDeTexto: number;
    packsPreventaActivos: number;
    packsGaleriaActivos: number;
    videosPublicados: number;
    laboratorio: string | null;
    listo: boolean;
  };
  baseUrl: string;
  ahora: Date;
};

export type AlbumInstructivoProfile = {
  publico: InstructivoPublico;
  entrada: InstructivoEntrada;
  busqueda: InstructivoBusqueda[];
  momento: InstructivoMomento;
  venta: {
    digital: boolean;
    impreso: boolean;
    packs: boolean;
    video: boolean;
    digitalIncluidoConImpreso: boolean;
  };
  entrega: {
    descarga: boolean;
    retiro: boolean;
    envio: boolean;
    laboratorio: string | null;
  };
  vencimiento: Date | null;
  listo: boolean;
  fotografo: {
    nombre: string;
    logoUrl: string | null;
    color: string | null;
    handler: string | null;
  };
  album: { id: number; titulo: string; slug: string; url: string };
};

function resolveEntrada(album: AlbumInstructivoProfileInput["album"]): InstructivoEntrada {
  if (album.hiddenPhotosEnabled) return "selfie_obligatoria";
  if (!album.isPublic || album.isHidden) return "no_listada";
  return "abierta";
}

/**
 * Tipos de evento donde nadie lleva dorsal. El OCR encuentra números en cualquier foto
 * (carteles, guardapolvos, fechas), así que contar tokens numéricos no alcanza: en un acto
 * escolar el instructivo le pedía a los padres "tu número de dorsal o pechera".
 */
const EVENTOS_SIN_DORSAL = new Set([
  "WEDDING",
  "BIRTHDAY",
  "GRADUATION",
  "SCHOOL",
  "RELIGIOUS",
  "CORPORATE",
  "CONFERENCE",
  "PRIVATE_SESSION",
  "PUBLIC_SESSION",
  "THEMATIC_SESSIONS",
  "COMMERCIAL_SESSIONS",
]);

function admiteDorsal(album: AlbumInstructivoProfileInput["album"]): boolean {
  if (album.escolar) return false;
  return album.tipoEvento == null || !EVENTOS_SIN_DORSAL.has(album.tipoEvento);
}

function resolveBusqueda(
  album: AlbumInstructivoProfileInput["album"],
  entrada: InstructivoEntrada,
  senales: AlbumInstructivoProfileInput["senales"]
): InstructivoBusqueda[] {
  // Con selfie obligatoria el cliente nunca ve fotos ajenas: ofrecer cualquier otro
  // método sería describirle una puerta que no existe.
  if (entrada === "selfie_obligatoria") return ["cara"];

  // La búsqueda por selfie la ofrece toda galería, sin interruptor por álbum. No se espera
  // a tener caras detectadas: el análisis facial corre atrasado respecto de la subida, y
  // el cartel y el instructivo se imprimen justo después de subir, así que esperarlo los
  // hacía callar la selfie en los álbumes recién cargados.
  const metodos: InstructivoBusqueda[] = ["cara"];
  if (senales.tokensNumericos > 0 && admiteDorsal(album)) metodos.push("dorsal");
  if (senales.tokensDeTexto > 0) metodos.push("palabra");
  if (senales.fotosCargadas > 0) metodos.push("navegar");
  return metodos;
}

function resolveMomento(
  album: AlbumInstructivoProfileInput["album"],
  senales: AlbumInstructivoProfileInput["senales"],
  ahora: Date
): InstructivoMomento {
  const cierreVigente =
    album.preCompraCloseAt != null && album.preCompraCloseAt.getTime() > ahora.getTime();
  if (cierreVigente || senales.packsPreventaActivos > 0) return "preventa";
  if (senales.fotosCargadas > 0) return "postventa";
  return "simple";
}

export function resolveAlbumInstructivoProfile(
  input: AlbumInstructivoProfileInput
): AlbumInstructivoProfile {
  const { album, fotografo, senales, baseUrl, ahora } = input;
  const entrada = resolveEntrada(album);

  // Una fecha ya pasada no se anuncia: si la galería se sigue viendo, decirle al cliente
  // que "las fotos se borraron" lo espanta de una compra que todavía puede hacer.
  const vencimiento =
    album.disponibleHasta && album.disponibleHasta.getTime() > ahora.getTime()
      ? album.disponibleHasta
      : null;

  return {
    publico: album.escolar ? "escolar" : "general",
    entrada,
    busqueda: resolveBusqueda(album, entrada, senales),
    momento: resolveMomento(album, senales, ahora),
    venta: {
      digital: album.enableDigitalPhotos,
      impreso: album.enablePrintedPhotos,
      packs: senales.packsGaleriaActivos > 0 || senales.packsPreventaActivos > 0,
      video: senales.videosPublicados > 0,
      digitalIncluidoConImpreso: album.includeDigitalWithPrint,
    },
    // Retiro, envío y laboratorio son formas de entregar papel. Si el álbum no vende
    // impresas, hablar de "retirar tus fotos" describe algo que no va a pasar.
    entrega: {
      descarga: album.enableDigitalPhotos,
      retiro: album.enablePrintedPhotos && album.pickupBy != null,
      envio: album.enablePrintedPhotos && album.deliveryType != null && album.pickupBy == null,
      laboratorio: album.enablePrintedPhotos ? senales.laboratorio : null,
    },
    vencimiento,
    listo: senales.listo,
    fotografo: {
      nombre: fotografo.nombre?.trim() || "Tu fotógrafo",
      logoUrl: fotografo.logoUrl,
      color: fotografo.primaryColor,
      handler: fotografo.handler,
    },
    album: {
      id: album.id,
      titulo: album.title,
      slug: album.publicSlug,
      url: `${baseUrl.replace(/\/+$/, "")}/a/${album.publicSlug}`,
    },
  };
}
