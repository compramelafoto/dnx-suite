"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireStoreConfigurer } from "@/lib/store/access";
import {
  parseShippingSettingsForm,
  settingsAfterAndreaniDisconnect,
  settingsAfterCorreoDisconnect,
  SHIPPING_SETTINGS_DEFAULTS,
} from "@/lib/store/shipping/settings-form";
import { parseZoneForm } from "@/lib/store/shipping/zone-form";
import { buildPackage, normalizePostalCode } from "@/lib/store/shipping/package";
import { loadShippingSettings, toShippingSource } from "@/lib/store/shipping/repository";
import { formatMinorArs, minorToDecimalString } from "@/lib/membership/money";
import { getIntegrationSummary } from "@/lib/integrations/store";
import { CORREO_ARGENTINO_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { IntegrationsVaultError } from "@/lib/integrations/vault";
import {
  deleteCorreoArgentinoCredentials,
  loadCorreoArgentinoClient,
  markCorreoNeedsReconsent,
  saveCorreoArgentinoCredentials,
} from "@/lib/integrations/correo-argentino/credentials";
import { isMiCorreoError } from "@/lib/integrations/correo-argentino/errors";
import { miCorreoUserMessage } from "@/lib/integrations/correo-argentino/user-message";
import {
  deleteAndreaniCredentials,
  describeAndreaniConnection,
  loadAndreaniClient,
  markAndreaniNeedsReconsent,
  saveAndreaniCredentials,
} from "@/lib/integrations/andreani/credentials";
import { isAndreaniError } from "@/lib/integrations/andreani/errors";
import { andreaniUserMessage } from "@/lib/integrations/andreani/user-message";

/**
 * Acciones de la configuración de envíos. Todas pasan por `requireStoreConfigurer` y toman el
 * workspace de la sesión, nunca del formulario. Devuelven un resultado en vez de redirigir:
 * las llaman formularios con `onSubmit`, y un error no tiene que borrar lo escrito.
 *
 * Logs: sólo `kind` y `status` de MiCorreo y de Andreani. Nunca credenciales, nunca el mensaje
 * del correo.
 */

export type ShippingActionResult = { ok: true; message?: string } | { ok: false; error: string };

const RUTA = "/ventas/tienda/envios";

/** La zona se borró entre la verificación y la transacción. Se traduce a un mensaje, no a un 500. */
class ZonaInexistente extends Error {}

async function correoActivo(workspaceId: string): Promise<boolean> {
  const resumen = await getIntegrationSummary(workspaceId, CORREO_ARGENTINO_INTEGRATION_KEY);
  return resumen?.status === "ACTIVE";
}

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

// --- Configuración general -----------------------------------------------------------------

export async function saveShippingSettingsAction(formData: FormData): Promise<ShippingActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const [activo, andreani, previa] = await Promise.all([
    correoActivo(workspace.id),
    // Enmascarada: de acá sólo se mira el estado y si hay contrato de sucursal.
    describeAndreaniConnection(workspace.id),
    prisma.storeShippingSettings.findUnique({
      where: { workspaceId: workspace.id },
      select: { source: true, branchDeliveryEnabled: true },
    }),
  ]);
  const parsed = parseShippingSettingsForm(formData, {
    correoActive: activo,
    andreaniActive: andreani?.status === "ACTIVE",
    andreaniBranchContract: Boolean(andreani?.contractBranch),
    previous: previa
      ? { source: toShippingSource(previa.source), branchDeliveryEnabled: previa.branchDeliveryEnabled }
      : null,
  });
  if (!parsed.ok) return parsed;

  await prisma.storeShippingSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...parsed.values },
    update: parsed.values,
  });
  revalidatePath(RUTA);
  return { ok: true };
}

// --- Zonas ---------------------------------------------------------------------------------

