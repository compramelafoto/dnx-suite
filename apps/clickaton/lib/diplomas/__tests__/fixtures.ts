/**
 * Fixtures de test para `diploma-pdf`.
 *
 * `PNG_1754x1240_FIXTURE` es un PNG mínimo pero válido (escala de grises,
 * 1 bit por píxel, todo en negro) de exactamente 1754×1240 —las medidas del
 * diploma real—, armado a mano con `node:zlib` para no bajar ni commitear
 * un binario. El contenido visual no importa: sólo hace falta que
 * `pdf-lib` pueda decodificarlo con `embedPng`.
 */
import { deflateSync } from "node:zlib";
import type { DiplomaRegistrationSnapshot } from "@/lib/diplomas/diploma-service";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** CRC-32 de un chunk PNG (tipo + datos), tal como exige la especificación. */
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf.readUInt8(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/** PNG mínimo válido: escala de grises, 1 bit/píxel, sin interlace. */
function buildMinimalPng(width: number, height: number): Buffer {
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 1; // bit depth
  ihdrData[9] = 0; // color type: escala de grises
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdr = pngChunk("IHDR", ihdrData);

  // Cada fila: 1 byte de filtro ("None") + los píxeles empaquetados a 1 bit.
  const bytesPerRow = Math.ceil(width / 8);
  const raw = Buffer.alloc((bytesPerRow + 1) * height, 0);
  const idat = pngChunk("IDAT", deflateSync(raw));

  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([PNG_SIGNATURE, ihdr, idat, iend]);
}

export const PNG_1754x1240_FIXTURE = buildMinimalPng(1754, 1240);

/**
 * Inscripción acreditada, con TODOS los campos que el diploma le pide a la
 * base — los mismos que cargan las placas (`PARTICIPANT_CARD_REGISTRATION_SELECT`)
 * más los check-ins. Es un fixture compartido y no un literal por test a
 * propósito: la lista de campos crece con las variables de plantilla, y siete
 * copias sueltas se desincronizan.
 */
export function inscripcionAcreditada(
  over: Partial<DiplomaRegistrationSnapshot> = {}
): DiplomaRegistrationSnapshot {
  return {
    id: "reg_1",
    editionId: "ed_1",
    userId: 7,
    email: "ana@example.test",
    firstName: "Ana",
    lastName: "Pérez",
    city: "Córdoba",
    province: "Córdoba",
    country: "AR",
    instagramHandle: "@ana",
    instagramHandleNormalized: "ana",
    profilePhotoAssetId: null,
    profilePhotoStatus: null,
    visibleCode: "CK1-0042",
    sequenceNumber: 42,
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    imageUsageConsent: true,
    socialPublicationConsent: true,
    consentAcceptedAt: new Date("2026-09-01T10:00:00Z"),
    acceptedImageAt: new Date("2026-09-01T10:00:00Z"),
    acceptedTermsAt: new Date("2026-09-01T10:00:00Z"),
    termsAcceptedAt: new Date("2026-09-01T10:00:00Z"),
    termsVersion: "2026-09",
    ticketType: { name: "General" },
    checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
    edition: {
      name: "1ª Edición",
      slug: "dia-del-fotografo-2026",
      city: "Córdoba",
      startAt: new Date("2026-09-19T12:00:00Z"),
      location: "Paseo del Buen Pastor",
      timezone: "America/Argentina/Cordoba",
      coverImageUrl: null,
    },
    venue: { name: "Paseo del Buen Pastor", city: "Córdoba" },
    ...over,
  };
}
