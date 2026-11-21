/** Validación de los laboratorios que carga cada fotógrafo («Mis laboratorios»). Función pura. */

export type ContactoInput = {
  nombre: string;
  email: string;
  whatsapp?: string;
  puntoDeRetiro?: boolean;
  direccion?: string;
  horario?: string;
  esPredeterminado?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function limpio(v: string | undefined): string | undefined {
  const t = (v ?? "").trim();
  return t ? t : undefined;
}

export function validarContacto(
  i: ContactoInput,
  labVinculado: { address: string | null } | null,
): { ok: true; datos: ContactoInput } | { ok: false; error: string } {
  const nombre = (i.nombre ?? "").trim();
  const email = (i.email ?? "").trim().toLowerCase();
  if (!nombre) return { ok: false, error: "Poné el nombre del laboratorio." };
  if (!email) return { ok: false, error: "Poné el correo del laboratorio." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "El correo no parece válido." };

  const direccion = limpio(i.direccion);
  const horario = limpio(i.horario);
  const puntoDeRetiro = i.puntoDeRetiro === true;
  if (puntoDeRetiro) {
    // Con lab vinculado que tiene dirección alcanza (la dirección del lab es la del retiro).
    const labConDireccion = !!limpio(labVinculado?.address ?? undefined);
    if (!labConDireccion && !(direccion && horario)) {
      return { ok: false, error: "Para ser punto de retiro cargá la dirección y el horario." };
    }
  }

  return {
    ok: true,
    datos: {
      nombre,
      email,
      whatsapp: limpio(i.whatsapp),
      puntoDeRetiro,
      direccion,
      horario,
      esPredeterminado: i.esPredeterminado === true,
    },
  };
}

function texto(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Normaliza el cuerpo crudo de la petición: null o campos que no son texto no rompen nada. */
export function leerCuerpoContacto(
  raw: unknown,
): { nombre?: string; email?: string; whatsapp?: string; direccion?: string; horario?: string; notas?: string; puntoDeRetiro?: boolean; esPredeterminado?: boolean } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
  return {
    nombre: texto(o.nombre),
    email: texto(o.email),
    whatsapp: texto(o.whatsapp),
    direccion: texto(o.direccion),
    horario: texto(o.horario),
    notas: texto(o.notas),
    puntoDeRetiro: bool(o.puntoDeRetiro),
    esPredeterminado: bool(o.esPredeterminado),
  };
}
