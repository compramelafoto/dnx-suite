"use client";

type Provider = "MERCADOPAGO_OWN" | "PAYPAL_OWN";

const STEPS: Record<Provider, string[]> = {
  MERCADOPAGO_OWN: [
    "Entrá a mercadopago.com/developers con tu cuenta de Mercado Pago de tu país.",
    "Tocá \"Tus integraciones\" y \"Crear aplicación\". Elegí \"Pagos online\" y \"CheckoutPro\".",
    "En la aplicación, abrí \"Credenciales de producción\" y completá los datos que te pida.",
    "Copiá el \"Access Token\" (empieza con APP_USR-) y pegalo acá.",
  ],
  PAYPAL_OWN: [
    "Necesitás una cuenta PayPal Business.",
    "Entrá a developer.paypal.com con esa cuenta y elegí el modo \"Live\".",
    "En \"Apps & Credentials\" tocá \"Create App\".",
    "Copiá el \"Client ID\" y el \"Secret\" y pegalos acá.",
  ],
};

export default function IntlCollectionInstructions({ provider }: { provider: Provider }) {
  return (
    <details className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 text-[#1a1a1a]">
      <summary className="cursor-pointer text-sm font-medium">Cómo conseguir las credenciales</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#374151] break-words">
        {STEPS[provider].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
