import assert from "node:assert/strict";
import test from "node:test";

import { fixedClock } from "@/lib/timeline/clock";
import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  seedPublicEdition,
  seedPublicTicket,
  type InMemoryPublicStore,
} from "../infrastructure/in-memory-public-registration-repository";
import { createPublicRegistrationService } from "./public-registration-service";

/**
 * El ensayo de edición necesita preguntarle al servicio de inscripción qué
 * vería un participante en un momento cualquiera. Para eso el servicio tiene
 * que resolver las fechas con un reloj inyectado y no con la hora de la
 * máquina.
 *
 * La edición sembrada acá tiene la inscripción abierta del 01 al 10 de
 * septiembre de 2026: una ventana que ya pasó. Si el servicio mira la hora
 * real, siempre la ve cerrada.
 */

const ABRE = new Date("2026-09-01T12:00:00.000Z");
const CIERRA = new Date("2026-09-10T23:59:00.000Z");
const DENTRO_DE_LA_VENTANA = new Date("2026-09-05T15:00:00.000Z");
const ANTES_DE_ABRIR = new Date("2026-08-20T15:00:00.000Z");
const DESPUES_DE_CERRAR = new Date("2026-09-30T15:00:00.000Z");

function tiendaConEdicionDeVentanaPasada(): InMemoryPublicStore {
  const store = createInMemoryPublicStore();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "ensayo-reloj",
    name: "Edición de prueba del reloj",
    shortDescription: "Prueba",
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationEnabled: true,
    registrationOpenAt: ABRE,
    registrationCloseAt: CIERRA,
    startAt: new Date("2026-10-10T19:00:00.000Z"),
    endAt: new Date("2026-10-10T23:00:00.000Z"),
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "RLJ26",
  });
  seedPublicTicket(store, {
    id: "tt_general",
    editionId: "ed1",
    venueId: null,
    name: "General",
    description: null,
    code: "GEN",
    priceAmount: 1_500_000,
    currency: "ARS",
    capacity: 100,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: ABRE,
    salesEndAt: CIERRA,
    products: [],
  });
  return store;
}

/**
 * El reloj va a las dos capas: el servicio lo usa para las ventanas de la
 * edición y el repositorio para el estado de venta de cada entrada. Si se le
 * pasa a una sola, el ensayo mezcla la hora simulada con la real.
 */
function servicioCon(clock?: ReturnType<typeof fixedClock>) {
  const store = tiendaConEdicionDeVentanaPasada();
  return createPublicRegistrationService({
    repo: createInMemoryPublicRegistrationRepository(store, { clock }),
    ...(clock ? { clock } : {}),
  });
}

test("con el reloj parado dentro de la ventana, la inscripción está abierta", async () => {
  const servicio = servicioCon(fixedClock(DENTRO_DE_LA_VENTANA));
  const oferta = await servicio.getOffer("ensayo-reloj");
  assert.equal(
    oferta.available,
    true,
    `esperábamos la inscripción abierta y vino: ${oferta.reason ?? "sin motivo"}`,
  );
});

test("con el reloj parado antes de la apertura, la inscripción todavía no abrió", async () => {
  const servicio = servicioCon(fixedClock(ANTES_DE_ABRIR));
  const oferta = await servicio.getOffer("ensayo-reloj");
  assert.equal(oferta.available, false);
  assert.equal(oferta.reason, "window_not_open");
});

test("con el reloj parado después del cierre, la inscripción está cerrada", async () => {
  const servicio = servicioCon(fixedClock(DESPUES_DE_CERRAR));
  const oferta = await servicio.getOffer("ensayo-reloj");
  assert.equal(oferta.available, false);
  assert.equal(oferta.reason, "window_closed");
});

test("el contexto de inscripción también respeta el reloj inyectado", async () => {
  const servicio = servicioCon(fixedClock(DENTRO_DE_LA_VENTANA));
  const contexto = await servicio.getContext("ensayo-reloj");
  assert.ok(contexto, "esperábamos contexto para la edición sembrada");
  assert.equal(contexto?.registrationWindow, "open");
});

test("sin reloj inyectado se usa la hora real y la ventana pasada está cerrada", async () => {
  const servicio = servicioCon();
  const oferta = await servicio.getOffer("ensayo-reloj");
  assert.equal(oferta.available, false);
  assert.equal(oferta.reason, "window_closed");
});
