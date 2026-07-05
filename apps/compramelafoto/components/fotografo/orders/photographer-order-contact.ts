export function hasCallablePhone(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  if (raw.includes("Protegido")) return false;
  const digits = sanitizePhone(raw);
  return digits.length >= 8;
}

export function sanitizePhone(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function sanitizeInstagram(username?: string | null): string {
  if (!username) return "";
  return username
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/\/$/, "");
}

const messageTemplate = ({
  clientName,
  cleanInstagram,
}: {
  clientName: string;
  cleanInstagram: string;
}) => `Hola ${clientName || ""}! 😊

Gracias por tu compra 🙌

Te escribo para presentarme, me dedico a la fotografía y te dejo mis redes para que veas mi trabajo:
${cleanInstagram ? `📸 https://instagram.com/${cleanInstagram}` : ""}

Trabajo cubriendo distintos tipos de eventos y sesiones, así que si en algún momento necesitás fotos, estoy a disposición 👍

¡Gracias nuevamente!`;

function buildWhatsAppMessage(data: { clientName: string; photographerInstagram: string }): string {
  const cleanInstagram = sanitizeInstagram(data.photographerInstagram);
  const message = messageTemplate({
    clientName: data.clientName,
    cleanInstagram,
  });
  return encodeURIComponent(message);
}

export function buildCustomerWhatsappUrl(
  phone: string | null | undefined,
  customerName: string | null | undefined,
  photographerInstagram: string | null | undefined
): string | null {
  if (!hasCallablePhone(phone)) return null;
  const cleanPhone = sanitizePhone(phone);
  const message = buildWhatsAppMessage({
    clientName: customerName && !customerName.includes("Protegido") ? customerName : "",
    photographerInstagram: photographerInstagram ?? "",
  });
  return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${message}`;
}
