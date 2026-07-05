"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  buildAdminOrderViewUrl,
  type AdminOrderViewSource,
} from "@/lib/admin/order-view-link";
import AdminIconButton from "@/components/admin/AdminIconButton";

export default function AdminOrderCopyViewLinkButton({
  orderId,
  source,
}: {
  orderId: number;
  source: AdminOrderViewSource;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = buildAdminOrderViewUrl(
      orderId,
      source,
      typeof window !== "undefined" ? window.location.origin : undefined
    );
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <AdminIconButton
      label="Copiar link de visualización del pedido (admin)"
      onClick={handleCopy}
      variant={copied ? "default" : "default"}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </AdminIconButton>
  );
}
