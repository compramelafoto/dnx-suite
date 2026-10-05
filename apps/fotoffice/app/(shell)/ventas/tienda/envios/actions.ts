"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireStoreConfigurer } from "@/lib/store/access";
import { parseShippingSettingsForm, SHIPPING_SETTINGS_DEFAULTS } from "@/lib/store/shipping/settings-form";
import { parseZoneForm } from "@/lib/store/shipping/zone-form";
import { buildPackage } from "@/lib/store/shipping/package";
import { loadShippingSettings } from "@/lib/store/shipping/repository";
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

/**
 * Acciones de la configuración de envíos. Todas pasan por `requireStoreConfigurer` y toman el
 * workspace de la sesión, nunca del formulario. Devuelven un resultado en vez de redirigir:
 * las llaman formularios con `onSubmit`, y un error no tiene que borrar lo escrito.
 *
 * Logs: sólo `kind` y `status` de MiCorreo. Nunca credenciales, nunca el mensaje de Correo.
 */

export type ShippingActionResult = { ok: true; message?: string } | { ok: false; error: string };

const RUTA = "/ventas/tienda/envios";

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
  const parsed = parseShippingSettingsForm(formData, { correoActive: await correoActivo(workspace.id) });
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
  await prisma.$transaction(async (tx) => {
    let id = zoneId;
    if (id) {
      await tx.storeShippingZone.updateMany({ where: { id, workspaceId: workspace.id }, data: zona });
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
  // tabla propia antes de borrar la credencial.
  const cambiados = await prisma.storeShippingSettings.updateMany({
    where: { workspaceId: workspace.id, OR: [{ source: "CORREO_ARGENTINO" }, { branchDeliveryEnabled: true }] },
    data: { source: "TABLE", branchDeliveryEnabled: false },
  });
  await deleteCorreoArgentinoCredentials(workspace.id);

  revalidatePath(RUTA);
  return {
    ok: true,
    message:
      cambiados.count > 0
        ? "Se desconectó. El precio del envío ahora sale de tu tabla y el envío a sucursal quedó apagado."
        : "Se desconectó Correo Argentino.",
  };
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
