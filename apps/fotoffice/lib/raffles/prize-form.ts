/**
 * El formulario de un premio, parseado. Módulo PURO.
 *
 * El `order` no es cosmético: entra en el cálculo del ganador. Dos premios con el mismo orden
 * sacarían el mismo número, y por eso la base también lo impide con un `@@unique`.
 *
 * El aliado tiene tres formas válidas, y las tres importan: una ficha de `DnxPartner` elegida
 * de la lista; un nombre suelto, para la marca que todavía no tiene ficha; o nada, porque la
 * institución también pone premios propios. Lo único que no se acepta es una ficha sin
 * nombre: quedaría un premio de nadie.
 *
 * Los datos del local —correo, dirección, teléfono y horarios— se guardan como instantáneas
 * junto al premio y no se leen de la ficha al momento de enviar. El correo al ganador ya salió
 * diciendo «andá a San Martín 1234»: si el aliado se muda después, la constancia tiene que
 * seguir coincidiendo con lo que la persona leyó.
 *
 * El plazo de retiro NO se carga acá ni se pregunta: son 15 días corridos desde el sorteo,
 * siempre. Lo fija `resolveRaffle` contando los días que diga `Raffle.pickupDays`. Preguntarlo
 * premio por premio era pedirle a alguien que copiara una cuenta que el sistema ya sabe hacer,
 * con el riesgo de que un mes la copiara mal.
 */

export type PrizeFormValues = {
  order: number;
  title: string;
  description: string | null;
  conditions: string | null;
  pickupInstructions: string | null;
  estimatedValueMinor: number | null;
  partnerId: string | null;
  partnerNameSnapshot: string | null;
  partnerEmailSnapshot: string | null;
  partnerLogoSnapshot: string | null;
  partnerAddressSnapshot: string | null;
  partnerPhoneSnapshot: string | null;
  partnerHoursSnapshot: string | null;
};

export type PrizeFormResult =
  | { ok: true; values: PrizeFormValues }
  | { ok: false; error: string };

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const nulo = (v: string) => (v === "" ? null : v);

export function parsePrizeForm(formData: FormData): PrizeFormResult {
  const title = texto(formData, "title");
  if (title === "") return { ok: false, error: "Poné el nombre del premio." };

  const order = Number(texto(formData, "order"));
  if (!Number.isInteger(order) || order < 1) {
    return { ok: false, error: "El orden del premio tiene que ser un número entero desde 1." };
  }

  const crudoValor = texto(formData, "estimatedValue");
  let estimatedValueMinor: number | null = null;
  if (crudoValor !== "") {
    // "120.000,50" como se escribe acá: el punto separa miles y la coma, decimales.
    const pesos = Number(crudoValor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(pesos) || pesos < 0) {
      return { ok: false, error: "El valor estimado no se entiende." };
    }
    estimatedValueMinor = Math.round(pesos * 100);
  }

  const partnerId = nulo(texto(formData, "partnerId"));
  const partnerName = nulo(texto(formData, "partnerName"));
  if (partnerId !== null && partnerName === null) {
    return { ok: false, error: "Elegí el aliado de la lista o escribí su nombre." };
  }

  const partnerEmail = nulo(texto(formData, "partnerEmail"));
  // Sin correo del aliado no hay a quién pedirle el remito, y el premio se queda sin respaldo.
  // No se rechaza —hay premios de la propia institución— pero sí se exige que tenga forma de
  // correo cuando se escribe algo: un correo mal tipeado es un aviso que nunca llega.
  if (partnerEmail !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(partnerEmail)) {
    return { ok: false, error: "El correo del aliado no parece un correo." };
  }

  return {
    ok: true,
    values: {
      order,
      title,
      description: nulo(texto(formData, "description")),
      conditions: nulo(texto(formData, "conditions")),
      pickupInstructions: nulo(texto(formData, "pickupInstructions")),
      estimatedValueMinor,
      partnerId,
      partnerNameSnapshot: partnerName,
      partnerEmailSnapshot: partnerEmail,
      partnerLogoSnapshot: nulo(texto(formData, "partnerLogo")),
      partnerAddressSnapshot: nulo(texto(formData, "partnerAddress")),
      partnerPhoneSnapshot: nulo(texto(formData, "partnerPhone")),
      partnerHoursSnapshot: nulo(texto(formData, "partnerHours")),
    },
  };
}