export async function saveShippingZoneAction(formData: FormData): Promise<ShippingActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const parsed = parseZoneForm(formData);
  if (!parsed.ok) return parsed;
  const { rates, ...zona } = parsed.values;
  const zoneId = texto(formData, "zoneId") || null;

  if (zoneId) {
    const existe = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!existe) return { ok: false, error: "Esa zona ya no existe. Recargá la página." };
  }

  // Un solo "resto del país": si hubiera dos, el destino caería en una u otra según el orden.
  if (zona.isRestOfCountry) {
    const otra = await prisma.storeShippingZone.findFirst({
      where: { workspaceId: workspace.id, isRestOfCountry: true, ...(zoneId ? { NOT: { id: zoneId } } : {}) },
      select: { name: true },
    });
    if (otra) {
      return {
        ok: false,
        error: `La zona "${otra.name}" ya cubre el resto del país. Sólo una zona puede tenerlo.`,
      };
    }
  }

  // Los escalones ya vienen sin pesos repetidos (`parseZoneForm`), así que el único de
  // (zona, peso) no puede saltar acá adentro.
  try {
    await prisma.$transaction(async (tx) => {
      let id = zoneId;
      if (id) {
        const actualizadas = await tx.storeShippingZone.updateMany({
          where: { id, workspaceId: workspace.id },
          data: zona,
        });
        // Sin esto, el `createMany` de abajo fallaría por la clave foránea con un error crudo.
        if (actualizadas.count === 0) throw new ZonaInexistente();
      } else {
        const ultimo = await tx.storeShippingZone.aggregate({
          where: { workspaceId: workspace.id },
          _max: { sortOrder: true },
        });
        const creada = await tx.storeShippingZone.create({
          data: { workspaceId: workspace.id, ...zona, sortOrder: (ultimo._max.sortOrder ?? -1) + 1 },
          select: { id: true },
        });
        id = creada.id;
      }
      await tx.storeShippingRate.deleteMany({ where: { zoneId: id } });
      await tx.storeShippingRate.createMany({
        data: rates.map((r) => ({ zoneId: id, maxGrams: r.maxGrams, priceArs: minorToDecimalString(r.priceMinor) })),
      });
    });
  } catch (error) {
    if (error instanceof ZonaInexistente) return { ok: false, error: "Esa zona ya no existe. Recargá la página." };
    throw error;
  }

  revalidatePath(RUTA);
  return { ok: true };
}

export async function deleteShippingZoneAction(zoneId: string): Promise<ShippingActionResult> {
  const { workspace } = await requireStoreConfigurer();
  if (typeof zoneId !== "string" || zoneId === "") return { ok: false, error: "Falta la zona." };
  // Los escalones se borran en cascada.
  await prisma.storeShippingZone.deleteMany({ where: { id: zoneId, workspaceId: workspace.id } });
  revalidatePath(RUTA);
  return { ok: true };
}

// --- Correo Argentino ----------------------------------------------------------------------

function errorDeCorreo(error: unknown, contexto: string): string {
  if (isMiCorreoError(error)) {
    console.warn(`[shipping] ${contexto}`, { kind: error.kind, status: error.status });
    return miCorreoUserMessage(error);
  }
  if (error instanceof IntegrationsVaultError) {
    console.error(`[shipping] ${contexto}: baúl de integraciones`, { code: error.code });
    return "El servidor no tiene configurado el cifrado de credenciales. Avisá a soporte de DNX.";
  }
  console.error(`[shipping] ${contexto}: error inesperado`);
  return "No se pudo completar. Probá de nuevo en un rato.";
}

