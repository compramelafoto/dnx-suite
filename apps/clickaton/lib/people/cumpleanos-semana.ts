/**
 * Cumpleaños de la semana, para el inicio del panel.
 *
 * Módulo puro. La semana va de lunes a domingo y se cuenta desde `hoy` (YYYY-MM-DD en hora
 * argentina, ver `hoyEnArgentina`). No muestra el año ni la edad: alcanza con saber a quién
 * saludar y cuándo.
 */

export type PersonaConFecha = {
  clave: string;
  nombre: string;
  /** "YYYY-MM-DD" o null si nunca la cargó. */
  fechaNacimiento: string | null;
  instagram: string | null;
};

export type CumpleDeLaSemana = {
  clave: string;
  nombre: string;
  iniciales: string;
  /** "Lunes 5". */
  dia: string;
  esHoy: boolean;
  yaPaso: boolean;
  instagram: string | null;
  instagramUrl: string | null;
};

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const USUARIO_IG = /^[a-z0-9._]{1,30}$/;

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** Los siete días (lunes a domingo) de la semana de `hoy`, como fechas UTC sin hora. */
export function diasDeLaSemana(hoy: string): Date[] {
  const [a, m, d] = hoy.split("-").map(Number) as [number, number, number];
  const base = new Date(Date.UTC(a, m - 1, d));
  const desdeElLunes = (base.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(a, m - 1, d - desdeElLunes + i)));
}

function indiceEnLaSemana(fecha: string, dias: Date[]): number {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return -1;
  const mes = Number(m[2]) - 1;
  const dia = Number(m[3]);
  return dias.findIndex((d) => {
    if (d.getUTCMonth() === mes && d.getUTCDate() === dia) return true;
    // El 29 de febrero se festeja el 28 los años no bisiestos.
    return mes === 1 && dia === 29 && !esBisiesto(d.getUTCFullYear()) && d.getUTCMonth() === 1 && d.getUTCDate() === 28;
  });
}

function usuarioDeInstagram(raw: string | null): string | null {
  const limpio = (raw ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .replace(/[/?].*$/, "")
    .toLowerCase();
  return USUARIO_IG.test(limpio) ? limpio : null;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toLocaleUpperCase("es-AR");
}

export function cumpleanosDeLaSemana(personas: PersonaConFecha[], hoy: string): CumpleDeLaSemana[] {
  const dias = diasDeLaSemana(hoy);
  const indiceHoy = (new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7;
  return personas
    .flatMap((p) => {
      if (!p.fechaNacimiento) return [];
      const i = indiceEnLaSemana(p.fechaNacimiento, dias);
      if (i < 0) return [];
      const fecha = dias[i]!;
      const ig = usuarioDeInstagram(p.instagram);
      return [
        {
          i,
          cumple: {
            clave: p.clave,
            nombre: p.nombre,
            iniciales: iniciales(p.nombre),
            dia: `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()}`,
            esHoy: i === indiceHoy,
            yaPaso: i < indiceHoy,
            instagram: ig,
            instagramUrl: ig ? `https://instagram.com/${ig}` : null,
          },
        },
      ];
    })
    .sort((a, b) => a.i - b.i || a.cumple.nombre.localeCompare(b.cumple.nombre, "es-AR"))
    .map((x) => x.cumple);
}
