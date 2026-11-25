"use client";

import "@repo/auth-ui/tokens.css";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DnxAuthShell,
  DnxAuthHeader,
  DnxVerificationState,
  compramelafotoAuthBrand,
} from "@repo/auth-ui";

export default function ConfirmarEmailClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Confirmando tu nuevo email…");
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    const token = searchParams?.get("token");
    if (!token) {
      setStatus("error");
      setMessage("El enlace no es válido. Pedí el cambio de nuevo desde tu cuenta.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/cuenta/confirmar-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo confirmar el cambio de email.");
        setStatus("success");
        setMessage(`Listo: desde ahora iniciás sesión con ${data.email}. Tu contraseña no cambió.`);
      } catch (err: unknown) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "No se pudo confirmar el cambio de email.");
      }
    })();
  }, [searchParams]);

  return (
    <DnxAuthShell brand={compramelafotoAuthBrand}>
      <DnxAuthHeader
        logo={compramelafotoAuthBrand.logo}
        title="Cambio de email"
        description="Confirmamos la nueva dirección para iniciar sesión."
      />
      <DnxVerificationState status={status} message={message} loginHref="/login" />
    </DnxAuthShell>
  );
}