export async function connectCorreoAction(formData: FormData): Promise<ShippingActionResult> {
  const { user, workspace } = await requireStoreConfigurer();
  const env = texto(formData, "env");
  if (env !== "TEST" && env !== "PROD") return { ok: false, error: "Elegí el ambiente: pruebas o producción." };

  // Las contraseñas no se recortan: un espacio puede ser parte de la clave.
  const apiPassword = formData.get("apiPassword");
  const accountPassword = formData.get("accountPassword");
  const input = {
    env: env as "TEST" | "PROD",
    apiUser: texto(formData, "apiUser"),
    apiPassword: typeof apiPassword === "string" ? apiPassword : "",
    accountEmail: texto(formData, "accountEmail"),
    accountPassword: typeof accountPassword === "string" ? accountPassword : "",
  };
  if (!input.apiUser || !input.apiPassword || !input.accountEmail || !input.accountPassword) {
    return { ok: false, error: "Completá los cuatro datos: usuario y contraseña de la API, email y contraseña de MiCorreo." };
  }

  try {
    await saveCorreoArgentinoCredentials(workspace.id, user.id, input);
  } catch (error) {
    return { ok: false, error: errorDeCorreo(error, "no se pudo conectar MiCorreo") };
  }
  revalidatePath(RUTA);
  return { ok: true, message: "Listo, Correo Argentino quedó conectado." };
}

export async function disconnectCorreoAction(): Promise<ShippingActionResult> {
  const { workspace } = await requireStoreConfigurer();

  // Sin Correo no puede quedar como fuente ni el envío a sucursal prendido: se vuelve a la
  // tabla propia antes de borrar la credencial. Si así no quedara ninguna forma de entrega,
  // se prende el retiro en la sede (en la misma escritura).
  const previa = await prisma.storeShippingSettings.findUnique({
    where: { workspaceId: workspace.id },
    select: { source: true, branchDeliveryEnabled: true, pickupEnabled: true, homeDeliveryEnabled: true },
  });
  const cambio = previa ? settingsAfterCorreoDisconnect({ ...previa, source: toShippingSource(previa.source) }) : null;
  if (cambio) {
    await prisma.storeShippingSettings.update({ where: { workspaceId: workspace.id }, data: cambio.data });
  }
  await deleteCorreoArgentinoCredentials(workspace.id);

  revalidatePath(RUTA);
  let message = "Se desconectó Correo Argentino.";
  if (cambio) {
    message = "Se desconectó. El precio del envío ahora sale de tu tabla y el envío a sucursal quedó apagado.";
    if (cambio.pickupForced) message += " Activamos el retiro en la sede para que la tienda siga teniendo una forma de entrega.";
  }
  return { ok: true, message };
}

/**
 * Cotiza con MiCorreo un paquete de prueba (la caja por defecto con un producto del peso por
 * defecto) desde el CP de origen hasta el mismo CP, a domicilio. Muestra el precio sin recargo.
 */
export async function testCorreoConnectionAction(): Promise<ShippingActionResult> {
  const { workspace } = await requireStoreConfigurer();

  const settings = await loadShippingSettings(workspace.id);
  const origen = settings?.originPostalCode ?? null;
  if (!origen) {
    return { ok: false, error: "Para probar, primero guardá el código postal de origen en la configuración de arriba." };
  }

  const conexion = await loadCorreoArgentinoClient(workspace.id);
  if (!conexion) return { ok: false, error: "Correo Argentino no está conectado (o hay que volver a conectarlo)." };

  const d = SHIPPING_SETTINGS_DEFAULTS;
  const cfg = settings?.packageConfig ?? {
    packagingGrams: d.packagingGrams,
    defaultUnitGrams: d.defaultUnitGrams,
    boxLengthCm: d.boxLengthCm,
    boxWidthCm: d.boxWidthCm,
    boxHeightCm: d.boxHeightCm,
  };
  const pkg = buildPackage([{ qty: 1, weightGrams: null, lengthCm: null, widthCm: null, heightCm: null }], cfg);

  try {
    const tarifas = await conexion.client.rates({
      customerId: conexion.customerId,
      postalCodeOrigin: origen,
      postalCodeDestination: origen,
      deliveredType: "D",
      dimensions: { weight: pkg.weightGrams, length: pkg.lengthCm, width: pkg.widthCm, height: pkg.heightCm },
    });
    const domicilio = tarifas.filter((t) => t.deliveredType === "D");
    if (domicilio.length === 0) {
      return { ok: false, error: "Correo Argentino contestó, pero sin precios a domicilio para ese destino." };
    }
    const mejor = domicilio.reduce((a, b) => (b.priceMinor < a.priceMinor ? b : a));
    const servicio = mejor.productName ? ` (${mejor.productName})` : "";
    return {
      ok: true,
      message: `Funciona. Un paquete de ${pkg.weightGrams} g y ${pkg.lengthCm}×${pkg.widthCm}×${pkg.heightCm} cm a tu mismo código postal cuesta ${formatMinorArs(mejor.priceMinor)}${servicio}, sin tu recargo.`,
    };
  } catch (error) {
    if (isMiCorreoError(error) && error.kind === "AUTH") {
      await markCorreoNeedsReconsent(workspace.id);
      revalidatePath(RUTA);
    }
    return { ok: false, error: errorDeCorreo(error, "falló la prueba de MiCorreo") };
  }
}

