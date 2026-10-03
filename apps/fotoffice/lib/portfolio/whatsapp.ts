/**
 * El botón de WhatsApp de una ficha pública.
 *
 * ── Por qué el mensaje viene escrito ──
 *
 * El sentido del botón no es ahorrarle tipeo al visitante: es que **el fotógrafo sepa que ese
 * contacto llegó por la web de la Sociedad**. Sin eso, la institución no tiene forma de mostrar que
 * su sitio sirve para conseguir trabajo, y el socio no tiene forma de saberlo tampoco.
 *
 * ── Por qué se normaliza tan de cerca ──
 *
 * Un número mal armado no falla: abre una conversación **con otra persona**. Los formatos que
 * admite son los que de verdad hay en el padrón, medidos antes de escribir esto: en su mayoría
 * `54` + 10 dígitos, algunos nacionales pelados y unos pocos con el 0 de larga distancia.
 *
 * Lo que no se puede normalizar con certeza se rechaza, y la ficha no muestra el botón. Es mejor no
 * ofrecerlo que mandar a un desconocido.
 */

/** Características argentinas: 2 dígitos (CABA), 3 o 4. Lo usa el descarte del viejo "15". */
const LARGOS_DE_CARACTERISTICA = [2, 3, 4] as const;

/**
 * El número listo para `wa.me`, o `null`.
 *
 * Formato de salida: `549` + 10 dígitos. El `9` es lo que WhatsApp exige para celulares argentinos
 * y lo que más se olvida al cargar un teléfono a mano.
 */
export function normalizeArgentineWhatsappNumber(entrada: string | null | undefined): string | null {
  if (!entrada) return null;

  let d = entrada.replace(/\D/g, "");
  if (!d) return null;

  // Prefijo internacional de salida.
  if (d.startsWith("00")) d = d.slice(2);

  // Ya viene con país. Si no es Argentina, esto no sabe normalizarlo.
  if (d.length > 10) {
    if (d.startsWith("549")) d = d.slice(3);
    else if (d.startsWith("54")) d = d.slice(2);
    else if (d.startsWith("0")) d = d.slice(1);
    else if (d.startsWith("9") && d.length === 11) d = d.slice(1);
    else return null;
  }

  /*
   * El "15" de los celulares viejos. Se saca sólo si al sacarlo queda un número de largo correcto:
   * de lo contrario sería recortar un número que capaz estaba bien.
   */
  if (d.length === 12) {
    for (const largo of LARGOS_DE_CARACTERISTICA) {
      if (d.slice(largo, largo + 2) === "15") {
        d = d.slice(0, largo) + d.slice(largo + 2);
        break;
      }
    }
  }

  // Diez dígitos exactos: característica más abonado. Ni uno más ni uno menos.
  if (!/^\d{10}$/.test(d)) return null;

  return `549${d}`;
}

/**
 * El mensaje con el que se abre la conversación.
 *
 * Termina en "sobre" sin punto a propósito: el visitante sigue escribiendo ahí mismo y no tiene que
 * borrar nada. Si terminara en una frase cerrada, la mitad lo mandaría tal cual.
 */
export function portfolioWhatsappMessage(params: {
  displayName: string;
  institution: string;
}): string {
  // Por el nombre de pila: "Hola Claudia Begala" suena a formulario, no a mensaje.
  const nombreDePila = params.displayName.trim().split(/\s+/)[0] || params.displayName;
  return `Hola ${nombreDePila}! Vi tu trabajo en la web de ${params.institution} y quería consultarte sobre`;
}

/** La dirección completa de `wa.me`, con el mensaje ya cargado. */
export function portfolioWhatsappUrl(params: {
  phone: string;
  displayName: string;
  institution: string;
}): string | null {
  const numero = normalizeArgentineWhatsappNumber(params.phone);
  if (!numero) return null;

  const texto = portfolioWhatsappMessage({
    displayName: params.displayName,
    institution: params.institution,
  });
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
