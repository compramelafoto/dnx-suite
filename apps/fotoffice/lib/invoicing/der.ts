/**
 * Codificador y lector DER (ASN.1) mínimo, lo justo para el pedido de certificado (PKCS#10) y la
 * firma CMS que pide ARCA. No es un ASN.1 general: sólo los tipos que esos dos documentos usan.
 *
 * Módulo PURO: sin base, sin red. Todo en `Buffer`.
 */

export const TAG = {
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  UTC_TIME: 0x17,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

/** Largo DER: forma corta hasta 127, larga después. */
export function encodeLength(len: number): Buffer {
  if (!Number.isInteger(len) || len < 0) throw new Error("Largo DER inválido");
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** Un TLV cualquiera. */
export function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

export function sequence(...items: Buffer[]): Buffer {
  return tlv(TAG.SEQUENCE, Buffer.concat(items));
}

/**
 * SET OF en DER: los elementos van ordenados por su codificación (X.690 §11.6). Sin esto la
 * firma de los atributos no verifica, porque el verificador recodifica y compara.
 */
export function setOf(...items: Buffer[]): Buffer {
  const ordenados = [...items].sort(Buffer.compare);
  return tlv(TAG.SET, Buffer.concat(ordenados));
}

/** Etiqueta de contexto construida: `[n]` EXPLICIT o IMPLICIT de algo construido. */
export function contextConstructed(n: number, content: Buffer): Buffer {
  return tlv(0xa0 | n, content);
}

/** INTEGER desde un entero no negativo o desde los bytes sin signo (se agrega el 0 si hace falta). */
export function integer(value: number | bigint | Buffer): Buffer {
  let bytes: Buffer;
  if (Buffer.isBuffer(value)) {
    bytes = value;
    // Sacar ceros de más a la izquierda, sin dejarlo vacío.
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0 && (bytes[i + 1]! & 0x80) === 0) i++;
    bytes = bytes.subarray(i);
  } else {
    let n = BigInt(value);
    if (n < BigInt(0)) throw new Error("Sólo enteros no negativos");
    const arr: number[] = [];
    if (n === BigInt(0)) arr.push(0);
    while (n > BigInt(0)) {
      arr.unshift(Number(n & BigInt(0xff)));
      n >>= BigInt(8);
    }
    bytes = Buffer.from(arr);
  }
  if (bytes.length === 0) bytes = Buffer.from([0]);
  if ((bytes[0]! & 0x80) !== 0) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return tlv(TAG.INTEGER, bytes);
}

export function octetString(content: Buffer): Buffer {
  return tlv(TAG.OCTET_STRING, content);
}

/** BIT STRING sin bits sobrantes (las firmas siempre son bytes enteros). */
export function bitString(content: Buffer): Buffer {
  return tlv(TAG.BIT_STRING, Buffer.concat([Buffer.from([0]), content]));
}

export function nullValue(): Buffer {
  return Buffer.from([TAG.NULL, 0]);
}

export function utf8String(s: string): Buffer {
  return tlv(TAG.UTF8_STRING, Buffer.from(s, "utf8"));
}

/** PrintableString: sólo letras, números, espacio y `'()+,-./:=?`. */
export function printableString(s: string): Buffer {
  if (!/^[A-Za-z0-9 '()+,\-./:=?]*$/.test(s)) throw new Error("Texto no imprimible para PrintableString");
  return tlv(TAG.PRINTABLE_STRING, Buffer.from(s, "ascii"));
}

/** UTCTime `AAMMDDhhmmssZ` (válido hasta 2049, que es lo que pide CMS para signingTime). */
export function utcTime(d: Date): Buffer {
  const p = (n: number) => String(n).padStart(2, "0");
  const s =
    p(d.getUTCFullYear() % 100) +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    "Z";
  return tlv(TAG.UTC_TIME, Buffer.from(s, "ascii"));
}

/** OID en texto ("1.2.840.113549.1.7.2") a DER. */
export function oid(dotted: string): Buffer {
  const parts = dotted.split(".").map((x) => {
    if (!/^\d+$/.test(x)) throw new Error(`OID inválido: ${dotted}`);
    return BigInt(x);
  });
  if (parts.length < 2) throw new Error(`OID inválido: ${dotted}`);
  const bytes: number[] = [];
  const first = parts[0]! * BigInt(40) + parts[1]!;
  for (const arc of [first, ...parts.slice(2)]) {
    const chunk: number[] = [];
    let n = arc;
    chunk.unshift(Number(n & BigInt(0x7f)));
    n >>= BigInt(7);
    while (n > BigInt(0)) {
      chunk.unshift(Number(n & BigInt(0x7f)) | 0x80);
      n >>= BigInt(7);
    }
    bytes.push(...chunk);
  }
  return tlv(TAG.OID, Buffer.from(bytes));
}

// --- Lectura -----------------------------------------------------------------------------------

export type Nodo = {
  tag: number;
  /** El TLV entero, tal cual vino (para copiar el emisor del certificado sin recodificarlo). */
  raw: Buffer;
  /** Sólo el contenido. */
  content: Buffer;
};

/** Lee un TLV en `offset`. Rechaza largos indefinidos o que se salen del buffer. */
export function readNode(buf: Buffer, offset = 0): Nodo {
  if (offset + 2 > buf.length) throw new Error("DER truncado");
  const tag = buf[offset]!;
  if ((tag & 0x1f) === 0x1f) throw new Error("Etiquetas DER largas no soportadas");
  let pos = offset + 1;
  const first = buf[pos++]!;
  let len: number;
  if (first < 0x80) {
    len = first;
  } else {
    const n = first & 0x7f;
    if (n === 0 || n > 4) throw new Error("Largo DER no soportado");
    if (pos + n > buf.length) throw new Error("DER truncado");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos++]!;
  }
  if (pos + len > buf.length) throw new Error("DER truncado");
  return { tag, raw: buf.subarray(offset, pos + len), content: buf.subarray(pos, pos + len) };
}

/** Los hijos de un nodo construido. */
export function children(node: Nodo): Nodo[] {
  const out: Nodo[] = [];
  let off = 0;
  while (off < node.content.length) {
    const child = readNode(node.content, off);
    out.push(child);
    off += child.raw.length;
  }
  return out;
}

/** OID DER (el nodo entero) a texto. */
export function decodeOid(node: Nodo): string {
  if (node.tag !== TAG.OID) throw new Error("No es un OID");
  const b = node.content;
  const arcs: bigint[] = [];
  let n = BigInt(0);
  for (let i = 0; i < b.length; i++) {
    n = (n << BigInt(7)) | BigInt(b[i]! & 0x7f);
    if ((b[i]! & 0x80) === 0) {
      arcs.push(n);
      n = BigInt(0);
    }
  }
  const first = arcs.shift() ?? BigInt(0);
  const a = first < BigInt(80) ? first / BigInt(40) : BigInt(2);
  const c = first - a * BigInt(40);
  return [a, c, ...arcs].map(String).join(".");
}

/** PEM ↔ DER. */
export function pemToDer(pem: string, label?: string): Buffer {
  const re = label
    ? new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`)
    : /-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/;
  const m = pem.match(re);
  if (!m) throw new Error("No es un PEM válido");
  return Buffer.from(m[1]!.replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
}

export function derToPem(der: Buffer, label: string): string {
  const b64 = der.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}