// --- Andreani ------------------------------------------------------------------------------

function errorDeAndreani(error: unknown, contexto: string): string {
  if (isAndreaniError(error)) {
    console.warn(`[shipping] ${contexto}`, { kind: error.kind, status: error.status });
    return andreaniUserMessage(error);
  }
  if (error instanceof IntegrationsVaultError) {
    console.error(`[shipping] ${contexto}: baúl de integraciones`, { code: error.code });
    return "El servidor no tiene configurado el cifrado de credenciales. Avisá a soporte de DNX.";
  }
  console.error(`[shipping] ${contexto}: error inesperado`);
  return "No se pudo completar. Probá de nuevo en un rato.";
}

/** Códigos de Andreani (cliente, contratos, sucursal): letras, números y guiones, hasta 40. */
function codigo(raw: string): string | null {
  return /^[A-Za-z0-9-]{1,40}$/.test(raw) ? raw : null;
}

export async function connectAndreaniAction(formData: FormData): Promise<ShippingActionResult> {
  const { user, workspace } = await requireStoreConfigurer();
  const env = texto(formData, "env");
  if (env !== "QA" && env !== "PROD") return { ok: false, error: "Elegí el ambiente: pruebas o producción." };

  // La contraseña no se recorta: un espacio puede ser parte de la clave.
  const password = formData.get("password");
  const usuario = texto(formData, "user");
  const clientCode = texto(formData, "clientCode");
  const contractHome = texto(formData, "contractHome");
  const contractBranch = texto(formData, "contractBranch");
  const originBranch = texto(formData, "originBranch");
  if (!usuario || typeof password !== "string" || !password || !clientCode || !contractHome) {
    return {
      ok: false,
      error: "Completá usuario, contraseña, código de cliente y contrato de envío a domicilio.",
    };
  }
  if (!codigo(clientCode) || !codigo(contractHome) || (contractBranch && !codigo(contractBranch))) {
    return { ok: false, error: "El código de cliente y los contratos son números o letras, sin espacios." };
  }
  if (originBranch && !codigo(originBranch)) {
    return { ok: false, error: "La sucursal de origen es un código corto, sin espacios (por ejemplo SFN)." };
  }

  // El CP de prueba: el que escribió o, si no, el de origen guardado en la configuración.
  const cpEscrito = texto(formData, "testPostalCode");
  let testPostalCode: string | null;
  if (cpEscrito) {
    testPostalCode = normalizePostalCode(cpEscrito);
    if (!testPostalCode) return { ok: false, error: "El código postal de prueba no es válido (son 4 números, por ejemplo 2000)." };
  } else {
    testPostalCode = (await loadShippingSettings(workspace.id))?.originPostalCode ?? null;
    if (!testPostalCode) {
      return { ok: false, error: "Escribí un código postal de prueba, o guardá primero el código postal de origen arriba." };
    }
  }

  let prueba: { testQuoteMinor: number };
  try {
    prueba = await saveAndreaniCredentials(workspace.id, user.id, {
      env,
      user: usuario,
      password,
      clientCode,
      contractHome,
      contractBranch: contractBranch || null,
      originBranch: originBranch || null,
      testPostalCode,
    });
  } catch (error) {
    return { ok: false, error: errorDeAndreani(error, "no se pudo conectar Andreani") };
  }
  revalidatePath(RUTA);
  return {
    ok: true,
    message: `Listo, Andreani quedó conectado. Un paquete de prueba de 1 kg al CP ${testPostalCode} cuesta ${formatMinorArs(prueba.testQuoteMinor)}.`,
  };
}

