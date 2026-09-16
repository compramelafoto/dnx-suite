import "server-only";

import { prisma } from "@repo/db";
import { esCategoriaValida } from "./categorias";
import { buscarDuplicados, elegirVinculo, type Ficha } from "./duplicados";
import { nombreNormalizado } from "./normalizar";

/**
 * Da de alta un proveedor desde el enlace de un evento.
 *
 * Lo que decide si es una empresa nueva o una que ya está vive en `duplicados.ts`, que es
 * puro. Acá se va a buscar a la base, se escribe y se resuelve la carrera: dos proveedores
 * mandando el mismo formulario a la vez no pueden quedar dos veces en el mismo evento, y
 * eso lo garantiza la restricción `@@unique([eventId, partnerId])`, no un `if`.
 */

/**
 * Cuántas empresas se comparan como mucho.
 *
 * Hoy la base tiene unas pocas y traerlas todas es gratis. La comparación no se puede
 * hacer en SQL porque las claves se comparan normalizadas —sin acentos, sin la forma
 * societaria, sin el `@` de Instagram— y la base guarda lo que la persona escribió.
 *
 * El día que esto quede corto, la solución es una columna normalizada con índice, no subir
 * el número. Por eso, cuando se pasa, queda anotado en la auditoría en vez de fallar en
 * silencio: un duplicado que se cuela sin que nadie se entere es peor que un error.
 */
const LIMITE_DE_COMPARACION = 5000;

export type DatosDelProveedor = {
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  categoria: string;
  descripcion?: string | null;
  contactoNombre?: string | null;
  contactoRol?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  sitioWeb?: string | null;
  instagram?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  /** Autoriza que lo contactemos por este evento. Sin esto no se guarda nada. */
  aceptaContacto: boolean;
  /** Autoriza que le lleguen oportunidades y novedades. Es aparte, y puede ser que no. */
  aceptaNovedades: boolean;
};

export type ResultadoDelAlta =
  | { ok: false; error: string }
  | { ok: true; partnerId: string; creado: boolean; yaEstaba: boolean };

const limpio = (v: string | null | undefined) => {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
};

/**
 * El teléfono de la empresa.
 *
 * El formulario pide WhatsApp y no teléfono, porque es lo que la gente tiene a mano. Si
 * no se cayera al WhatsApp, la ficha de la empresa quedaría sin ningún número — y en una
 * base de proveedores el número es lo que más vale.
 */
const telefonoDeLaEmpresa = (datos: DatosDelProveedor) =>
  limpio(datos.telefono) ?? limpio(datos.whatsapp);

