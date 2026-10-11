"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@repo/db";
import { SALE_TERMS_TEXT_VERSION, SALE_UNAVAILABLE_TEXT, isDelivery, normalizeEmail } from "@repo/muestras";
import { frenarPorEmail, frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";
import { credencialesDeVentas, leerConfigDeVentas, puedeComprar } from "./config";
import { cookieDePedido, hashDeToken, nuevoPublicId, tokenDePedido } from "./pedido";
import { reservarEnTransaccion, type DireccionDeEnvio } from "./reservar-tx";

/**
 * "Continuar al pago" (etapa 8, spec D22, D25): valida al comprador, reserva el número de copia por
 * 20 minutos y crea el pedido en espera de pago, con los montos y el reparto congelados. Devuelve el
 * enlace del pedido (y deja su cookie); el pago con tarjeta va después (tarea 11).
 */
export type ResultadoReserva =
  | { ok: true; publicId: string; token: string; totalArs: number; holdExpiresAt: string }
  | { ok: false; errores: string[] };

const error = (texto: string): ResultadoReserva => ({ ok: false, errores: [texto] });
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TELEFONO = /^[0-9+()\-\s]{6,40}$/;
const CAMPO_DIRECCION = 120;

const texto = (fd: FormData, nombre: string) => {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.trim() : "";
};

function direccionDesde(fd: FormData): DireccionDeEnvio | string {
  const d = {
    calle: texto(fd, "calle"), numero: texto(fd, "numero"), pisoDepto: texto(fd, "pisoDepto") || null,
    ciudad: texto(fd, "ciudad"), provincia: texto(fd, "provincia"), codigoPostal: texto(fd, "codigoPostal"),
  };
  if (!d.calle || !d.numero || !d.ciudad || !d.provincia || !d.codigoPostal) return "Completá la dirección de envío.";
  if (Object.values(d).some((v) => v != null && v.length > CAMPO_DIRECCION)) return `Cada dato de la dirección puede tener hasta ${CAMPO_DIRECCION} caracteres.`;
  return d;
}

export async function reservarCopia(fd: FormData): Promise<ResultadoReserva> {
  const config = leerConfigDeVentas();
  const usuario = await getUsuario();
  if (!puedeComprar(usuario, config)) return error(SALE_UNAVAILABLE_TEXT);

  const offerId = texto(fd, "offerId");
  if (!ES_ID.test(offerId)) return error("Esta obra no se puede comprar ahora.");
  const delivery = texto(fd, "entrega");
  if (!isDelivery(delivery)) return error("Elegí una forma de entrega.");
  const nombre = texto(fd, "nombre");
  if (nombre.length < 2 || nombre.length > 120) return error("Escribí tu nombre y apellido.");
  const email = normalizeEmail(texto(fd, "email"));
  if (!email) return error("Escribí un email válido.");
  if (config.modo === "TEST" && !email.endsWith("@testuser.com")) return error("En modo prueba usá un email de comprador de prueba (termina en @testuser.com).");
  const telefonoCrudo = texto(fd, "telefono");
  if (telefonoCrudo && !TELEFONO.test(telefonoCrudo)) return error("Revisá el teléfono.");
  let direccion: DireccionDeEnvio | null = null;
  if (delivery === "SHIPPING") {
    const d = direccionDesde(fd);
    if (typeof d === "string") return error(d);
    direccion = d;
  }
  if (fd.get("terminos") !== "on") return error("Para comprar tenés que aceptar los términos de la venta.");
  if (texto(fd, "termsVersion") !== SALE_TERMS_TEXT_VERSION) return error("Los términos de la venta cambiaron: recargá la página y revisalos.");

  // Frenos después de validar (con datos inventados no se suman claves nuevas).
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("reservarCopia", ip).allowed || !frenarPorEmail("reservarCopia", email).allowed) {
    return error("Hiciste muchos pedidos seguidos. Esperá unos minutos.");
  }
  const cred = credencialesDeVentas();
  if (!cred.pedidosSecret || !cred.ownerUserId) return error(SALE_UNAVAILABLE_TEXT);

  const publicId = nuevoPublicId();
  const token = tokenDePedido(publicId, cred.pedidosSecret);
  let r;
  try {
    r = await prisma.$transaction(
      (tx) => reservarEnTransaccion(tx, {
        offerId, delivery, direccion,
        comprador: { nombre, email, telefono: telefonoCrudo || null },
        nombreEnCertificado: fd.get("nombreEnCertificado") === "on",
        termsVersion: SALE_TERMS_TEXT_VERSION,
        isTest: config.modo !== "LIVE",
        ambienteCuenta: config.ambienteCuenta,
        ownerUserId: cred.ownerUserId!,
        publicId,
        accessTokenHash: hashDeToken(token),
        idempotencyKey: randomUUID(),
      }, new Date()),
      { timeout: 20_000, maxWait: 5_000 },
    );
  } catch (err) {
    // La última red: el índice único de la numeración (dos compras que llegaron juntas al mismo número).
    if ((err as { code?: string })?.code === "P2002") return error("Alguien acaba de reservar esa copia: probá de nuevo.");
    throw err;
  }
  if (!r.ok) return error(r.error);
  (await cookies()).set(cookieDePedido(publicId, token));
  return { ok: true, publicId, token, totalArs: r.totalCents / 100, holdExpiresAt: r.holdExpiresAt.toISOString() };
}