export async function disconnectAndreaniAction(): Promise<ShippingActionResult> {
  const { workspace } = await requireStoreConfigurer();

  // Igual que Correo: si Andreani era la fuente, se vuelve a la tabla y se apaga la sucursal antes
  // de borrar la credencial; si así no quedara ninguna forma de entrega, se prende el retiro.
  const previa = await prisma.storeShippingSettings.findUnique({
    where: { workspaceId: workspace.id },
    select: { source: true, branchDeliveryEnabled: true, pickupEnabled: true, homeDeliveryEnabled: true },
  });
  const cambio = previa ? settingsAfterAndreaniDisconnect({ ...previa, source: toShippingSource(previa.source) }) : null;
  if (cambio) {
    await prisma.storeShippingSettings.update({ where: { workspaceId: workspace.id }, data: cambio.data });
  }
  await deleteAndreaniCredentials(workspace.id);

  revalidatePath(RUTA);
  let message = "Se desconectó Andreani.";
  if (cambio) {
    message = "Se desconectó. El precio del envío ahora sale de tu tabla y el envío a sucursal quedó apagado.";
    if (cambio.pickupForced) message += " Activamos el retiro en la sede para que la tienda siga teniendo una forma de entrega.";
  }
  return { ok: true, message };
}

/**
 * Cotiza con Andreani un paquete de prueba (la caja por defecto con un producto del peso por
 * defecto) al CP de origen, a domicilio y sin valor declarado. Muestra el precio sin recargo.
 */
export async function testAndreaniConnectionAction(): Promise<ShippingActionResult> {
  const { workspace } = await requireStoreConfigurer();

  const settings = await loadShippingSettings(workspace.id);
  const origen = settings?.originPostalCode ?? null;
  if (!origen) {
    return { ok: false, error: "Para probar, primero guardá el código postal de origen en la configuración de arriba." };
  }

  const conexion = await loadAndreaniClient(workspace.id);
  if (!conexion) return { ok: false, error: "Andreani no está conectado (o hay que volver a conectarlo)." };

  const d = SHIPPING_SETTINGS_DEFAULTS;
  const cfg = settings?.packageConfig ?? {
    packagingGrams: d.packagingGrams,
    defaultUnitGrams: d.defaultUnitGrams,
    boxLengthCm: d.boxLengthCm,
    boxWidthCm: d.boxWidthCm,
    boxHeightCm: d.boxHeightCm,
  };
  const pkg = buildPackage([{ qty: 1, weightGrams: null, lengthCm: null, widthCm: null, heightCm: null }], cfg);

  try {
    const r = await conexion.client.quote({
      clientCode: conexion.clientCode,
      contract: conexion.contractHome,
      postalCodeDestination: origen,
      originBranch: conexion.originBranch,
      packages: [
        {
          weightKg: pkg.weightGrams / 1000,
          lengthCm: pkg.lengthCm,
          widthCm: pkg.widthCm,
          heightCm: pkg.heightCm,
          declaredValueMinor: 0,
        },
      ],
    });
    return {
      ok: true,
      message: `Funciona. Un paquete de ${pkg.weightGrams} g y ${pkg.lengthCm}×${pkg.widthCm}×${pkg.heightCm} cm a tu mismo código postal cuesta ${formatMinorArs(r.priceMinor)} con Andreani a domicilio, sin tu recargo.`,
    };
  } catch (error) {
    if (isAndreaniError(error) && error.kind === "AUTH") {
      await markAndreaniNeedsReconsent(workspace.id);
      revalidatePath(RUTA);
    }
    return { ok: false, error: errorDeAndreani(error, "falló la prueba de Andreani") };
  }
}