export async function registrarProveedor(
  eventoId: string,
  datos: DatosDelProveedor,
  ipHash: string | null,
): Promise<ResultadoDelAlta> {
  const nombre = limpio(datos.nombre);
  if (!nombre || !nombreNormalizado(nombre)) return { ok: false, error: "Falta el nombre." };
  if (!esCategoriaValida(datos.categoria)) return { ok: false, error: "Elegí una categoría." };
  // Sin permiso para contactarlo, la ficha no tiene para qué existir.
  if (!datos.aceptaContacto) return { ok: false, error: "Falta autorizar el contacto." };

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { id: eventoId },
    select: { id: true, sellerProfile: { select: { userId: true } } },
  });
  if (!evento) return { ok: false, error: "El evento no existe." };

  const ficha: Ficha = {
    nombre,
    cuit: datos.cuit,
    email: datos.email,
    instagram: datos.instagram,
    sitioWeb: datos.sitioWeb,
  };

  const existentes = await prisma.dnxPartner.findMany({
    where: { archivedAt: null },
    take: LIMITE_DE_COMPARACION + 1,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, taxId: true, email: true, instagram: true, websiteUrl: true },
  });

  const seCorto = existentes.length > LIMITE_DE_COMPARACION;
  const vinculo = elegirVinculo(
    buscarDuplicados(
      ficha,
      existentes.slice(0, LIMITE_DE_COMPARACION).map((p) => ({
        id: p.id,
        nombre: p.name,
        cuit: p.taxId,
        email: p.email,
        instagram: p.instagram,
        sitioWeb: p.websiteUrl,
      })),
    ),
  );

  let partnerId: string;
  let creado = false;

  if (vinculo.accion === "vincular") {
    partnerId = vinculo.partnerId;
    /*
      A una empresa que ya está **no se le pisa nada**. Se completan sólo los campos
      vacíos. Quien llena el formulario en la puerta de un salón sabe menos de la empresa
      que quien cargó la ficha con tiempo, y no tiene por qué borrarle el trabajo.
    */
    await completarVacios(partnerId, nombre, datos);
  } else {
    const creada = await prisma.dnxPartner.create({
      data: {
        name: nombre,
        legalName: limpio(datos.razonSocial),
        slug: await slugLibre(nombre),
        description: limpio(datos.descripcion),
        // PROSPECT y no ACTIVE: se conoció en un evento, nadie la revisó todavía.
        status: "PROSPECT",
        taxId: limpio(datos.cuit),
        email: limpio(datos.email),
        phone: telefonoDeLaEmpresa(datos),
        websiteUrl: limpio(datos.sitioWeb),
        instagram: limpio(datos.instagram),
        city: limpio(datos.localidad),
        provinceOrState: limpio(datos.provincia),
        country: limpio(datos.pais) ?? "Argentina",
        createdByUserId: evento.sellerProfile.userId,
        notes: notaDeOrigen(vinculo.posiblesDuplicados, seCorto),
      },
      select: { id: true },
    });
    partnerId = creada.id;
    creado = true;
  }

  if (limpio(datos.contactoNombre)) await agregarContacto(partnerId, datos);

  /*
    La vinculación al evento. `createMany` con `skipDuplicates` y no un `findFirst` antes:
    la restricción de la base es lo único que resuelve dos envíos simultáneos, y este es
    justamente el criterio de aceptación de la tarea.
  */
  const vinculado = await prisma.subilafotoEventVendor.createMany({
    data: [
      {
        eventId: eventoId,
        partnerId,
        category: datos.categoria,
        roleNote: limpio(datos.contactoRol),
        completedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  await registrarConsentimientos(eventoId, datos, ipHash);

  return { ok: true, partnerId, creado, yaEstaba: vinculado.count === 0 };
}

/** Sólo lo que está vacío. Nunca se pisa un dato cargado. */
async function completarVacios(partnerId: string, nombre: string, datos: DatosDelProveedor) {
  const actual = await prisma.dnxPartner.findUnique({
    where: { id: partnerId },
    select: {
      legalName: true,
      description: true,
      taxId: true,
      email: true,
      phone: true,
      websiteUrl: true,
      instagram: true,
      city: true,
      provinceOrState: true,
    },
  });
  if (!actual) return;

  const si = (viejo: string | null, nuevo: string | null | undefined) =>
    viejo ? undefined : (limpio(nuevo) ?? undefined);

  await prisma.dnxPartner.update({
    where: { id: partnerId },
    data: {
      legalName: si(actual.legalName, datos.razonSocial),
      description: si(actual.description, datos.descripcion),
      taxId: si(actual.taxId, datos.cuit),
      email: si(actual.email, datos.email),
      phone: actual.phone ? undefined : (telefonoDeLaEmpresa(datos) ?? undefined),
      websiteUrl: si(actual.websiteUrl, datos.sitioWeb),
      instagram: si(actual.instagram, datos.instagram),
      city: si(actual.city, datos.localidad),
      provinceOrState: si(actual.provinceOrState, datos.provincia),
    },
  });
  // El nombre nunca se toca: es lo que un administrador ya decidió que se llama.
  void nombre;
}

async function agregarContacto(partnerId: string, datos: DatosDelProveedor) {
  const nombre = limpio(datos.contactoNombre)!;
  const [pila, ...resto] = nombre.split(/\s+/);
  const yaHay = await prisma.dnxPartnerContact.count({ where: { partnerId, archivedAt: null } });

  await prisma.dnxPartnerContact.create({
    data: {
      partnerId,
      firstName: pila!,
      lastName: resto.length > 0 ? resto.join(" ") : null,
      roleTitle: limpio(datos.contactoRol),
      email: limpio(datos.email),
      phone: limpio(datos.telefono),
      whatsapp: limpio(datos.whatsapp),
      // El contacto es privado salvo que alguien decida lo contrario: el proveedor
      // autorizó que lo contactemos nosotros, no que su teléfono se publique.
      emailIsPublic: false,
      phoneIsPublic: false,
      isPrimary: yaHay === 0,
    },
  });
}

/**
 * Los dos consentimientos, por separado.
 *
 * `TERMS` es el permiso para contactarlo por este evento, y sin él no se llega hasta acá.
 * `PROMOTIONAL_USE` es el otro, el de recibir oportunidades y novedades: se guarda tanto
 * el sí como el no, porque poder demostrar que alguien dijo que no es tan importante como
 * lo otro.
 */
async function registrarConsentimientos(
  eventoId: string,
  datos: DatosDelProveedor,
  ipHash: string | null,
) {
  const email = limpio(datos.email);
  await prisma.subilafotoConsent.createMany({
    data: [
      {
        eventId: eventoId,
        subjectEmail: email,
        kind: "TERMS",
        documentVersion: "proveedor-2026-09-15",
        accepted: true,
        ipHash,
      },
      {
        eventId: eventoId,
        subjectEmail: email,
        kind: "PROMOTIONAL_USE",
        documentVersion: "proveedor-2026-09-15",
        accepted: datos.aceptaNovedades,
        ipHash,
      },
    ],
  });
}

function notaDeOrigen(posibles: string[] | undefined, seCorto: boolean): string | null {
  const partes = ["Alta desde el enlace de proveedores de un evento de SubiLaFoto."];
  if (posibles?.length) partes.push(`Posibles duplicados a revisar: ${posibles.join(", ")}.`);
  if (seCorto) {
    partes.push(
      `La comparación se cortó en ${LIMITE_DE_COMPARACION} empresas: puede haber un duplicado sin detectar.`,
    );
  }
  return partes.join(" ");
}

/** Un slug que no choque. El `@unique` del schema no perdona. */
async function slugLibre(nombre: string): Promise<string> {
  const base = (nombreNormalizado(nombre) ?? "proveedor").replace(/\s+/g, "-").slice(0, 60);

  for (let intento = 0; intento < 20; intento += 1) {
    const propuesto = intento === 0 ? base : `${base}-${intento + 1}`;
    const tomado = await prisma.dnxPartner.count({ where: { slug: propuesto } });
    if (tomado === 0) return propuesto;
  }

  return `${base}-${Date.now().toString(36)}`;
}
