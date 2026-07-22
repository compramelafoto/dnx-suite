"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { archiveContactMessageAction } from "@/lib/contact/admin";

type Props = {
  messageId: string;
};

export function ArchiveMessageButton({ messageId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() => {
        startTransition(async () => {
          await archiveContactMessageAction(messageId);
          router.push(adminRoutes.messages);
        });
      }}
    >
      Archivar
    </Button>
  );
}
