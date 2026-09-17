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
    expiresAt: Date | null;
  };
  fotografo: {
    nombre: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    handler: string | null;
  };
  senales: {
    fotosCargadas: number;
    rostrosDetectados: number;
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

function resolveBusqueda(
  entrada: InstructivoEntrada,
  senales: AlbumInstructivoProfileInput["senales"]
): InstructivoBusqueda[] {
  // Con selfie obligatoria el cliente nunca ve fotos ajenas: ofrecer cualquier otro
  // método sería describirle una puerta que no existe.
  if (entrada === "selfie_obligatoria") return ["cara"];

  const metodos: InstructivoBusqueda[] = [];
  if (senales.rostrosDetectados > 0) metodos.push("cara");
  if (senales.tokensNumericos > 0) metodos.push("dorsal");
  if (senales.tokensDeTexto > 0) metodos.push("palabra");
  if (senales.fotosCargadas > 0) metodos.push("navegar");
  return metodos.length > 0 ? metodos : ["navegar"];
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

  return {
    entrada,
    busqueda: resolveBusqueda(entrada, senales),
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
    vencimiento: album.expiresAt,
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
