/**
 * Una fila por persona, con todas sus inscripciones adentro.
 *
 * La persona es su email: la cuenta de usuario recién existe cuando paga, y
 * un invitado que se inscribe dos veces sigue siendo la misma persona. Los
 * datos de contacto salen de la inscripción más reciente, que es la que la
 * persona corrigió última.
 *
 * Pura: recibe filas planas y devuelve filas planas, para poder probarla sin
 * base y mandarla entera a la tabla del navegador.
 */
import { claveDeLocalidad } from "@/lib/localities/clave";

/** Una inscripción cuenta como participación si quedó en pie. */
const ESTADOS_QUE_CUENTAN = new Set(["CONFIRMED", "DISQUALIFIED", "REFUND_REQUESTED"]);

/** Las ediciones de prueba no suman ediciones a nadie. */
export function esEdicionDePrueba(nombre: string): boolean {
  return /\b(demo|ensayo|prueba)\b/i.test(nombre);
}

export type InscripcionPlana = {
  id: string;
  editionId: string;
  edicion: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  documentNumber: string | null;
  /** YYYY-MM-DD, como la escribió la persona. */
  birthDate: string | null;
  city: string | null;
  province: string | null;
  country: string;
  instagramHandle: string | null;
  totalAmount: number;
  currency: string;
  promotionCode: string | null;
  isGift: boolean;
  visibleCode: string | null;
  sede: string | null;
  entrada: string | null;
  talle: string | null;
  kitEntregado: boolean;
  acreditado: boolean;
  fotosSubidas: number;
  fotosAdmitidas: number;
  autorizaRedes: boolean;
  userId: number | null;
};

export type NotaDeObra = {
  registrationId: string;
  nota: number | null;
  puesto: number | null;
  premio: string | null;
  final: boolean;
};

export type LocalidadConocida = {
  ciudad: string;
  provincia: string | null;
  lat: number | null;
  lng: number | null;
  estado: string;
};

export type ParticipacionEnHistorial = {
  registrationId: string;
  edicion: string;
  editionId: string;
  estado: string;
  pago: string;
  fecha: string;
  cuenta: boolean;
  numero: string | null;
  sede: string | null;
  entrada: string | null;
  monto: number;
  moneda: string;
  cupon: string | null;
  fotosSubidas: number;
  fotosAdmitidas: number;
  acreditado: boolean;
  mejorPuesto: number | null;
};

export type Persona = {
  clave: string;
  /** Inscripción más reciente: da el link a la ficha y la carpeta de fotos. */
  registrationId: string;
  nombre: string;
  email: string;
  telefono: string | null;
  documento: string | null;
  fechaNacimiento: string | null;
  edad: number | null;
  /** Días hasta el próximo cumpleaños (0 = hoy). */
  diasParaCumple: number | null;
  ciudad: string | null;
  provincia: string | null;
  localidad: (LocalidadConocida & { clave: string }) | null;
  instagram: string | null;
  ediciones: number;
  edicionesNombres: string[];
  primeraInscripcion: string;
  ultimaInscripcion: string;
  totalPagado: number;
  cupones: string[];
  recibioRegalo: boolean;
  fotosSubidas: number;
  fotosAdmitidas: number;
  acreditaciones: number;
  notaMin: number | null;
  notaMax: number | null;
  notaPromedio: number | null;
  mejorPuesto: number | null;
  premios: string[];
  referidos: number;
  nps: number | null;
  autorizaRedes: boolean;
  talle: string | null;
  historial: ParticipacionEnHistorial[];
};

/** Edad y días al próximo cumpleaños, contando desde `hoy` (YYYY-MM-DD). */
export function cumpleanos(
  fechaNacimiento: string | null,
  hoy: string,
): { edad: number | null; dias: number | null } {
  const m = fechaNacimiento?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const h = hoy.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || !h) return { edad: null, dias: null };
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hAnio, hMes, hDia] = [Number(h[1]), Number(h[2]), Number(h[3])];

  let edad = hAnio - anio;
  if (hMes < mes || (hMes === mes && hDia < dia)) edad -= 1;

  const hoyUtc = Date.UTC(hAnio, hMes - 1, hDia);
  // El 29 de febrero se festeja el 28 los años no bisiestos: Date.UTC lo pasaría a marzo.
  const fecha = (a: number) => {
    const bisiesto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
    return Date.UTC(a, mes - 1, mes === 2 && dia === 29 && !bisiesto ? 28 : dia);
  };
  let proximo = fecha(hAnio);
  if (proximo < hoyUtc) proximo = fecha(hAnio + 1);
  const dias = Math.round((proximo - hoyUtc) / 86_400_000);
  return { edad, dias };
}

