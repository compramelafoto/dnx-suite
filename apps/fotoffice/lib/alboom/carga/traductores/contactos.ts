import { huella } from "../../huella";
import { CONFLICTOS, DUDAS, MOTIVOS, actualizarOIgual, huellasDe, porMapa } from "../campos";
import { UMBRAL_COMPARTIDO, esCorreoDeRelleno, nombreCifrado, nombrePersona, nombresCompatibles, type NombrePersona } from "../identidad";
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
 * - Un correo o un teléfono SOLOS nunca alcanzan para decir que son la misma persona: además los nombres tienen
 *   que ser compatibles (`identidad.ts`). Los correos de relleno (`sincorreo@`, el del propio estudio…) no se
 *   guardan ni se usan; un correo o teléfono que en Alboom usan 3 o más contactos de nombres distintos no se usa
 *   para emparejar.
 * - Duplicados dentro de Alboom (mismo correo y nombre compatible): queda uno solo; los demás se atan al mismo
 *   cliente y el informe los lista como fusionados. Mismo correo con otro nombre: se cargan por separado
 *   (conflicto "correo compartido").
 * - Se empareja con los clientes que ya existen por correo y, si no, por teléfono (siempre con nombre compatible):
 *   de esos sólo se completan los campos vacíos. Si no hay pareja, se crea con el próximo número de cliente.
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

/** Un contacto ya visto en esta corrida (sin datos: el nombre va cifrado con la sal de la corrida). */
export type Visto = { a: string; t: string; n: NombrePersona };

export type CtxContactos = {
  clientes: ClienteExistente[];
  /** nameKey → id de la etiqueta del catálogo (o simulada). */
  etiquetas: Map<string, string>;
  mapa: Map<string, EntradaMapa>;
  /**
   * Correos ya vistos en esta corrida (por huella con sal, nunca el correo) → contactos que lo usaron. Se guarda en
   * el avance para detectar duplicados entre tandas, también en la simulación.
   */
  vistos: Map<string, Visto[]>;
  /** Sal de la corrida para las huellas de `vistos`. */
  sal: string;
  /** Correos del propio estudio (miembros, contacto del branding): son de relleno para un cliente. */
  delEstudio: Set<string>;
  /** Correos y teléfonos nacionales que en Alboom usan 3 o más contactos de nombres distintos. */
  correosCompartidos: Set<string>;
  telefonosCompartidos: Set<string>;
  /** Índices por correo y por teléfono nacional (los arma `crearCtxContactos`). */
  porCorreo: Map<string, ClienteExistente[]>;
  porTelefono: Map<string, ClienteExistente[]>;
  /** Clientes que ya vienen de otro contacto de Alboom: nunca se emparejan por teléfono. */
  deAlboom: Set<string>;
};

/** Huella de un correo para `vistos` (no se guarda el correo). */
export const claveVisto = (mail: string, sal = "") => huella(`correo:${sal}:${mail}`).slice(0, 20);

function agregar<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const l = m.get(k);
  if (l) l.push(v);
  else m.set(k, [v]);
}

function indexar(ctx: Pick<CtxContactos, "porCorreo" | "porTelefono">, c: ClienteExistente) {
  const mail = correo(c.campos.email).valor;
  if (mail) agregar(ctx.porCorreo, mail, c);
  const tels = new Set([c.campos.phone, c.campos.mobile].map((t) => telefonoAr(t, false).nacional).filter((n): n is string => n !== null));
  for (const n of tels) agregar(ctx.porTelefono, n, c);
}

/**
 * Correos y teléfonos compartidos: los que en los contactos de Alboom aparecen con `UMBRAL_COMPARTIDO` o más
 * nombres distintos. Se calcula con todos los crudos antes de traducir.
 */
