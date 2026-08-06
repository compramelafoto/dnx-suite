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
        <p>{message}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </Notice>
    </div>
  );
}