export function armarPersonas(input: {
  inscripciones: InscripcionPlana[];
  notas: NotaDeObra[];
  referidosPorUsuario: Map<number, number>;
  npsPorUsuario: Map<number, number>;
  localidades: Map<string, LocalidadConocida>;
  hoy: string;
}): Persona[] {
  const porEmail = new Map<string, InscripcionPlana[]>();
  for (const i of input.inscripciones) {
    const clave = i.email.trim().toLowerCase();
    if (!clave) continue;
    const lista = porEmail.get(clave) ?? [];
    lista.push(i);
    porEmail.set(clave, lista);
  }

  const notasPorInscripcion = new Map<string, NotaDeObra[]>();
  for (const n of input.notas) {
    const lista = notasPorInscripcion.get(n.registrationId) ?? [];
    lista.push(n);
    notasPorInscripcion.set(n.registrationId, lista);
  }

  const personas: Persona[] = [];
  for (const [clave, lista] of porEmail) {
    const ordenadas = [...lista].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const ultima = ordenadas[ordenadas.length - 1]!;
    // El dato más reciente que no esté vacío: la última inscripción puede ser
    // un regalo sin canjear, que todavía no tiene ciudad ni documento.
    const dato = <K extends keyof InscripcionPlana>(k: K): InscripcionPlana[K] | null => {
      for (let i = ordenadas.length - 1; i >= 0; i--) {
        const v = ordenadas[i]![k];
        if (v !== null && v !== undefined && v !== "") return v;
      }
      return null;
    };

    const cuentan = ordenadas.filter(
      (i) => ESTADOS_QUE_CUENTAN.has(i.status) && !esEdicionDePrueba(i.edicion),
    );
    const edicionesNombres = [...new Set(cuentan.map((i) => i.edicion))];

    const notas = ordenadas.flatMap((i) => notasPorInscripcion.get(i.id) ?? []);
    const valores = notas.map((n) => n.nota).filter((v): v is number => v != null);
    const puestos = notas.map((n) => n.puesto).filter((v): v is number => v != null);

    const userIds = [...new Set(ordenadas.map((i) => i.userId).filter((v): v is number => v != null))];
    const referidos = userIds.reduce((s, id) => s + (input.referidosPorUsuario.get(id) ?? 0), 0);
    const nps = userIds.map((id) => input.npsPorUsuario.get(id)).find((v) => v != null) ?? null;

    const ciudad = dato("city");
    const provincia = dato("province");
    const claveLocalidad = claveDeLocalidad(ciudad, provincia);
    const localidad = claveLocalidad ? input.localidades.get(claveLocalidad) : undefined;

    const fechaNacimiento = dato("birthDate");
    const { edad, dias } = cumpleanos(fechaNacimiento, input.hoy);

    personas.push({
      clave,
      registrationId: ultima.id,
      nombre: `${ultima.firstName} ${ultima.lastName}`.trim(),
      email: ultima.email.trim(),
      telefono: dato("phone"),
      documento: dato("documentNumber"),
      fechaNacimiento,
      edad,
      diasParaCumple: dias,
      ciudad,
      provincia,
      localidad: localidad && claveLocalidad ? { ...localidad, clave: claveLocalidad } : null,
      instagram: dato("instagramHandle")?.replace(/^@/, "") ?? null,
      ediciones: edicionesNombres.length,
      edicionesNombres,
      primeraInscripcion: ordenadas[0]!.createdAt,
      ultimaInscripcion: ultima.createdAt,
      totalPagado: ordenadas
        .filter((i) => i.paymentStatus === "APPROVED")
        .reduce((s, i) => s + i.totalAmount, 0),
      cupones: [...new Set(ordenadas.map((i) => i.promotionCode).filter((c): c is string => Boolean(c)))],
      recibioRegalo: ordenadas.some((i) => i.isGift),
      fotosSubidas: ordenadas.reduce((s, i) => s + i.fotosSubidas, 0),
      fotosAdmitidas: ordenadas.reduce((s, i) => s + i.fotosAdmitidas, 0),
      acreditaciones: ordenadas.filter((i) => i.acreditado).length,
      notaMin: valores.length ? Math.min(...valores) : null,
      notaMax: valores.length ? Math.max(...valores) : null,
      notaPromedio: valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
      mejorPuesto: puestos.length ? Math.min(...puestos) : null,
      premios: notas.map((n) => n.premio).filter((p): p is string => Boolean(p)),
      referidos,
      nps,
      autorizaRedes: ultima.autorizaRedes,
      talle: dato("talle"),
      historial: ordenadas
        .map((i) => {
          const suyas = notasPorInscripcion.get(i.id) ?? [];
          const ps = suyas.map((n) => n.puesto).filter((v): v is number => v != null);
          return {
            registrationId: i.id,
            edicion: i.edicion,
            editionId: i.editionId,
            estado: i.status,
            pago: i.paymentStatus,
            fecha: i.createdAt,
            cuenta: ESTADOS_QUE_CUENTAN.has(i.status) && !esEdicionDePrueba(i.edicion),
            numero: i.visibleCode,
            sede: i.sede,
            entrada: i.entrada,
            monto: i.totalAmount,
            moneda: i.currency,
            cupon: i.promotionCode,
            fotosSubidas: i.fotosSubidas,
            fotosAdmitidas: i.fotosAdmitidas,
            acreditado: i.acreditado,
            mejorPuesto: ps.length ? Math.min(...ps) : null,
          };
        })
        .reverse(),
    });
  }

  return personas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
