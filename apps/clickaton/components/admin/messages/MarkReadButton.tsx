"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { markContactMessageReadAction } from "@/lib/contact/admin";

type Props = {
  messageId: string;
};

export function MarkReadButton({ messageId }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() => {
        startTransition(async () => {
          await markContactMessageReadAction(messageId);
        });
      }}
    >
      Marcar leído
    </Button>
  );
}
