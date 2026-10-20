"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Mail = {
  id: number;
  account: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  vendorKey: string | null;
  reviewReason: string | null;
  gmailUrl: string;
};

export default function MailReviewInbox({ refreshKey }: { refreshKey: number }) {
  const [mails, setMails] = useState<Mail[]>([]);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/admin/finance-dnx/mail/messages", { cache: "no-store" });
    if (res.ok) setMails((await res.json()).messages);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, refreshKey]);

  async function descartar(id: number) {
    await fetch(`/api/admin/finance-dnx/mail/messages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "DESCARTADO" }),
    });
    await cargar();
  }

  if (mails.length === 0) return null;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-900">Para revisar ({mails.length})</h2>
      <p className="text-sm text-gray-600 mb-4">Mails de proveedores que todavía no se cargaron como gasto.</p>
      <ul className="divide-y divide-gray-100">
        {mails.map((m) => (
          <li key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 break-words">{m.subject || "(sin asunto)"}</p>
              <p className="text-xs text-gray-500 break-all">
                {m.vendorKey ?? "sin proveedor"} · {m.fromAddress} · {m.account} ·{" "}
                {new Date(m.receivedAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
              </p>
              {m.reviewReason && <p className="text-xs text-amber-700 mt-1">{m.reviewReason}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <a
                href={m.gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 underline self-center"
              >
                Ver mail
              </a>
              <Button variant="secondary" onClick={() => descartar(m.id)}>
                Descartar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
