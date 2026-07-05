import { isValidPhoneForPurchase } from "@/lib/phone-validation";

export type AlbumPackBuyerContact = {
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
};

export class AlbumPackBuyerContactError extends Error {
  constructor(
    message: string,
    public readonly code: string = "BUYER_CONTACT_INVALID"
  ) {
    super(message);
    this.name = "AlbumPackBuyerContactError";
  }
}

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

export function validateAlbumPackBuyerContact(input: {
  buyerEmail?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
}): AlbumPackBuyerContact {
  const buyerEmail = normalizeEmail(input.buyerEmail);
  const buyerName = String(input.buyerName ?? "").trim();
  const buyerPhone = String(input.buyerPhone ?? "").trim();

  if (!buyerEmail || !buyerEmail.includes("@")) {
    throw new AlbumPackBuyerContactError(
      "Ingresá un email válido para continuar.",
      "BUYER_EMAIL_REQUIRED"
    );
  }
  if (!buyerName) {
    throw new AlbumPackBuyerContactError(
      "Ingresá tu nombre y apellido.",
      "BUYER_NAME_REQUIRED"
    );
  }
  if (!buyerPhone) {
    throw new AlbumPackBuyerContactError(
      "Ingresá un teléfono o WhatsApp para contactarte.",
      "BUYER_PHONE_REQUIRED"
    );
  }
  if (!isValidPhoneForPurchase(buyerPhone)) {
    throw new AlbumPackBuyerContactError(
      "Ingresá un número de teléfono o WhatsApp (mínimo 8 dígitos).",
      "BUYER_PHONE_INVALID"
    );
  }

  return { buyerEmail, buyerName, buyerPhone };
}

export function albumPackBuyerContactStorageKey(albumId: number): string {
  return `album_${albumId}_pack_buyer_contact`;
}

export function readStoredAlbumPackBuyerContact(
  albumId: number
): AlbumPackBuyerContact | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(albumPackBuyerContactStorageKey(albumId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AlbumPackBuyerContact>;
    return validateAlbumPackBuyerContact(parsed);
  } catch {
    return null;
  }
}

export function writeStoredAlbumPackBuyerContact(
  albumId: number,
  contact: AlbumPackBuyerContact
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    albumPackBuyerContactStorageKey(albumId),
    JSON.stringify(contact)
  );
}
