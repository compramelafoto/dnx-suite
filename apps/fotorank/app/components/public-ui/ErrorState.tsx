import type { ReactNode } from "react";
import { Notice } from "./Notice";

type Props = {
  title?: string;
  message: string;
  action?: ReactNode;
};

export function ErrorState({ title = "No se pudo cargar", message, action }: Props) {
  return (
    <div data-testid="public-error-state">
      <Notice tone="danger" title={title} role="alert">
        <div className="flex flex-col gap-6">
          <p>{message}</p>
          {action}
        </div>
      </Notice>
    </div>
  );
}
