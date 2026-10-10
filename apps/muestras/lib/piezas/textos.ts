import { NO_AUTHOR, dateRangeText, fichaDetail, formatCm, hangingLayout, scanUrl, unassignedWorks, type HangingPlan, type WallLayout } from "@repo/muestras";

/** Lo que las piezas leen de una muestra (lo arma `cargarMuestraParaPiezas`, Task 11). */
export type MuestraParaPiezas = {
  id: string; slug: string; title: string; organizersText: string;
  curatorialText: string | null; curatorCredits: string | null;
  startsAt: Date; endsAt: Date; scheduleText: string | null;
  venueName: string | null; address: string | null; city: string | null; province: string | null;
  coverImageUrl: string | null; hangingPlan: unknown; updatedAt: Date;
  works: { id: string; title: string; authorName: string; year: number | null; technique: string | null; imageUrl: string; sortOrder: number }[];
  /** Lo que cargó quien expone, por id de la obra de la muestra (etapa 6). Nunca el precio. */
  expositores?: ReadonlyMap<string, DatosDeExpositor>;
};

export type DatosDeExpositor = {
  imageWidthCm: number | null; imageHeightCm: number | null;
  edition: string | null; editionNumber: number | null; editionSize: number | null;
  statement: string | null;
};

const lleno = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export function detalleDeObra(o: { year: number | null; technique: string | null }): string | null {
  return [o.year ? String(o.year) : null, lleno(o.technique)].filter(Boolean).join(". ") || null;
}

/**
 * La línea de datos de una obra en las piezas: con los datos del expositor suma medidas y edición
 * ("2024. Giclée. 40 × 60 cm. Edición 2/10"); si no, año y técnica. Nunca el precio (D38).
 */
export function detalleConExpositor(o: { year: number | null; technique: string | null }, ex?: DatosDeExpositor | null): string | null {
  if (!ex) return detalleDeObra(o);
  return fichaDetail({ ...ex, year: o.year, technique: o.technique }) || null;
}

/** Una página del catálogo: título, autor, la línea de datos y el texto de la obra. */
export function obraDeCatalogo(
  o: { title: string; authorName: string; year: number | null; technique: string | null },
  ex?: DatosDeExpositor | null,
): { titulo: string; autor: string; detalle: string | null; texto: string | null } {
  return { titulo: o.title, autor: o.authorName, detalle: detalleConExpositor(o, ex), texto: lleno(ex?.statement) };
}

export function autorDeObra(nombre: string): string {
  return lleno(nombre) ?? NO_AUTHOR;
}

export function lugarDeMuestra(a: { venueName: string | null; address: string | null; city: string | null; province: string | null }): string | null {
  return [a.venueName, a.address, a.city, a.province].map(lleno).filter(Boolean).join(", ") || null;
}

/** "muestrasfotograficas.com/m/x/libro": para escribir a mano si el QR no anda. */
export function urlVisible(base: string, path: string): string {
  return `${base.replace(/\/+$/, "").replace(/^https?:\/\//, "")}${path}`;
}

export type DatosCartel = {
  titulo: string; organizan: string | null; curaduria: string | null; texto: string | null;
  fechas: string; horarios: string | null; lugar: string | null; url: string;
};

type ParaCartel = Pick<MuestraParaPiezas, "id" | "title" | "organizersText" | "curatorialText" | "curatorCredits" | "startsAt" | "endsAt" | "scheduleText" | "venueName" | "address" | "city" | "province">;

export function datosDeCartel(a: ParaCartel, base: string): DatosCartel {
  const organizan = lleno(a.organizersText);
  return {
    titulo: a.title,
    organizan: organizan ? `Organiza: ${organizan}` : null,
    curaduria: lleno(a.curatorCredits),
    texto: lleno(a.curatorialText),
    fechas: dateRangeText(a.startsAt, a.endsAt),
    horarios: lleno(a.scheduleText),
    lugar: lugarDeMuestra(a),
    // El QR del cartel y del catálogo pasa por /q/m: cuenta el escaneo (D12).
    url: scanUrl(base, "m", a.id),
  };
}

/**
 * Nombre del archivo, sin la extensión: sólo letras, números y guiones (va en una cabecera; la
 * ruta le suma ".pdf"). Los puntos también se cambian, para que nunca quede un "..".
 */
export function nombreDePieza(pieza: string, slug: string, extra: string[]): string {
  return [pieza, slug, ...extra].join("-").replace(/[^A-Za-z0-9-]/g, "-");
}

export type ObraEnPared = { numero: number; titulo: string; autor: string; marco: string; centroDesdeIzquierda: string; bordeSuperior: string };
export type ParedParaPdf = { nombre: string; anchoCm: number; altoCm: number | null; layout: WallLayout; obras: ObraEnPared[] };
export type DatosMontaje = { muestra: string; centroCm: number; paredes: ParedParaPdf[]; sinPared: { titulo: string; autor: string }[] };

/** El plano listo para dibujar. `plan` viene de `parseHangingPlan`: sus obras existen. */
export function datosDeMontaje(muestra: string, plan: HangingPlan, works: { id: string; title: string; authorName: string }[]): DatosMontaje {
  const porId = new Map(works.map((w) => [w.id, w]));
  return {
    muestra,
    centroCm: plan.centerHeightCm,
    paredes: plan.walls.map((w) => {
      const layout = hangingLayout(w, plan.centerHeightCm);
      return {
        nombre: w.name, anchoCm: w.widthCm, altoCm: w.heightCm, layout,
        obras: layout.positions.map((p) => {
          const o = porId.get(p.workId);
          return {
            numero: p.number,
            titulo: o?.title ?? "Obra quitada",
            autor: autorDeObra(o?.authorName ?? ""),
            marco: `${formatCm(p.widthCm)} × ${formatCm(p.heightCm)} cm`,
            centroDesdeIzquierda: `${formatCm(p.centerFromLeftCm)} cm`,
            bordeSuperior: `${formatCm(p.topCm)} cm`,
          };
        }),
      };
    }),
    sinPared: unassignedWorks(plan, works).map((o) => ({ titulo: o.title, autor: autorDeObra(o.authorName) })),
  };
}
