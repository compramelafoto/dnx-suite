import { huella } from "../../huella";
import { DUDAS, MOTIVOS, actualizarOIgual, huellasDe, porMapa } from "../campos";
import { campos, clave, claveEtiqueta, correo, esDatoDePrueba, fecha, partirEtiquetas, siNo, telefonoAr, texto, textoLargo } from "../normalizar";
import type { Campos, Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Contactos de Alboom (`/contacts/paginate`, doc 01 §13.4) → `Client` + `FotofficeContactoPerfil` + etiquetas.
 *
 * - Correo: minúsculas, sin espacios; si no tiene forma de correo no se guarda (duda).
 * - Teléfono: dígitos con el prefijo 54 (y el 9 en el celular, para WhatsApp); `phone` va al cliente (o el
 *   celular si no hay fijo) y `cellular` al perfil.
 * - Se descartan los datos de prueba evidentes (correos `usuario@`, `test@`, de dominios de ejemplo; nombres
 *   "prueba"/"test").
 * - Duplicados dentro de Alboom (mismo correo): queda uno solo; los demás se atan al mismo cliente y el informe
 *   los lista como fusionados.
 * - Se empareja con los clientes que ya existen por correo y, si no, por teléfono: de esos sólo se completan los
 *   campos vacíos. Si no hay pareja, se crea con el próximo número de cliente.
 * - Documento (DNI/CUIT), domicilio, cumpleaños, web y "Sobre" si vienen.
 * - Etiquetas (`tags`, texto separado por comas): se asignan sin quitar nunca ninguna; una etiqueta que no está
 *   en el catálogo se crea (duda).
 */

export const TIPO_CLIENTE = "CLIENT";

/** Campos del cliente (los demás, del perfil). */
export const CAMPOS_CLIENTE = ["kind", "firstName", "lastName", "businessName", "docType", "docNumber", "email", "phone", "address", "city"] as const;
export const CAMPOS_PERFIL = ["category", "mobile", "email2", "birthday", "website", "province", "country", "postalCode", "about"] as const;

const CATEGORIAS: Record<string, string> = {
  contacto: "CONTACTO",
  contato: "CONTACTO",
  contact: "CONTACTO",
  cliente: "CLIENTE",
  client: "CLIENTE",
  customer: "CLIENTE",
  proveedor: "PROVEEDOR",
  fornecedor: "PROVEEDOR",
  supplier: "PROVEEDOR",
  colaborador: "COLABORADOR",
  collaborator: "COLABORADOR",
};

export type ClienteExistente = { id: string; campos: Campos; tagKeys: string[] };

export type CtxContactos = {
  clientes: ClienteExistente[];
  /** nameKey → id de la etiqueta del catálogo (o simulada). */
  etiquetas: Map<string, string>;
  mapa: Map<string, EntradaMapa>;
  /**
   * Correos ya vistos en esta corrida (por huella, nunca el correo) → [id de Alboom, cliente]. Se guarda en el
   * avance para detectar duplicados entre tandas, también en la simulación.
   */
  vistos: Map<string, [string, string]>;
  /** Índices por correo y por teléfono nacional (los arma `crearCtxContactos`). */
  porCorreo: Map<string, ClienteExistente>;
  porTelefono: Map<string, ClienteExistente>;
  /** Clientes que ya vienen de otro contacto de Alboom: nunca se emparejan por teléfono (una pareja comparte teléfono). */
  deAlboom: Set<string>;
};

/** Huella de un correo para `vistos` (no se guarda el correo). */
export const claveVisto = (mail: string) => huella(`correo:${mail}`).slice(0, 20);

function indexar(ctx: Pick<CtxContactos, "porCorreo" | "porTelefono">, c: ClienteExistente) {
  const mail = correo(c.campos.email).valor;
  if (mail && !ctx.porCorreo.has(mail)) ctx.porCorreo.set(mail, c);
  for (const t of [c.campos.phone, c.campos.mobile]) {
    const n = telefonoAr(t, false).nacional;
    if (n && !ctx.porTelefono.has(n)) ctx.porTelefono.set(n, c);
  }
}

export function crearCtxContactos(d: {
  clientes: ClienteExistente[];
  etiquetas?: Map<string, string>;
  mapa?: Map<string, EntradaMapa>;
  vistos?: Map<string, [string, string]>;
}): CtxContactos {
  const ctx: CtxContactos = {
    clientes: d.clientes,
    etiquetas: d.etiquetas ?? new Map(),
    mapa: d.mapa ?? new Map(),
    vistos: d.vistos ?? new Map(),
    porCorreo: new Map(),
    porTelefono: new Map(),
    deAlboom: new Set([...(d.mapa?.values() ?? [])].map((m) => m.targetId)),
  };
  for (const c of d.clientes) indexar(ctx, c);
  return ctx;
}

function documento(p: Record<string, unknown>, empresa: boolean): { docType: string | null; docNumber: string | null; raro: boolean } {
  const rg = (texto(p.rg) ?? "").replace(/\D/g, "");
  const cpf = (texto(p.cpf) ?? "").replace(/\D/g, "");
  if (!empresa && rg.length >= 7 && rg.length <= 8) return { docType: "DNI", docNumber: rg, raro: false };
  if (cpf.length === 11) return { docType: "CUIT", docNumber: cpf, raro: false };
  if (empresa && rg.length >= 7 && rg.length <= 11) return { docType: "OTRO", docNumber: rg, raro: false };
  return { docType: null, docNumber: null, raro: rg !== "" || cpf !== "" };
}

/** Los campos de FOTOFFICE que salen del contacto de Alboom, ya normalizados, y lo que no cerró. */
export function camposDeContacto(payload: unknown): { nuevos: Campos; etiquetas: string[]; dudas: string[]; correoValido: string | null } {
  const p = campos(payload);
  const dudas: string[] = [];
  const empresa = siNo(p.is_company) === true && texto(p.company) !== null;
  const mail = correo(p.email);
  if (mail.invalido) dudas.push(DUDAS.correoInvalido);
  const mail2 = correo(p.email2);
  const fijo = telefonoAr(p.phone, false);
  const celular = telefonoAr(p.cellular, true);
  if (fijo.raro || celular.raro) dudas.push(DUDAS.telefonoRaro);
  const doc = documento(p, empresa);
  if (doc.raro) dudas.push(DUDAS.documentoRaro);
  const domicilio = [texto(p.address1, 200), texto(p.address2, 200)].filter(Boolean).join(" ") || null;
  let category: string | null = null;
  const tipo = texto(p.type_name) ?? (typeof p.type === "string" && !/^\d+$/.test(p.type) ? p.type : null);
  if (tipo) {
    category = CATEGORIAS[clave(tipo)] ?? "CLIENTE";
    if (!CATEGORIAS[clave(tipo)]) dudas.push(DUDAS.categoriaContacto);
  } else if (p.type !== undefined && p.type !== null && p.type !== "") {
    category = "CLIENTE";
    dudas.push(DUDAS.categoriaContacto);
  }
  const etiquetas = partirEtiquetas(p.tags);
  if (etiquetas.largas > 0) dudas.push(MOTIVOS.etiquetaLarga);
  const nuevos: Campos = {
    kind: empresa ? "EMPRESA" : "PERSONA",
    firstName: texto(p.name, 100),
    lastName: texto(p.lastname, 100),
    businessName: empresa ? texto(p.company, 200) : null,
    docType: doc.docType,
    docNumber: doc.docNumber,
    email: mail.valor,
    phone: fijo.valor ?? celular.valor,
    address: domicilio,
    city: texto(p.city, 100),
    category,
    mobile: celular.valor,
    email2: mail2.valor && mail2.valor !== mail.valor ? mail2.valor : null,
    birthday: fecha(p.birthday),
    website: texto(p.site_url, 200),
    province: texto(p.state, 100),
    country: texto(p.country, 100),
    postalCode: texto(p.zipcode, 20),
    about: textoLargo(p.memo, 2000),
  };
  return { nuevos, etiquetas: etiquetas.nombres, dudas, correoValido: mail.valor };
}

/**
 * Emparejar por teléfono sólo con un cliente que ya estaba en FOTOFFICE (no con otro contacto de Alboom) y cuando
 * los correos no se contradicen: dos personas distintas comparten teléfono más seguido que correo.
 */
function porTelefono(ctx: CtxContactos, nuevos: Campos, correoValido: string | null): ClienteExistente | undefined {
  for (const t of [nuevos.phone, nuevos.mobile]) {
    const n = telefonoAr(t, false).nacional;
    const c = n ? ctx.porTelefono.get(n) : undefined;
    if (!c || ctx.deAlboom.has(c.id)) continue;
    const suyo = correo(c.campos.email).valor;
    if (correoValido && suyo && suyo !== correoValido) continue;
    return c;
  }
  return undefined;
}

/** Huellas de las etiquetas que vinieron de Alboom (para no volver a poner una que alguien sacó en FOTOFFICE). */
const huellaEtiqueta = (k: string) => `etiqueta:${huella(k).slice(0, 12)}`;

export function traducirContacto(c: Crudo, ctx: CtxContactos): Decision {
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.clientes.some((x) => x.id === id));
  if (ya) return ya;
  const { nuevos, etiquetas, dudas, correoValido } = camposDeContacto(c.payload);
  if (!nuevos.firstName && !nuevos.lastName && !nuevos.businessName) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  if (esDatoDePrueba({ correo: correoValido, nombres: [nuevos.firstName as string | null, nuevos.lastName as string | null, nuevos.businessName as string | null] })) {
    return { accion: "OMITIR", motivo: MOTIVOS.datoDePrueba };
  }

  // Duplicado dentro de Alboom: mismo correo que uno ya visto en esta corrida.
  if (!mapa && correoValido) {
    const visto = ctx.vistos.get(claveVisto(correoValido));
    if (visto && visto[0] !== c.alboomId) {
      return { accion: "OMITIR", motivo: MOTIVOS.duplicadoAlboom, targetId: visto[1], fusionadoCon: visto[0], escribirMapa: true, huellas: {} };
    }
  }

  const claves = etiquetas.map(claveEtiqueta);
  const nuevasEnCatalogo = claves.filter((k) => !ctx.etiquetas.has(k)).length;
  const huellasEtiquetas = Object.fromEntries(claves.map((k) => [huellaEtiqueta(k), "1"]));
  const dudasEtiquetas = nuevasEnCatalogo > 0 ? [DUDAS.etiquetaNueva] : [];
  const todasLasDudas = [...dudas, ...dudasEtiquetas];
  const extraDudas = todasLasDudas.length ? { dudas: todasLasDudas } : {};

  const existente = mapa ? ctx.clientes.find((x) => x.id === mapa.targetId) : (correoValido ? ctx.porCorreo.get(correoValido) : undefined) ?? porTelefono(ctx, nuevos, correoValido);

  if (existente) {
    // Etiquetas: sólo las que no tiene y que no venían ya en la carga anterior (si alguien la sacó, no vuelve).
    const aAgregar = etiquetas.filter((n, i) => !existente.tagKeys.includes(claves[i]!) && !(mapa && mapa.fieldHashes[huellaEtiqueta(claves[i]!)]));
    const d = actualizarOIgual(existente.id, nuevos, existente.campos, mapa, extraDudas);
    d.huellas = { ...d.huellas, ...huellasEtiquetas };
    if (aAgregar.length > 0) {
      d.extra = { etiquetas: aAgregar };
      if (d.accion === "IGUAL") {
        d.accion = "ACTUALIZAR";
        d.datos = {};
      }
    }
    return d;
  }
  return {
    accion: "CREAR",
    datos: nuevos,
    extra: { etiquetas },
    huellas: { ...huellasDe(nuevos), ...huellasEtiquetas },
    ...extraDudas,
  };
}

export function registrarContacto(ctx: CtxContactos, c: Crudo, d: Decision, targetId: string): void {
  if (d.accion === "OMITIR") return;
  const mail = camposDeContacto(c.payload).correoValido;
  if (mail && !ctx.vistos.has(claveVisto(mail))) ctx.vistos.set(claveVisto(mail), [c.alboomId, targetId]);
  const etiquetas = Array.isArray(d.extra?.etiquetas) ? (d.extra.etiquetas as string[]) : [];
  for (const n of etiquetas) {
    const k = claveEtiqueta(n);
    if (!ctx.etiquetas.has(k)) ctx.etiquetas.set(k, `${targetId}#${k}`);
  }
  if (d.accion === "CREAR" && d.datos) {
    const nuevo = { id: targetId, campos: { ...d.datos }, tagKeys: etiquetas.map(claveEtiqueta) };
    ctx.clientes.push(nuevo);
    indexar(ctx, nuevo);
  }
  if (d.accion === "CREAR" || d.vincula) {
    ctx.deAlboom.add(targetId);
  }
}