export function compartidos(payloads: Iterable<unknown>): { correos: Set<string>; telefonos: Set<string> } {
  const porCorreo = new Map<string, Set<string>>();
  const porTel = new Map<string, Set<string>>();
  for (const payload of payloads) {
    const p = campos(payload);
    const nombre = nombrePersona(p.name, p.lastname, p.company).tokens.sort().join(" ");
    const mail = correo(p.email).valor;
    if (mail) (porCorreo.get(mail) ?? porCorreo.set(mail, new Set()).get(mail)!).add(nombre);
    for (const t of [p.phone, p.cellular]) {
      const n = telefonoAr(t, false).nacional;
      if (n) (porTel.get(n) ?? porTel.set(n, new Set()).get(n)!).add(nombre);
    }
  }
  const muchos = (m: Map<string, Set<string>>) => new Set([...m].filter(([, s]) => s.size >= UMBRAL_COMPARTIDO).map(([k]) => k));
  return { correos: muchos(porCorreo), telefonos: muchos(porTel) };
}

export function crearCtxContactos(d: {
  clientes: ClienteExistente[];
  etiquetas?: Map<string, string>;
  mapa?: Map<string, EntradaMapa>;
  vistos?: Map<string, Visto[]>;
  sal?: string;
  delEstudio?: Iterable<string>;
  correosCompartidos?: Set<string>;
  telefonosCompartidos?: Set<string>;
}): CtxContactos {
  const ctx: CtxContactos = {
    clientes: d.clientes,
    etiquetas: d.etiquetas ?? new Map(),
    mapa: d.mapa ?? new Map(),
    vistos: d.vistos ?? new Map(),
    sal: d.sal ?? "",
    delEstudio: new Set([...(d.delEstudio ?? [])].map((m) => correo(m).valor).filter((m): m is string => m !== null)),
    correosCompartidos: d.correosCompartidos ?? new Set(),
    telefonosCompartidos: d.telefonosCompartidos ?? new Set(),
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

const nombreDe = (v: Campos) => nombrePersona(v.firstName, v.lastName, v.businessName);

/** El correo que sirve para emparejar (ni de relleno ni compartido por muchos) y lo que hay que avisar. */
function analizarCorreo(ctx: CtxContactos, mail: string | null): { usable: string | null; relleno: boolean; deVarios: boolean } {
  if (!mail) return { usable: null, relleno: false, deVarios: false };
  if (esCorreoDeRelleno(mail, ctx.delEstudio)) return { usable: null, relleno: true, deVarios: false };
  if (ctx.correosCompartidos.has(mail)) return { usable: null, relleno: false, deVarios: true };
  return { usable: mail, relleno: false, deVarios: false };
}

/**
 * Emparejar por teléfono sólo con un cliente que ya estaba en FOTOFFICE (no con otro contacto de Alboom), con
 * nombre compatible y sin correos que se contradigan; nunca por un teléfono que usan varios contactos de Alboom.
 */
function porTelefono(ctx: CtxContactos, nuevos: Campos, nombre: NombrePersona, correoValido: string | null): ClienteExistente | undefined {
  for (const t of [nuevos.phone, nuevos.mobile]) {
    const n = telefonoAr(t, false).nacional;
    if (!n || ctx.telefonosCompartidos.has(n)) continue;
    for (const c of ctx.porTelefono.get(n) ?? []) {
      if (ctx.deAlboom.has(c.id) || !nombresCompatibles(nombre, nombreDe(c.campos))) continue;
      const suyo = correo(c.campos.email).valor;
      if (correoValido && suyo && suyo !== correoValido) continue;
      return c;
    }
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
  const conflictos: string[] = [];
  const correoInfo = analizarCorreo(ctx, correoValido);
  if (correoInfo.relleno) {
    nuevos.email = null;
    dudas.push(DUDAS.correoDeRelleno);
  }
  if (typeof nuevos.email2 === "string" && esCorreoDeRelleno(nuevos.email2, ctx.delEstudio)) nuevos.email2 = null;
  if (correoInfo.deVarios) conflictos.push(CONFLICTOS.correoDeVarios);
  const usable = correoInfo.usable;
  const nombre = nombreDe(nuevos);

  // Duplicado dentro de Alboom: mismo correo y nombre compatible que uno ya visto en esta corrida.
  if (!mapa && usable) {
    const vistos = (ctx.vistos.get(claveVisto(usable, ctx.sal)) ?? []).filter((v) => v.a !== c.alboomId);
    const cifrado = nombreCifrado(nombre, ctx.sal);
    const mismo = vistos.find((v) => nombresCompatibles(cifrado, v.n));
    if (mismo) return { accion: "OMITIR", motivo: MOTIVOS.duplicadoAlboom, targetId: mismo.t, fusionadoCon: mismo.a, escribirMapa: true, huellas: {} };
    if (vistos.length > 0) conflictos.push(CONFLICTOS.correoCompartido);
  }

  const claves = etiquetas.map(claveEtiqueta);
  const nuevasEnCatalogo = claves.filter((k) => !ctx.etiquetas.has(k)).length;
  const huellasEtiquetas = Object.fromEntries(claves.map((k) => [huellaEtiqueta(k), "1"]));
  const dudasEtiquetas = nuevasEnCatalogo > 0 ? [DUDAS.etiquetaNueva] : [];
  const todasLasDudas = [...dudas, ...dudasEtiquetas];
  const extra: Partial<Decision> = {
    ...(todasLasDudas.length ? { dudas: todasLasDudas } : {}),
    ...(conflictos.length ? { conflictos: [...new Set(conflictos)] } : {}),
  };

  let existente: ClienteExistente | undefined;
  if (mapa) existente = ctx.clientes.find((x) => x.id === mapa.targetId);
  else {
    const porCorreo = usable ? (ctx.porCorreo.get(usable) ?? []) : [];
    existente = porCorreo.find((x) => nombresCompatibles(nombre, nombreDe(x.campos)));
    if (!existente && porCorreo.length > 0 && !extra.conflictos?.includes(CONFLICTOS.correoCompartido)) {
      extra.conflictos = [...(extra.conflictos ?? []), CONFLICTOS.correoCompartido];
    }
    existente ??= porTelefono(ctx, nuevos, nombre, correoValido);
  }

  if (existente) {
    // Etiquetas: sólo las que no tiene y que no venían ya en la carga anterior (si alguien la sacó, no vuelve).
    const aAgregar = etiquetas.filter((n, i) => !existente.tagKeys.includes(claves[i]!) && !(mapa && mapa.fieldHashes[huellaEtiqueta(claves[i]!)]));
    const d = actualizarOIgual(existente.id, nuevos, existente.campos, mapa, extra);
    d.huellas = { ...d.huellas, ...huellasEtiquetas };
    if (aAgregar.length > 0) {
      d.extra = { etiquetas: aAgregar };
      if (d.accion === "IGUAL") {
        d.accion = "ACTUALIZAR";
        d.datos = {};
        d.previos = {};
      }
    }
    return d;
  }
  return {
    accion: "CREAR",
    datos: nuevos,
    extra: { etiquetas },
    huellas: { ...huellasDe(nuevos), ...huellasEtiquetas },
    ...extra,
  };
}

export function registrarContacto(ctx: CtxContactos, c: Crudo, d: Decision, targetId: string): void {
  if (d.accion === "OMITIR") return;
  const { nuevos, correoValido } = camposDeContacto(c.payload);
  const usable = analizarCorreo(ctx, correoValido).usable;
  if (usable) {
    const k = claveVisto(usable, ctx.sal);
    const lista = ctx.vistos.get(k) ?? [];
    if (!lista.some((v) => v.a === c.alboomId)) ctx.vistos.set(k, [...lista, { a: c.alboomId, t: targetId, n: nombreCifrado(nombreDe(nuevos), ctx.sal) }]);
  }
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
  if (d.accion === "CREAR" || d.vincula) ctx.deAlboom.add(targetId);
}
